<script lang="ts">
import { createEventDispatcher } from 'svelte';

export let identificador: string;
export let name: string;
export let value: number = 0;
export let step: number = 1000;
export let min: number = 0;

const dispatch = createEventDispatcher();

function formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    // Removemos las comas para procesar el número
    const rawValue = target.value.replace(/,/g, '');
    const numValue = rawValue ? parseInt(rawValue) : 0;
    
    // Actualizamos el valor del input con el formato
    if (rawValue) {
        target.value = formatNumber(numValue);
    }
    
    dispatch('change', numValue);
}

</script>

<div class="cont">
    <label class="label__title" for={identificador}>
        <p class={value ? ' above' : ' center'}>{name}</p>
        <input 
            type="text"
            class="in__sel"
            {min}
            {step}
            value={formatNumber(value)}
            id={identificador}
            on:input={handleChange}
            placeholder={name}
            inputmode="numeric"
            pattern="[0-9,]*"
        />
    </label>
</div>

<style>
    /* inputs dessigns */
    .above, .center {
        position: absolute;
        transform: translateY(-50%);
        min-width: 150px;
        pointer-events: none;
        border-radius: 4px;
        padding: 0 6px;
        font-size: .8em;
        z-index: 1;
    }

    .above {
        top: 0;
        left: 24px;
        color: whitesmoke;
        background: navy;
        border: 1px solid blue;
        font-size: .7em;
    }

    .center {
        top: 50%;
        left: 6px;
        border: 1px solid transparent;
        opacity: 0;
    }

    .label__title {
        position: relative; 
        border: 1px solid navy;
        border-radius: 5px;
        padding: 5px 3px 7px 3px;
    }

    .in__sel {  
        padding: 3px 0 3px 5px;
        width: 250px;
        border: none;
        border-radius: 8px;
        font-size: .8em;
        padding: 3px;
        font-weight: 600;
        color: darkblue;    
    }

    /* Quitar flechas del input number */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .cont {
        position: relative;
        display: inline-block;
    }
</style> 