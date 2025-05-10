<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let value: number | undefined = undefined; // El valor numérico real
  export let identifier: string;
  export let name: string;
  export let placeholder: string = '0'; 

  const dispatch = createEventDispatcher();
  let displayValue: string = ''; // Lo que se muestra en el input

  // Formatea un número a string con comas
  function formatNumberWithCommas(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) {
      return '';
    }
    return num.toLocaleString('en-US');
  }

  // Parsea un string (con o sin comas) a un número
  function parseFormattedNumber(str: string): number | undefined {
    if (!str) {
      return undefined;
    }
    const cleanedString = str.replace(/[^0-9]/g, ''); // Solo dígitos
    if (cleanedString === '') {
      return undefined;
    }
    const num = Number(cleanedString);
    return isNaN(num) ? undefined : num;
  }

  // Cuando la prop 'value' cambia (desde el padre o internamente),
  // actualiza 'displayValue' para el input.
  $: displayValue = formatNumberWithCommas(value);
  
  // Inicializar displayValue cuando el componente se monta,
  // en caso de que 'value' tenga un valor inicial.
  onMount(() => {
    displayValue = formatNumberWithCommas(value);
  });

  function handleInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const currentRawInputValue = inputElement.value;

    // 1. Parsear lo que el usuario escribió para obtener el número real
    const numericValue = parseFormattedNumber(currentRawInputValue);

    // 2. Actualizar la prop 'value'.
    // Esto hará que la declaración reactiva `$: displayValue = ...` se ejecute,
    // y Svelte actualizará el atributo `value` del <input> en el template.
    value = numericValue;
    
    // 3. Despachar eventos para el componente padre
    dispatch('input', value); 
    dispatch('change', value);
  }

  function handleBlur() {
    // Al salir, asegurarse de que el formato sea el correcto.
    // La declaración reactiva ya debería haberlo hecho, pero esto es una doble seguridad.
    displayValue = formatNumberWithCommas(value);
    dispatch('blur', value);
  }

</script>

<label class="label__title" for={identifier} >
  <p class={(value !== undefined && value !== null && value.toString() !== '') || displayValue !== '' ? ' above' : ' center'}>{name}</p>
  <input 
    id={identifier} 
    class="in__sel"  
    type="text" 
    inputmode="numeric" 
    pattern="[0-9,]*"
    value={displayValue} 
    placeholder={placeholder || name} 
    on:input={handleInput}
    on:blur={handleBlur}
  />
</label>

<style>
  /* Estilos (los mismos que proporcionaste anteriormente) */
  .above, .center {
    position: absolute;
    transform: translateY(-50%);
    min-width: 150px; 
    pointer-events: none;
    border-radius: 4px;
    padding: 0 6px;
    font-size: .8em;
    z-index: 1; 
    background-color: white; 
    transition: top 0.2s ease, font-size 0.2s ease, color 0.2s ease, background-color 0.2s ease;
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
    opacity: 1; 
    color: navy; 
  }
  .label__title {
    position: relative; 
    display: inline-block; 
    border: 1px solid navy;
    border-radius: 5px;
    padding: 5px 3px 7px 3px; 
  }
  .in__sel {  
    padding: 3px 0 3px 5px; 
    width: 250px; 
    border: none; 
    border-radius: 0; 
    font-size: .8em; 
    font-weight: 600; 
    color: darkblue; 
    background-color: transparent; 
    box-sizing: border-box; 
  }
  .in__sel:focus {
    outline: none; 
  }
  .in__sel::placeholder{
    color: navy; 
    opacity: 1; 
  }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  /* input[type=number] {
    -moz-appearance: textfield;
    appearance: textfield;
  } */
</style>