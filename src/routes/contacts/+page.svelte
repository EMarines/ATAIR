<script lang="ts">
  import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';
  import { Search, CardContact, Button, AddContact } from '$components';
  import type { Contact } from '$lib/types';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  // import { get } from 'svelte/store';
  // import { firebase } from '$lib/stores/firebaseStores';

  let searchTerm = "";
  $systStatus = "";
  let selectedContact: Contact | null = null;
  let isLoading = false;

  // Función para normalizar el valor de la etapa a un número
  function normalizeStage(stage: any): number | string {
    // Si es "NA" (Not Active), devolver "NA"
    if (typeof stage === 'string' && stage.toUpperCase() === 'NA') {
      return 'NA';
    }

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

  // Función para determinar el distintivo (Etapa E1-E5 o Sinergia S1-S3/MH) y su forma (Cuadrado para Agente, Círculo para Etapa)
  function getContactBadgeInfo(cont: Contact): { isAgent: boolean; shape: 'circle' | 'square'; text: string; color: string; tooltip: string } {
    if (!cont) return { isAgent: false, shape: 'circle', text: 'E1', color: '#ff4444', tooltip: 'Etapa 1' };
    const raw = cont as any;
    const type = (cont.typeContact || cont.contactType || raw.tipo || '').toLowerCase();
    const notes = (cont.notes || raw.comContact || raw.notas || '').toLowerCase();
    const company = (raw.company || raw.inmobiliaria || '').toLowerCase();

    const isAgent = (
      type.includes('agente') ||
      type.includes('constructor') ||
      type.includes('inmobiliaria') ||
      type.includes('colaborador') ||
      type.includes('asesor') ||
      notes.includes('sinergia') ||
      notes.includes('agente') ||
      notes.includes('constructor') ||
      notes.includes('inmobiliaria') ||
      Boolean(cont.procedencia)
    );

    if (isAgent) {
      let code = (cont.procedencia || '').toUpperCase();
      if (!['S1', 'S2', 'S3', 'MH'].includes(code)) {
        if (notes.includes('sinergia 1') || /\b(s1)\b/i.test(notes)) code = 'S1';
        else if (notes.includes('sinergia 2') || /\b(s2)\b/i.test(notes)) code = 'S2';
        else if (notes.includes('sinergia 3') || /\b(s3)\b/i.test(notes)) code = 'S3';
        else if (notes.includes('match home') || /\b(mh)\b/i.test(notes)) code = 'MH';
        else code = 'S1';
      }

      const roleLabel = type.includes('constructor') ? 'Constructor' : 'Agente Inmobiliario';

      switch (code) {
        case 'S1': return { isAgent: true, shape: 'square', text: 'S1', color: '#10b981', tooltip: `${roleLabel} - Sinergia 1 (S1)` }; // Verde esmeralda S1
        case 'S2': return { isAgent: true, shape: 'square', text: 'S2', color: '#06b6d4', tooltip: `${roleLabel} - Sinergia 2 (S2)` }; // Cian S2
        case 'S3': return { isAgent: true, shape: 'square', text: 'S3', color: '#f59e0b', tooltip: `${roleLabel} - Sinergia 3 (S3)` }; // Ámbar S3
        case 'MH': return { isAgent: true, shape: 'square', text: 'MH', color: '#6366f1', tooltip: `${roleLabel} - Directa Match Home` }; // Índigo MH
        default: return { isAgent: true, shape: 'square', text: code || 'S1', color: '#10b981', tooltip: roleLabel };
      }
    }

    const normalizedStage = normalizeStage(cont.contactStage);
    if (normalizedStage === 'NA') {
      return { isAgent: false, shape: 'circle', text: 'NA', color: '#808080', tooltip: 'Sin etapa asignada' };
    }
    switch(normalizedStage) {
      case 2: return { isAgent: false, shape: 'circle', text: 'E2', color: '#ff8844', tooltip: 'Etapa 2' }; // Naranja
      case 3: return { isAgent: false, shape: 'circle', text: 'E3', color: '#ffcc44', tooltip: 'Etapa 3' }; // Amarillo
      case 4: return { isAgent: false, shape: 'circle', text: 'E4', color: '#44cc44', tooltip: 'Etapa 4' }; // Verde
      case 5: return { isAgent: false, shape: 'circle', text: 'E5', color: '#8844cc', tooltip: 'Etapa 5' }; // Púrpura
      default: return { isAgent: false, shape: 'circle', text: `E${normalizedStage}`, color: '#ff4444', tooltip: 'Etapa 1' }; // Rojo E1
    }
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
    // if (searchTerm.toLowerCase().includes('aabbcx') || searchTerm.toLowerCase().includes('zzzzz')) {
    //   const isMatch = (contact.name?.toLowerCase() === 'aabbcx' || 
    //                   contact.lastname?.toLowerCase() === 'zzzzz');
    //   return isMatch;
    // }
    
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
            {@const badge = getContactBadgeInfo(cont)}
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
              <!-- Distintivo en la esquina superior derecha: CUADRADO para Agentes (S1/S2/S3/MH) y CÍRCULO para Clientes (E1-E5) -->
              <div
                class="stage-indicator"
                title={badge.tooltip}
                style="
                  position: absolute;
                  top: 5px;
                  right: 5px;
                  width: 32px;
                  height: 32px;
                  border-radius: {badge.shape === 'square' ? '6px' : '50%'};
                  background-color: {badge.color};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: 700;
                  font-family: 'Segoe UI', Arial, sans-serif;
                  font-size: 0.82rem;
                  letter-spacing: 0.5px;
                  z-index: 9999;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.35);
                  border: 2px solid white;
                "
              >
                {badge.text}
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