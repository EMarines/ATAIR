<script lang="ts">
 
import { createEventDispatcher } from 'svelte';

export let identificador: string; 
export let name: string;	
export let choices: string[] = [];  
export let value: string = ''; // Esta es la prop que 'bind:value' en el padre usa

const dispatch = createEventDispatcher();

function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    value = target.value; // ACTUALIZAR la prop 'value' del componente
    dispatch('change', value); // Despachar el evento con el nuevo valor
                               // Svelte usa este evento para actualizar la variable en bind:value del padre
}
    
</script>
<div class="cont">

  <label class="label__title" for={identificador}>

    <p class={value ? ' above' : ' center'}>{name}</p>
    
    <select 
        class="in__sel" 
        id={identificador} 
        value={value}
        on:change={handleChange} 
    >
  
      <option value="">{name}</option> 
      
      {#each choices as choice}
        {#if choice !== ""}
          <option value={choice}>{choice}</option>
        {/if}
      {/each}
    </select>	

  </label>

  {#if value}
    <div class="sub-content">
      <slot></slot>
    </div>
  {/if}

</div>

<style>

  .cont {
    position: relative;
  }

  .sub-content {
    margin-top: 0.5rem;
  }

</style>