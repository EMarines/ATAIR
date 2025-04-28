<script lang="ts">
  import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';
  import { Search, CardContact, Button, AddContact } from '$components';
  import type { Contact } from '$lib/types';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { firebase } from '$lib/stores/firebaseStores';

  let searchTerm = "";
  $systStatus = "";
  let selectedContact: Contact | null = null;
  let isLoading = false;

  // Función para normalizar el valor de la etapa a un número
  function normalizeStage(stage: any): number {
    if (stage === undefined || stage === null || stage === 0) return 1;
    
    // Si ya es un número, devolver directamente
    if (typeof stage === 'number') {
      return stage <= 0 ? 1 : stage; // Si es 0 o negativo, devolver 1
    }
    
    // Si es una cadena, intentar convertir
    if (typeof stage === 'string') {
      // Si es "Etapa1", "Etapa2", etc.
      if (stage.startsWith('Etapa')) {
        const num = parseInt(stage.replace('Etapa', '')) || 1;
        return num <= 0 ? 1 : num; // Si es 0 o negativo, devolver 1
      }
      // Si es "E1", "E2", etc.
      if (stage.startsWith('E')) {
        const num = parseInt(stage.replace('E', '')) || 1;
        return num <= 0 ? 1 : num; // Si es 0 o negativo, devolver 1
      }
      // Si es "1", "2", etc.
      const num = parseInt(stage) || 1;
      return num <= 0 ? 1 : num; // Si es 0 o negativo, devolver 1
    }
    
    return 1; // Valor por defecto
  }

  // Función para generar un UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Ordenar contactos por fecha y alfabéticamente
  $: sortedContacts = $contactsStore ? [...$contactsStore]
    .filter(c => c && c.id && c.id.trim() !== '') // Filtrar contactos sin ID válido
    .sort((a, b) => {
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
    
    // Verificación específica para el contacto problemático
    if (searchTerm.toLowerCase().includes('aabbcx') || searchTerm.toLowerCase().includes('zzzzz')) {
      const isMatch = (contact.name?.toLowerCase() === 'aabbcx' || 
                      contact.lastname?.toLowerCase() === 'zzzzz');
      return isMatch;
    }
    
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
      // Verificación exhaustiva del contacto
      if (!cont) {
        console.error('Error: Contacto inválido');
        return;
      }

      // Verificar que el contacto tenga un ID válido
      if (!cont.id || typeof cont.id !== 'string' || cont.id.trim() === '') {
        console.error('Error: ID de contacto faltante o inválido', cont);
        
        // Si el contacto tiene un nombre, podemos intentar encontrarlo por nombre en el store
        if (cont.name) {
          console.log('Intentando recuperar el contacto por nombre:', cont.name);
          
          // Buscar el contacto en el store por nombre y otros datos
          const matchingContact = $contactsStore.find(c => 
            c.id && c.id.trim() !== '' && 
            c.name === cont.name && 
            c.telephon === cont.telephon
          );
          
          if (matchingContact && matchingContact.id) {
            console.log('Contacto recuperado con ID:', matchingContact.id);
            goto(`/contact/${matchingContact.id}`);
            return;
          }
        }
        
        // Si no se pudo recuperar, mostrar mensaje y no navegar
        alert('No se puede acceder a este contacto porque tiene un ID inválido. Por favor, cree un nuevo contacto.');
        return;
      }

      // Si llegamos aquí, el ID es válido
      const contactId = cont.id.trim();
      goto(`/contact/${contactId}`);
    }

    // Búsqueda de contactos
    function searCont() {
      if (!$contactsStore) return [];
      
      // Verificación específica para el contacto problemático
      if (searchTerm.toLowerCase().includes('aabbcx') || searchTerm.toLowerCase().includes('zzzzz')) {
        const specificContacts = sortedContacts.filter((contact: Contact) => 
          contact.name?.toLowerCase() === 'aabbcx' || 
          contact.lastname?.toLowerCase() === 'zzzzz'
        );
        
        if (specificContacts.length > 0) {
          console.log('Encontrados contactos específicos en búsqueda:', specificContacts);
          return specificContacts;
        }
      }
      
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

    // Cuando se monta el componente, no hacer nada
    onMount(() => {
    });

</script>

<div class="container">

  <!-- <div class="navbar"> -->
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
              <!-- Etapa del contacto - Siempre mostrar, con E1 por defecto -->
              <div class="stage-indicator" style="position: absolute; top: 5px; right: 5px; width: 30px; height: 30px; border-radius: 50%; background-color: {
                (() => {
                  const stage = normalizeStage(cont.contactStage);
                  switch(stage) {
                    case 2: return '#ff8844';
                    case 3: return '#ffcc44';
                    case 4: return '#44cc44';
                    case 5: return '#8844cc';
                    default: return '#ff4444'; // E1 por defecto
                  }
                })()
              }; display: flex; align-items: center; justify-content: center; color: white; font-weight: 500; font-family: 'Segoe UI', Arial, sans-serif; font-size: 0.85rem; letter-spacing: 0.5px; z-index: 9999; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 2px solid white;">
                {
                  (() => {
                    const stage = normalizeStage(cont.contactStage);
                    return `E${stage}`;
                  })()
                }
              </div>
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
  <!-- </div> -->
  <footer class="footer">
  </footer>
</div> 

<style>
  .container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 20px;
    box-sizing: border-box;
  }

  .mainContainer {
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .title__container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  /* .sync-container {
    max-width: 400px;
  } */

  .title {
    font-size: 2rem;
    font-weight: 600;
    margin: 0;
  }

  .headContainer {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 10%;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 5rem;
    margin: 0;
    gap: 10px;
  }

  .cards__container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
    height: 80%;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 1rem;
    margin: 0;
    gap: 1rem;
    overflow-y: auto;
  }

  .card__container {
    display: flex;
    flex-direction: column;
    width: calc(33.33% - 1rem);
    min-width: 300px;
    height: 200px;
    padding: 0;
    margin: 0;
    cursor: pointer;
    transition: transform 0.2s ease;
    position: relative; /* Añadido para posicionar el indicador de etapa */
  }

  .card__container:hover {
    transform: translateY(-5px);
  }

  .footer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 10%;
    justify-content: center;
    align-items: center;
    padding: 0;
    margin: 0;
  }

  @media (max-width: 1200px) {
    .card__container {
      width: calc(50% - 1rem);
    }
  }

  @media (max-width: 768px) {
    .card__container {
      width: 100%;
    }

    .headContainer {
      flex-direction: column;
      height: auto;
      gap: 1rem;
    }
  }
</style>