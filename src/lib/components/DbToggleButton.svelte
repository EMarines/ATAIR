<script lang="ts">
  import { useTestDb } from '$lib/firebase_toggle';
  import { browser } from '$app/environment';
  
  // Etiquetas para mostrar qué base de datos estamos usando
  $: dbLabel = $useTestDb ? 'Modo Prueba' : 'Match Home';
  $: dbIcon = $useTestDb ? '🔄' : '🔥';
</script>

{#if browser}
  <div class="db-toggle">
    <button on:click={() => useTestDb.toggle()} class="toggle-btn">
      <span class="db-icon">{dbIcon}</span>
      <span class="db-label">{dbLabel}</span>
    </button>
  </div>
{/if}

<style>
  .db-toggle {
    margin-right: 15px;
    display: flex;
    align-items: center;
  }
  
  .toggle-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: none;
    border: 1px solid #ddd;
    border-radius: 5px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  
  .toggle-btn:hover {
    background-color: #f0f0f0;
  }
  
  .db-icon {
    font-size: 16px;
    margin-bottom: 2px;
  }
  
  .db-label {
    font-size: 10px;
    color: #a1a1a1;
  }
</style>
