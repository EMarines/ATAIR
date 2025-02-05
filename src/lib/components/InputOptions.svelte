<script lang="ts">
 
import { createEventDispatcher } from 'svelte';

export let identificador: string; 
export let name: string;	
export let choices: string[] = [];  
export let value: string = '';

const dispatch = createEventDispatcher();

function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    dispatch('change', target.value);
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
      <option disabled selected value="">{name}</option>
      {#each choices as choice}
        <option value={choice}>{choice}</option>
      {/each}
    </select>	

  </label>

</div>

<style>

  .cont {
    position: relative;
  }

  </style>