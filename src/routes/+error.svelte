<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // Redirigir a la página principal en caso de error 404
  onMount(() => {
    if (browser && $page.status === 404) {
      // Esperar un momento y luego redirigir
      setTimeout(() => {
        goto('/');
      }, 100);
    }
  });
</script>

<div class="error-container">
  <h1>{$page.status}: {$page.error?.message || 'Error'}</h1>
  
  {#if $page.status === 404}
    <p>La página que estás buscando no existe. Redirigiendo a la página principal...</p>
  {:else}
    <p>Ha ocurrido un error inesperado. Por favor, intenta nuevamente.</p>
  {/if}
  
  <div class="actions">
    <a href="/" class="button">Ir a la página principal</a>
  </div>
</div>

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: 0 20px;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  .actions {
    margin-top: 2rem;
  }
  
  .button {
    background-color: #4a6da7;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
    display: inline-block;
  }
  
  .button:hover {
    background-color: #3a5a8f;
  }
</style>
