<script lang='ts'>
  import { InputOptions, CardProperty, Button, InputText, InputNumber } from "$components/index";
  import { typeProperties, operTypes, contStage, range } from '$lib/parameters';
  import type { Property } from '$lib/types';  
  import { propertiesStore } from "$lib/stores/dataStore";
  import { convertOperation, ranPrice } from '$functions/index'
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';

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

</script>

<div class="container">
  <h1 class="title">Filtros</h1>

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