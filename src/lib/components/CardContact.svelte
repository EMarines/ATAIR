<script lang="ts">
  import { toComaSep, toTele } from '$lib/functions/format'
  import { formatDate } from '$lib/functions/dateFunctions'
  import type { Contact } from '$lib/types';
  import { onMount } from 'svelte';

  export let cont: Contact;
  
  // Validación del contacto
  let isValidContact = false;
  
  // Función para validar el contacto
  function validateContact() {
    // Verificar que el contacto exista y tenga un ID válido
    if (!cont || !cont.id || typeof cont.id !== 'string' || cont.id.trim() === '') {
      console.error('Error: Contacto inválido o sin ID válido', cont);
      isValidContact = false;
      return;
    }
    
    // Contacto válido
    isValidContact = true;
  }
  
  // Validar el contacto cuando cambie
  $: {
    if (cont) {
      validateContact();
    }
  }
  
  onMount(() => {
    validateContact();
  });
</script>

{#if isValidContact}
<div class="card">
  <div class="card__info">
    <div class="card__infoHead">
      <span class="card__Title">{cont.name} {cont.lastname}</span>
      <span class="date">{formatDate(cont.createdAt)}</span>
    </div>
    <div class="info__cont">      
      {#if cont.telephon}
        <span> <i class="fa-solid fa-mobile-screen-button"></i>{toTele(cont.telephon)}</span>
      {/if}
      {#if cont.email }
        <span> <i class="fa-regular fa-envelope"></i> {cont.email} </span>
      {/if}
    </div>
    <div class="info__features">
      {#if cont.budget}
        <span><i class="fa-solid fa-money-check-dollar"></i> $ {toComaSep(Number(cont.budget))}.</span>
      {:else}
        <span> <i class="fa-solid fa-money-check-dollar"></i> {cont.rangeProp}</span>
      {/if}
      <div class="info__tags">
        {#if cont.tagsProperty}
          <span><i class="fa-solid fa-tags to__showR"></i> {cont.tagsProperty.toString().replaceAll(",", ", ")}</span>
        {/if}
        {#if cont.locaProperty}
          <span><i class="fa-sharp fa-regular fa-compass to__showR"></i> {cont.locaProperty.toString().replaceAll(",", ", ")}</span>
        {/if}
      </div>
    </div>
  </div>
</div>
{:else}
  <div class="card card--invalid">
    <div class="card__info">
      <div class="card__infoHead">
        <span class="card__Title">Contacto inválido</span>
      </div>
      <div class="info__cont">
        <span>Este contacto no tiene un ID válido</span>
      </div>
    </div>
  </div>
{/if}

<style>
  /* .card-container {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  } */

  .card {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: rgb(56, 56, 56);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
    gap: 0.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
    height: 100%;
    box-sizing: border-box;
  }

  .card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    background: rgb(76, 76, 76);
  }

  .card--invalid {
    background-color: #553333;
    border: 1px solid #aa5555;
  }

  .card__info {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    font-weight: 400;
    justify-content: space-between;
  }

  .card__Title {
    text-transform: capitalize;
  }

  .card__infoHead {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 30%;
    justify-content: space-around;
  }
</style>