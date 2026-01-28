<script lang="ts">
  import { contactsStore, propertiesStore } from '$lib/stores/dataStore';
  import { CardProperty, Search } from '$components';
  import type { Property } from '$lib/types';
  import { goto } from '$app/navigation';

//   let prop = {};
  let searchTerm = "";
//   let property: Property = {} as Property;

  // Ordenar propiedades por fecha de creación (más recientes primero)
  $: properties = $propertiesStore.sort((a, b) => {
    return Number(b.created_at) - Number(a.created_at);
  });

//   /  Le da el valor de prop a $property y Redirige a propSelect
    function seleProperty(prop: Property) {
      console.log(prop);
      goto("/property/" + prop.public_id)
    }

  // Search property by title, id y description
    function searProp() {
      return properties = $propertiesStore
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
        .filter((propety) => {
          // Asegurarse de que los valores existan antes de usarlos
          const title = propety.title || '';
          const description = propety.description || '';
          const publicId = propety.public_id || '';
          
          let contInfo = (title + " " + description + " " + publicId)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          return contInfo.includes(searchTerm.toLowerCase());
        });  
    };


</script>
 
  <!-- Renderización -->
  <div class="mainContainer">
      
    <div class="title__head">

      <h1 class="title">Propiedades</h1>
      <div class="title__inter">
        <Search bind:searchTerm on:input={searProp} on:keydown={()=>{}}/>
      </div>

    </div>

    <div class="card__container">
      {#each properties as prop}
        <div class="card__prop"
          on:click={() => seleProperty(prop)} 
          on:keydown={() => seleProperty(prop)}
          role="button"
          tabindex="0"
        >
          <CardProperty property={prop} />
        </div>
      {/each}  
    </div>
    
  </div>


<style>

.mainContainer {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px;
  align-items: center;
}

.title__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 1rem;
}

.title__inter {
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-around;
  align-items: center;
  padding: 0 1rem;
}

.card__container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  width: 100%;
  gap: 1rem;
  box-sizing: border-box;
}

.card__prop {
  display: flex;
  background-color: transparent;
  /* border-radius: 5px; */
  transition: background-color 0.2s ease;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.card__prop :global(> *) {
  background-color: rgb(31, 31, 31);
  border-radius: 5px;
  width: 100%;
  height: 100%;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
}

.card__prop:hover :global(> *) {
  background-color: rgb(63, 63, 63);
}

@media (max-width: 768px) {
  .title__inter {
    flex-direction: column;
    gap: 1rem;
  }

  .card__container {
    grid-template-columns: 1fr;
    padding: 0.5rem;
  }
}

</style>