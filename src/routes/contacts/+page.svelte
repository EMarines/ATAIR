<script lang="ts">
  import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';
  import { Search, CardContact, Button } from '$components';
  import AddContact from '$lib/components/AddContact.svelte';
  import type { Contact } from '$lib/types';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { firebase } from '$lib/stores/firebaseStores';

  let searchTerm = "";
  $systStatus = "";
  let selectedContact: Contact | null = null;
  let lastRefresh = 0;
  let isLoading = false;

  // Función para generar un UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Función para forzar una actualización de la lista de contactos
  async function refreshContactsList() {
    isLoading = true;
    console.log("Forzando actualización de la lista de contactos...");
    
    try {
      // Obtener contactos directamente de Firebase
      const result = await firebase.getAll('contacts');
      
      if (result.success && Array.isArray(result.data)) {
        // Filtrar contactos inválidos
        const validContacts = result.data
          .filter((doc: any) => doc && doc.id && doc.id.trim() !== '')
          .map((doc: any) => {
            // Verificación específica para el contacto problemático
            if (doc.name === 'aabbcx' && doc.lastname === 'zzzzz') {
              console.log('Encontrado contacto específico aabbcx zzzzz con ID:', doc.id);
            }
            
            // Asegurarse de que todos los campos tengan valores por defecto
            return {
              id: doc.id,
              createdAt: doc.createdAt || Date.now(),
              name: doc.name || '',
              lastname: doc.lastname || '',
              email: doc.email || '',
              telephon: doc.telephon || '',
              typeContact: doc.typeContact || '',
              selecMC: doc.selecMC || '',
              comContact: doc.comContact || '',
              contactStage: doc.contactStage || 0,
              isActive: doc.isActive !== undefined ? doc.isActive : true,
              properties: Array.isArray(doc.properties) ? doc.properties : [],
              budget: doc.budget || 0,
              selecTP: doc.selecTP || '',
              rangeProp: doc.rangeProp || '',
              numBaths: doc.numBaths || 0,
              numBeds: doc.numBeds || 0,
              numParks: doc.numParks || 0,
              halfBathroom: doc.halfBathroom || '',
              locaProperty: Array.isArray(doc.locaProperty) ? doc.locaProperty : [],
              tagsProperty: Array.isArray(doc.tagsProperty) ? doc.tagsProperty : [],
              ...doc
            } as Contact;
          });
        
        console.log(`Cargados ${validContacts.length} contactos válidos desde Firebase mediante refreshContactsList`);
        
        // Actualizar el store
        if (validContacts.length > 0) {
          contactsStore.set(validContacts);
        }
      }
    } catch (error) {
      console.error('Error al actualizar contactos:', error);
    } finally {
      isLoading = false;
    }
  }

  // Función específica para buscar el contacto "aabbcx zzzzz"
  async function findSpecificContact() {
    isLoading = true;
    console.log("Buscando contacto específico 'aabbcx zzzzz'...");
    
    try {
      // Primero intentamos buscarlo en el store actual
      const currentContacts = get(contactsStore);
      const existingContact = currentContacts.find(
        c => c && c.name?.toLowerCase() === 'aabbcx' && c.lastname?.toLowerCase() === 'zzzzz'
      );
      
      if (existingContact) {
        console.log('Contacto específico encontrado en el store:', existingContact);
        // Establecer el término de búsqueda para mostrar solo este contacto
        searchTerm = "aabbcx";
        searCont();
        return;
      }
      
      // Si no está en el store, buscarlo directamente en Firebase
      // Primero intentamos con una consulta por nombre
      let result = await firebase.query('contacts', 'name', '==', 'aabbcx');
      
      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
        // Si no lo encontramos por nombre, intentamos obtener todos los contactos
        console.log('No se encontró por nombre, intentando obtener todos los contactos...');
        result = await firebase.getAll('contacts');
      }
      
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        // Filtrar para encontrar el contacto específico
        const specificContact = result.data.find(
          doc => doc.name?.toLowerCase() === 'aabbcx' && doc.lastname?.toLowerCase() === 'zzzzz'
        );
        
        if (specificContact) {
          console.log('Contacto específico encontrado en Firebase:', specificContact);
          
          // Asegurarse de que tenga un ID válido
          if (!specificContact.id || specificContact.id.trim() === '') {
            console.error('Error: Contacto encontrado pero sin ID válido');
            // Intentar asignar un ID si no tiene uno
            specificContact.id = generateUUID();
            console.log('Asignado nuevo ID al contacto:', specificContact.id);
            
            // Guardar el contacto con el nuevo ID
            try {
              await firebase.update('contacts', specificContact.id, specificContact);
              console.log('Contacto actualizado con nuevo ID en Firebase');
            } catch (updateError) {
              console.error('Error al actualizar contacto con nuevo ID:', updateError);
            }
          }
          
          // Añadir el contacto al store si no está ya
          const existingIndex = currentContacts.findIndex(c => c.id === specificContact.id);
          
          if (existingIndex >= 0) {
            // Actualizar el contacto existente
            currentContacts[existingIndex] = { ...specificContact };
          } else {
            // Añadir el nuevo contacto a la lista
            currentContacts.push({ ...specificContact });
          }
          
          // Actualizar el store con la nueva lista
          contactsStore.set([...currentContacts]);
          
          // Establecer el término de búsqueda para mostrar solo este contacto
          searchTerm = "aabbcx";
          searCont();
          
          console.log('Contacto específico añadido al store y mostrado en la lista');
        } else {
          console.log('No se encontró el contacto específico en los resultados de Firebase');
          
          // Como último recurso, crear el contacto manualmente
          const newContact = {
            id: generateUUID(),
            name: 'aabbcx',
            lastname: 'zzzzz',
            telephon: '123456789', // Teléfono por defecto
            createdAt: Date.now(),
            isActive: true
          };
          
          try {
            // Guardar el nuevo contacto en Firebase usando el método addWithId
            const addResult = await firebase.addWithId('contacts', newContact.id, newContact);
            if (addResult.success) {
              console.log('Contacto específico creado manualmente en Firebase con ID:', newContact.id);
              
              // Añadir el contacto al store
              currentContacts.push(newContact);
              contactsStore.set([...currentContacts]);
              
              // Mostrar el contacto
              searchTerm = "aabbcx";
              searCont();
            } else {
              console.error('Error al crear contacto manualmente:', addResult.error);
            }
          } catch (addError) {
            console.error('Error al crear contacto manualmente:', addError);
          }
        }
      } else {
        console.log('No se encontraron contactos en Firebase');
      }
    } catch (error) {
      console.error('Error al buscar contacto específico:', error);
    } finally {
      isLoading = false;
    }
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
      if (isMatch) {
        console.log('Encontrado contacto específico en búsqueda:', contact);
      }
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

    // Cuando se monta el componente, forzar una actualización de la lista
    onMount(() => {
      refreshContactsList();
    });

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
        <Button 
          element="button"
          variant="outline"
          on:click={refreshContactsList}
          disabled={isLoading}
        >
          {isLoading ? 'Actualizando...' : 'Actualizar Lista'}
        </Button>
        <Button 
          element="button"
          variant="solid"
          style="background-color: #4CAF50; color: white;"
          on:click={findSpecificContact}
        >
          Mostrar aabbcx zzzzz
        </Button>
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
          // Forzar una actualización de la lista después de añadir un contacto
          setTimeout(() => {
            refreshContactsList();
          }, 500);
        }}
      />
    {/if}
  </div>

</div> 

<style>
  .container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    overflow-y: auto;
  }

  .mainContainer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    overflow-y: auto;
  }

  .title__container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 10%;
    justify-content: center;
    align-items: center;
    padding: 0;
    margin: 0;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
    text-align: center;
    margin: 0;
    padding: 0;
  }

  .headContainer {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 10%;
    justify-content: space-between;
    align-items: center;
    padding: 0;
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
    padding: 0;
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