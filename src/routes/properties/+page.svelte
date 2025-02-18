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
      goto("/property/" + prop.public_id)
    }

  // Search property by title, id y description
    function searProp() {
      return properties = $propertiesStore
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
        .filter((propety) => {
          let contInfo = (propety.title + " " + propety.description + " " + propety.public_id)
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

      <h1 class="title">Propiedadess</h1>
      <div class="title__inter">
        <Search bind:searchTerm on:input={searProp} on:keydown={()=>{}}/>
      </div>

    </div>

    <div class="card__container">
      {#each properties as prop}
        <div 
          class="card__prop"
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
  align-items: center;
}

.title__head{
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: auto;
}

.title__inter {
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-around;
  align-items: baseline;

}

.card__container {
    display: flex;
    flex-direction: row;
    margin: 0 auto;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
}

/* .card__prop { 
    display: flex; 
    flex-direction: column;   
    width: 200px;
    height: 250px;     
    border: 1px solid grey;
    border-radius: 5px;
    justify-content: center;
    padding: 8px;
    gap: 4px;
  } */

  @media(max-width: 400px) {
    .card__container {
    flex-direction: column;
    width: 100%;
    gap: 20px;
  }
  .card__prop {
    border: none;
    padding: 5px;
    width: 100%;
    height: 200px;
    align-items: center;
    }
    .title__head {
      flex-direction: column;
      align-items: center;
      margin-bottom: 5px;
    }
    .title__inter {
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin: 15px 0;
    }
  }
  


</style>