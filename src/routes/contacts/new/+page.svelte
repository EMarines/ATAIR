<script lang="ts">
import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';
import { Search, CardContact, AddContact } from '$components';
import type { Contact, SearchEvent, ContactPageState } from '$lib/types';
import { goto } from '$app/navigation';

// Estado de la página
let pageState: ContactPageState = {
    searchTerm: "",
    isLoading: false,
    error: null
};

$systStatus = "";

$: filteredContacts = searchContacts($contactsStore, pageState.searchTerm);

// Función tipada para seleccionar contacto
function selectContact(cont: Contact): void {
    if (!cont.id) return;
    goto(`/contact/${cont.id}`);
}

// Función tipada para añadir contacto
function handleAddContact(): void {
    contact.reset();
    $systStatus = "addContact";
}

// Función de búsqueda mejorada
function searchContacts(contacts: Contact[], searchTerm: string): Contact[] {
    if (!searchTerm) return contacts;
    
    return contacts.filter((contact: Contact) => {
        const searchableText = `${contact.name} ${contact.lastname}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
    });
}

// Manejador de búsqueda tipado
function handleSearch(event: SearchEvent): void {
    pageState.searchTerm = event.target.value;
}
</script>

<div class="container">
    <div class="mainContainer">
        <!-- {#if $systStatus === ""}
            <div class="title__container">
                <h1 class="title">Contactos</h1>
            </div>
            
            <div class="headContainer">
                <button 
                    class="btn__submit" 
                    on:click={handleAddContact}
                >
                    Alta de Contacto
                </button>
                <Search 
                    bind:searchTerm={pageState.searchTerm} 
                    on:input={handleSearch}
                />
            </div>

            <div class="cards__container">
                {#each filteredContacts as contact, index (contact.id || index)}
                    <div 
                        class="card__container" 
                        on:click={() => selectContact(contact)} 
                        on:keydown={(e) => e.key === 'Enter' && selectContact(contact)}
                        role="button"
                        tabindex="0"
                    >
                        <CardContact cont={contact}/>         
                    </div>
                {/each}        
            </div> 
        {:else if $systStatus === "addContact"} -->
            <AddContact 
                on:cancel={() => $systStatus = ""} 
                on:success={() => {
                    $systStatus = "";
                    goto("/contacts");
                }}
            />
        <!-- {/if} -->
    </div>
</div>

<style>

/* .headContainer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
} */

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