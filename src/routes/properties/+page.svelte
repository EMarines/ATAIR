<script lang="ts">
  import { contactsStore, propertiesStore } from '$lib/stores/dataStore';
  import { CardProperty, Search } from '$components';
  import type { Property } from '$lib/types';
  import { goto } from '$app/navigation';

  let searchTerm = "";
  let selectedSource: 'all' | 'easybroker' | 'synergy' | 'external' = 'all';

  // Filtrado reactivo por origen y término de búsqueda
  $: filteredProperties = [...$propertiesStore]
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
    .filter((prop) => {
      // 1. Filtro por origen
      if (selectedSource === 'easybroker' && prop.source !== 'easybroker' && !prop.public_id?.startsWith('EB-')) {
        return false;
      }
      if (selectedSource === 'synergy' && prop.source !== 'synergy') {
        return false;
      }
      if (selectedSource === 'external' && prop.source !== 'external') {
        return false;
      }

      // 2. Filtro por término de búsqueda
      if (!searchTerm.trim()) return true;

      const title = prop.title || '';
      const description = prop.description || '';
      const publicId = prop.public_id || '';
      const location = typeof prop.location === 'string' ? prop.location : (prop.location?.name || '');
      
      const contInfo = (title + " " + description + " " + publicId + " " + location)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      return contInfo.includes(
        searchTerm
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      );
    });

  // Contadores reactivos
  $: totalCount = $propertiesStore.length;
  $: ebCount = $propertiesStore.filter(p => p.source === 'easybroker' || p.public_id?.startsWith('EB-')).length;
  $: synergyCount = $propertiesStore.filter(p => p.source === 'synergy').length;
  $: externalCount = $propertiesStore.filter(p => p.source === 'external').length;

  function seleProperty(prop: Property) {
    goto("/property/" + prop.public_id);
  }
</script>
 
  <!-- Renderización -->
  <div class="mainContainer">
      
    <div class="title__head">
      <h1 class="title">Propiedades</h1>
      
      <!-- Selector de Origen / Fuente -->
      <div class="source-tabs">
        <button 
          class="source-tab" 
          class:active={selectedSource === 'all'} 
          on:click={() => selectedSource = 'all'}
        >
          Todas <span class="tab-badge">{totalCount}</span>
        </button>
        <button 
          class="source-tab" 
          class:active={selectedSource === 'easybroker'} 
          on:click={() => selectedSource = 'easybroker'}
        >
          MatchHome <span class="tab-badge">{ebCount}</span>
        </button>
        {#if synergyCount > 0}
          <button 
            class="source-tab" 
            class:active={selectedSource === 'synergy'} 
            on:click={() => selectedSource = 'synergy'}
          >
            Sinergias <span class="tab-badge">{synergyCount}</span>
          </button>
        {/if}
        {#if externalCount > 0}
          <button 
            class="source-tab" 
            class:active={selectedSource === 'external'} 
            on:click={() => selectedSource = 'external'}
          >
            Externas <span class="tab-badge">{externalCount}</span>
          </button>
        {/if}
      </div>

      <div class="title__inter">
        <Search bind:searchTerm on:input={() => {}} on:keydown={() => {}}/>
      </div>
    </div>

    <div class="card__container">
      {#each filteredProperties as prop}
        <div class="card__prop"
          on:click={() => seleProperty(prop)} 
          on:keydown={() => seleProperty(prop)}
          role="button"
          tabindex="0"
        >
          <CardProperty property={prop} />
        </div>
      {:else}
        <div class="empty-state">
          <p>No se encontraron propiedades con los criterios seleccionados.</p>
        </div>
      {/each}  
    </div>
    
  </div>


<style>

.mainContainer {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px;
  align-items: center;
}

.title__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 1rem;
}

.title__inter {
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-around;
  align-items: center;
  padding: 0 1rem;
}

.card__container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  width: 100%;
  gap: 1rem;
  box-sizing: border-box;
}

.card__prop {
  display: flex;
  background-color: transparent;
  /* border-radius: 5px; */
  transition: background-color 0.2s ease;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.card__prop :global(> *) {
  background-color: rgb(31, 31, 31);
  border-radius: 5px;
  width: 100%;
  height: 100%;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
}

.card__prop:hover :global(> *) {
  background-color: rgb(63, 63, 63);
}

.source-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.source-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  color: #ccc;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.source-tab:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.source-tab.active {
  background: #6b21a8;
  border-color: #9333ea;
  color: #fff;
  font-weight: 500;
}

.tab-badge {
  background: rgba(0, 0, 0, 0.35);
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  font-size: 0.75rem;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  color: #888;
  font-size: 0.95rem;
}

@media (max-width: 768px) {
  .title__inter {
    flex-direction: column;
    gap: 1rem;
  }

  .card__container {
    grid-template-columns: 1fr;
    padding: 0.5rem;
  }
}

</style>