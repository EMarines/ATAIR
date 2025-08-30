<script lang='ts'>
  import { InputOptions, CardProperty, Button, InputText, InputNumber } from "$components/index";
  import { typeProperties, operTypes, contStage, range } from '$lib/parameters';
  import type { Property } from '$lib/types';  
  import { propertiesStore } from "$lib/stores/dataStore";
  import { convertOperation, ranPrice } from '$functions/index'
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import { db } from '$lib/firebase';
  import { collection, getDocs } from 'firebase/firestore';
  import { requireAuth } from '$lib/firebase/authGuard';
  import { onMount } from 'svelte';

  // Objeto para almacenar los criterios de filtro
  let reqFiltro: Partial<Property> = {
    selecTP: '', // Valor inicial para Tipo de Propiedad
    selecTO: '',
    range: '',
    budget: 0, // Definido explícitamente como string
    // Valor inicial para Tipo de Operación
    // Aquí añadirías más propiedades de filtro a medida que agregues inputs
    // Ejemplo: priceMin: undefined, numRooms: undefined, etc.
  };

  // Estados para descarga
  let downloading = false;
  let downloadStatus = '';

  onMount(async () => {
    // Verificar autenticación
    await requireAuth();
  });


  // Array para almacenar las propiedades que coinciden con los filtros
  let propToRender: Property[] = []; 
  // Booleano para controlar la visibilidad de la sección de resultados
  let showProperties: boolean = false;

  // Función para filtrar las propiedades basadas en reqFiltro
  function findPropertiesForFilter() {
    let filteredList = $propertiesStore;
    console.log(reqFiltro); 

    if (reqFiltro.selecTP) { 
      filteredList = filteredList.filter(item => item.selecTP === reqFiltro.selecTP);
    }
   
    if (reqFiltro.selecTO) { 
      filteredList = filteredList.filter(item => convertOperation(item.selecTO) === reqFiltro.selecTO);
    }

    

    if(reqFiltro.range) {
      filteredList = filteredList.filter(item => ranPrice(item.price) === reqFiltro.range)
    }
    // Actualizar la lista de propiedades para renderizar y mostrar la sección
    propToRender = filteredList;
    showProperties = true; 
  }

  // Manejador para cuando cambia un valor en cualquier InputOptions
  async function handleFilterChange() {
    // Esperar al siguiente ciclo de actualización del DOM para asegurar que 
    // bind:value haya actualizado reqFiltro
    await tick(); 
    
    // Volver a ejecutar la lógica de filtrado
    findPropertiesForFilter(); 
  }

  function cleanSearch() {
    reqFiltro = { 
      selecTP: '',
      selecTO: '',
      range: '',
      budget: 0
    };
    showProperties = false;
    propToRender = [];
  }

  function onCancel() {
    goto('/');
  }

  /**
   * Descarga toda la colección de contactos en formato JSON
   */
  async function downloadContacts() {
    if (downloading) return;
    
    downloading = true;
    downloadStatus = 'Descargando contactos...';
    
    try {
      console.log('📥 Iniciando descarga de contactos...');
      
      // Obtener todos los documentos de la colección contacts
      const contactsSnapshot = await getDocs(collection(db, 'contacts'));
      const contacts = contactsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Crear el objeto de exportación con metadatos
      const exportData = {
        collectionName: 'contacts',
        exportDate: new Date().toISOString(),
        totalRecords: contacts.length,
        data: contacts
      };

      // Generar archivo JSON para descarga
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Crear elemento de descarga
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      downloadStatus = `✅ ${contacts.length} contactos descargados exitosamente`;
      console.log('✅ Descarga de contactos completada');
      
    } catch (error) {
      console.error('❌ Error descargando contactos:', error);
      downloadStatus = `❌ Error: ${error.message}`;
    } finally {
      downloading = false;
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => {
        downloadStatus = '';
      }, 3000);
    }
  }

  /**
   * Descarga toda la colección de binnacles (bitácoras) en formato JSON
   */
  async function downloadBinnacles() {
    if (downloading) return;
    
    downloading = true;
    downloadStatus = 'Descargando bitácoras...';
    
    try {
      console.log('📥 Iniciando descarga de bitácoras...');
      
      // Obtener todos los documentos de la colección binnacles
      const binnaclesSnapshot = await getDocs(collection(db, 'binnacles'));
      const binnacles = binnaclesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Crear el objeto de exportación con metadatos
      const exportData = {
        collectionName: 'binnacles',
        exportDate: new Date().toISOString(),
        totalRecords: binnacles.length,
        data: binnacles
      };

      // Generar archivo JSON para descarga
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Crear elemento de descarga
      const a = document.createElement('a');
      a.href = url;
      a.download = `binnacles_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      downloadStatus = `✅ ${binnacles.length} bitácoras descargadas exitosamente`;
      console.log('✅ Descarga de bitácoras completada');
      
    } catch (error) {
      console.error('❌ Error descargando bitácoras:', error);
      downloadStatus = `❌ Error: ${error.message}`;
    } finally {
      downloading = false;
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => {
        downloadStatus = '';
      }, 3000);
    }
  }

  /**
   * Descarga ambas colecciones en un solo archivo
   */
  async function downloadAllData() {
    if (downloading) return;
    
    downloading = true;
    downloadStatus = 'Descargando todos los datos...';
    
    try {
      console.log('📥 Iniciando descarga completa...');
      
      // Obtener ambas colecciones en paralelo
      const [contactsSnapshot, binnaclesSnapshot] = await Promise.all([
        getDocs(collection(db, 'contacts')),
        getDocs(collection(db, 'binnacles'))
      ]);

      const contacts = contactsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const binnacles = binnaclesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Crear el objeto de exportación completo
      const exportData = {
        exportDate: new Date().toISOString(),
        totalContacts: contacts.length,
        totalBinnacles: binnacles.length,
        collections: {
          contacts: {
            collectionName: 'contacts',
            totalRecords: contacts.length,
            data: contacts
          },
          binnacles: {
            collectionName: 'binnacles',
            totalRecords: binnacles.length,
            data: binnacles
          }
        }
      };

      // Generar archivo JSON para descarga
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Crear elemento de descarga
      const a = document.createElement('a');
      a.href = url;
      a.download = `full_database_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      downloadStatus = `✅ Descarga completa: ${contacts.length} contactos y ${binnacles.length} bitácoras`;
      console.log('✅ Descarga completa finalizada');
      
    } catch (error) {
      console.error('❌ Error en descarga completa:', error);
      downloadStatus = `❌ Error: ${error.message}`;
    } finally {
      downloading = false;
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => {
        downloadStatus = '';
      }, 3000);
    }
  }

