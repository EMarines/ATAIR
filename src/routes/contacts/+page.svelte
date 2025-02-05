<script lang="ts">
  import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';
  import { Search, CardContact, Button } from '$components';
  import AddContact from '$lib/components/AddContact.svelte';
  import type { Contact } from '$lib/types';
  import { goto } from '$app/navigation';

  let searchTerm = "";
  $systStatus = "";
  let selectedContact: Contact | null = null;

  // Ordenar contactos por fecha y alfabéticamente
  $: sortedContacts = $contactsStore ? [...$contactsStore].sort((a, b) => {
    // Primero intentamos ordenar por fecha
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    
    // Si las fechas son diferentes, ordenar por fecha (más reciente primero)
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB.getTime() - dateA.getTime();
    }
    
    // Si las fechas son iguales, ordenar alfabéticamente
    const nameA = `${a.name || ''} ${a.lastname || ''}`.toLowerCase();
    const nameB = `${b.name || ''} ${b.lastname || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  }) : [];

  // Reactive statement para filtrar los contactos ordenados
  $: contacts = searchTerm ? sortedContacts.filter((contact: Contact) => {
    if (!contact) return false;
    
    const searchableText = [
      contact.name || '',
      contact.lastname || ''
    ].join(' ')
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .toLowerCase();
    
    return searchableText.includes(searchTerm.toLowerCase());
  }) : sortedContacts;

    //  Seleccionar y navegar al contacto
    function seleContact(cont: Contact) {
      if (!cont) {
        console.error('Error: Contacto inválido');
        return;
      }

      // Verificar que el contacto tenga un ID válido
      const contactId = cont.id?.trim();
      if (!contactId) {
        console.error('Error: ID de contacto faltante o inválido', cont);
        return;
      }

      goto(`/contact/${contactId}`);
    }

    // Búsqueda de contactos
    function searCont() {
      if (!$contactsStore) return [];
      
      return contacts = sortedContacts.filter((contact: Contact) => {
        if (!contact) return false;
        
        const searchableText = [
          contact.name || '',
          contact.lastname || ''
        ].join(' ')
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .toLowerCase();
        
        return searchableText.includes(searchTerm.toLowerCase());
      });  
    }

    // Añadir contacto - maneja el estado del formulario
    function addContact() {
      selectedContact = null;
      contact.reset();
      $systStatus = "addContact";
    }

</script>


<div class="container">

  <div class="mainContainer">
    {#if $systStatus === ""}
      <div class="title__container">
        <h1 class="title">Contactos</h1>
      </div>
      
      <div class="headContainer">
        <Button 
          element="button"
          variant="solid"
          on:click={addContact}
        >
          Alta de Contacto
        </Button>
        <Search bind:searchTerm on:input={searCont} on:keydown={()=>{}}/>
      </div>
    
      <div class="cards__container">
        {#each contacts as cont}
          <div 
            class="card__container" 
            on:click={() => seleContact(cont)}
          >
            <CardContact {cont} />
          </div>
        {/each}
      </div>
    {:else if $systStatus === "addContact" || $systStatus === "editContact"}
      <AddContact 
        existingContact={selectedContact}
        on:cancel={() => {
          $systStatus = "";
          selectedContact = null;
        }} 
        on:success={() => {
          $systStatus = "";
          selectedContact = null;
        }}
      />
    {/if}
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