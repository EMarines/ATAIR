<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let value: number | string | undefined = undefined; // El valor numérico real
  export let identifier: string;
  export let name: string;
  export let placeholder: string = ''; 

  const dispatch = createEventDispatcher();
  let displayValue: string = ''; // Lo que se muestra en el input

  // Actualizar las funciones para manejar ambos tipos de datos
  function formatNumberWithCommas(num: number | string | undefined | null): string {
    if (num === undefined || num === null || isNaN(Number(num))) {
      return '';
    }
    return Number(num).toLocaleString('en-US');
  }

  function parseFormattedNumber(str: string): number | string | undefined {
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

  // Ajustar la lógica para evitar que `0` se muestre por defecto
  $: displayValue = value !== undefined && value !== null && value !== '' ? String(value) : ''; // Asegurar que displayValue refleje siempre el valor actual
  
  // Inicializar displayValue cuando el componente se monta,
  // en caso de que 'value' tenga un valor inicial.
  // onMount(() => {
  //   displayValue = formatNumberWithCommas(value);
  // });

  // Revisar y ajustar el evento `on:input` para evitar conflictos
  function handleInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const currentRawInputValue = inputElement.value;

    // Actualizar displayValue directamente para reflejar el texto ingresado
    displayValue = currentRawInputValue;

    // Actualizar `value` solo si cambia
    if (value !== currentRawInputValue) {
      value = currentRawInputValue;
      dispatch('input', value);
      dispatch('change', value);
    }
  }

  function handleBlur() {
    // Validar y limpiar el valor al salir del campo
    if (value === undefined || value === null || value === '') {
      displayValue = ''; // Mostrar vacío si no hay valor
    } else {
      displayValue = String(value).trim(); // Asegurar que el valor sea una cadena limpia
    }
    dispatch('blur', value);
  }

</script>

<label class="label__title" for={identifier} >
  <p class={value ? ' above' : ' center'}>{name}</p>
  <input 
    id={identifier} 
    class="in__sel"  
    type="text" 
    value={displayValue} 
    placeholder={placeholder || name} 
    on:input={handleInput}
    on:blur={handleBlur}
  />
</label>
