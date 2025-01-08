<script lang="ts">
  import { contactsStore, propertiesStore, systStatus } from '$lib/stores/dataStore';
  import { Search, CardContact } from '$components';
  import type { Contact } from '$lib/types';
  import { goto } from '$app/navigation';

  let searchTerm = "";

  $: contacts = $contactsStore

    //  Le da el valor de prop a $property y Redirige a propSelect
    function seleContact(cont: Contact) {
      goto("/contact/" + cont.id)
    }

     // Añadir propiedad
     function addContact() {
        $systStatus = "addContact"
        goto("/contactos/altaContacto")
      }

    // Search property by title, id y description
    function searCont() {
      return contacts = $contactsStore.filter((contact: Contact) => {
        let contInfo = (contact.name + " " + contact.lastname ).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return contInfo.includes(searchTerm.toLowerCase());
      });  
    };


</script>


<div class="container">

  <div class="mainContainer">
    <div class="title__container">
      <h1 class="title">Contactos</h1>
    </div>
    
    <div class="headContainer">
      <button class="btn__submit" on:click={addContact}>Alta de Contacto</button>
      <Search bind:searchTerm on:input={searCont} on:keydown={()=>{}}/>
    </div>
  
    <div class="cards__container">
      {#each contacts as cont}
        <div 
          class="card__container" 
          on:click={() => seleContact(cont)} 
          on:keydown={() => seleContact(cont)}
          role="button"
          tabindex="0"
        >
          <CardContact {cont}/>         
        </div>
      {/each}        
    </div>  

  </div>

</div> 

<style>

.headContainer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
}

.mainContainer {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.cards__container {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.card__container{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 10px;
  justify-content: center;
  background-color: rgb(31, 31, 31);
  border-radius: 5px;
}

.card__container:hover{
  background-color: rgb(63, 63, 63);
}

/* .card__info {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  font-weight: 300;
  align-items: center;
  padding: 10px;
}

.card__infoHead {
  display: flex;
  font-weight: 600;
  padding-top: 8px;
  gap: 15px;
}

span.date {
  left: 50px;
  font-size: .7rem;
  font-weight: 500;
}

.info__cont{
  width: 100%;
  height: 38%;
  align-items: center;
} */

/* 
@media (max-width:400px){
  .headContainer {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
} */
</style>