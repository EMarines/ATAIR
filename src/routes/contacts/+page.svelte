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
            role="button"
            tabindex="0"
            on:click={() => seleContact(cont)}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                seleContact(cont);
              }
            }}
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
  width: 100%;
  padding: 0 1rem;
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  width: 100%;
  padding: 1rem;
}

.card__container {
  display: flex;
  width: 100%;
}

/* .card__container > div {
  width: 100%;
} */

@media (max-width: 768px) {
  .headContainer {
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    padding: 0 1rem;
  }

  .cards__container {
    grid-template-columns: 1fr;
    padding: 0.5rem;
  }
}
</style>