</script>

<div class="container">
  <h1 class="title">Filtros y Descargas</h1>

  <!-- Sección de Descargas -->
  <div class="download-section">
    <h2 class="section-title">📥 Descargar Colecciones</h2>
    <p class="section-description">Descarga todos los datos de las colecciones en formato JSON</p>
    
    {#if downloadStatus}
      <div class="download-status" class:success={downloadStatus.includes('✅')} class:error={downloadStatus.includes('❌')}>
        {downloadStatus}
      </div>
    {/if}

    <div class="download-buttons">
      <Button
        element="button"
        type="button"
        variant="solid"
        name="Descargar Contactos"
        disabled={downloading}
        on:click={downloadContacts}
      >
        {downloading ? '⏳ Descargando...' : '👥 Descargar Contactos'}
      </Button>

      <Button
        element="button"
        type="button"
        variant="solid"
        name="Descargar Bitácoras"
        disabled={downloading}
        on:click={downloadBinnacles}
      >
        {downloading ? '⏳ Descargando...' : '📋 Descargar Bitácoras'}
      </Button>

      <Button
        element="button"
        type="button"
        variant="solid"
        name="Descargar Todo"
        disabled={downloading}
        on:click={downloadAllData}
      >
        {downloading ? '⏳ Descargando...' : '🗂️ Descargar Todo'}
      </Button>
    </div>
  </div>

  <!-- Separador -->
  <div class="separator"></div>

  <!-- Sección de Filtros existente -->
  <h2 class="section-title">🔍 Filtros de Propiedades</h2>

  <div class="buttons">
    <Button
      element="button"
      type="button"
      variant="solid"
      name="Buscar"
      on:click={cleanSearch}
      >Limpiar busqueda
    </Button>
    
     <Button
        element="button"
        type="button"
        variant="danger"
        on:click={onCancel}
    >
        Cancelar
    </Button>
  </div>  

  <div class="options">
    <InputOptions
        identificador="selecTP"
        name="Tipo de Propiedad"
        choices={typeProperties}
        bind:value={reqFiltro.selecTP}
        on:change={handleFilterChange}
    />


    <InputOptions
        identificador="selecTO"
        name="Tipo de Operacion"
        choices={operTypes}
        bind:value={reqFiltro.selecTO}
        on:change={handleFilterChange}
    />

    <InputNumber 
      identifier="budget" 
      name="Presupuesto" 
      bind:value={reqFiltro.budget}
      on:change={handleFilterChange}
    />

    <InputOptions 
        identificador="range" 
        name="Rango" 
        choices={range} 
        bind:value={reqFiltro.range }
        on:change={handleFilterChange}
    />

  </div>

  {#if showProperties}
    {#if propToRender && propToRender.length > 0}
      <div class="properties__contanier">
        <h3 class="title">{propToRender.length} Propiedades Encontradas</h3>
        {#each propToRender as propertyItem}
          <div class="card-wrapper"> 
            <CardProperty property={propertyItem} />
          </div>
        {/each}
      </div>
    {:else}
      <p>No se encontraron propiedades con los filtros seleccionados.</p>
    {/if}
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
    font-family: 'Arial', sans-serif;
  }

  .title {
    text-align: center;
    color: #333;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.5rem;
    color: #444;
    margin-bottom: 1rem;
    text-align: center;
  }

  .section-description {
    text-align: center;
    color: #666;
    margin-bottom: 1.5rem;
    font-style: italic;
  }

  .download-section {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 2rem;
    margin-bottom: 2rem;
    border: 2px solid #e9ecef;
  }

  .download-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .download-status {
    text-align: center;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    font-weight: bold;
    background: #e3f2fd;
    color: #1976d2;
    border: 2px solid #bbdefb;
  }

  .download-status.success {
    background: #e8f5e8;
    color: #2e7d32;
    border-color: #a5d6a7;
  }

  .download-status.error {
    background: #ffebee;
    color: #c62828;
    border-color: #ef9a9a;
  }

  .separator {
    height: 2px;
    background: linear-gradient(90deg, transparent, #ddd, transparent);
    margin: 2rem 0;
  }

  .options {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .properties__contanier {
    margin-top: 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .properties__contanier .title { /* Estilo para el subtítulo de propiedades encontradas */
    grid-column: 1 / -1; 
    font-size: 1.2rem;
    color: #555;
    margin-bottom: 1rem;
    text-align: left; /* O center, según preferencia */
  }

  /* .card-wrapper { */
    /* Estilos para el contenedor de cada CardProperty si es necesario */
  /* } */

  p { /* Estilo para el mensaje de "No se encontraron propiedades" */
    text-align: center;
    color: #777;
    font-size: 1rem;
    margin-top: 2rem;
  }
</style>