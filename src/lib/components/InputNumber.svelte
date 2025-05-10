<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let value: number | undefined = undefined; // El valor numérico real
  export let identifier: string;
  export let name: string;
  export let placeholder: string = '0'; // Placeholder para el input

  const dispatch = createEventDispatcher();

  // Estado local para el valor mostrado en el input (formateado con comas)
  let displayValue: string = '';

  // Función para formatear un número a un string con comas
  function formatNumberWithCommas(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) {
      return '';
    }
    return num.toLocaleString('en-US'); // 'en-US' usa comas como separadores
  }

  // Función para parsear un string (con comas) a un número
  function parseFormattedNumber(str: string): number | undefined {
    if (!str) {
      return undefined;
    }
    const cleanedString = str.replace(/,/g, ''); // Quitar comas
    if (cleanedString === '' || isNaN(Number(cleanedString))) {
      return undefined;
    }
    return Number(cleanedString);
  }

  // Sincronizar displayValue cuando 'value' (la prop) cambia desde el exterior
  $: if (value !== parseFormattedNumber(displayValue)) {
    displayValue = formatNumberWithCommas(value);
  }
  
  // Inicializar displayValue cuando el componente se monta
  onMount(() => {
    displayValue = formatNumberWithCommas(value);
  });

  function handleInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    let rawValue = inputElement.value;

    // Permitir solo dígitos (quitar comas y otros no dígitos para el parseo)
    const cleanedValue = rawValue.replace(/[^0-9]/g, '');
    
    let numericValue: number | undefined;
    if (cleanedValue === '') {
      numericValue = undefined;
    } else {
      numericValue = parseInt(cleanedValue, 10);
      if (isNaN(numericValue)) {
        numericValue = undefined;
      }
    }

    value = numericValue; // Actualizar la prop 'value'
    displayValue = formatNumberWithCommas(numericValue); // Formatear para la visualización
    
    // Actualizar el valor del input visualmente.
    // Considerar que esto puede afectar la posición del cursor.
    inputElement.value = displayValue;

    dispatch('input', value);
    dispatch('change', value);
  }

  function handleBlur() {
    // Asegurar que el displayValue esté formateado correctamente al perder el foco
    displayValue = formatNumberWithCommas(value);
  }

</script>

<div class="cont-input-number"> 
  <label class="label-wrapper" for={identifier}>
    <p class="floating-label {(value !== undefined && value !== null && value.toString() !== '') || displayValue !== '' ? 'above' : 'center'}">
      {name}
    </p>
    <input
      type="text"  
      inputmode="numeric" 
      pattern="[0-9,]*"
      id={identifier}
      bind:value={displayValue} 
      on:input={handleInput}
      on:blur={handleBlur}
      placeholder={placeholder}
      class="input-field" 
    />
  </label>
</div>

<style>
  /* 
    ESTILOS DE EJEMPLO PARA INPUTNUMBER - AJUSTA ESTOS VALORES PARA QUE COINCIDAN CON TU INPUTTEXT.SVELTE
    Fíjate en propiedades como: color, background-color, border, border-radius, padding, font-size,
    font-family, y los detalles de la animación de la etiqueta.
  */

  .cont-input-number {
    position: relative;
    display: inline-block; /* O 'block' si quieres que ocupe todo el ancho */
    /* margin-bottom: 1rem;  Ajusta el margen si es necesario */
  }

  .label-wrapper {
    position: relative; 
    display: block; /* Para que el label contenga bien el input */
    border: 1px solid #cccccc; /* Ejemplo: Borde del InputText */
    border-radius: 4px;      /* Ejemplo: Radio del borde del InputText */
    padding: 0; /* El padding interno lo manejará el input y la posición de la etiqueta */
    background-color: #ffffff; /* Ejemplo: Fondo del InputText */
  }

  .floating-label {
    position: absolute;
    left: 10px; /* Ejemplo: Posición horizontal de la etiqueta */
    pointer-events: none;
    transition: top 0.2s ease, font-size 0.2s ease, color 0.2s ease;
    background-color: #ffffff; /* Debe coincidir con el fondo de .label-wrapper para el efecto flotante */
    padding: 0 4px; /* Espaciado alrededor del texto de la etiqueta */
    color: #757575; /* Ejemplo: Color de la etiqueta cuando está en el centro */
    font-size: 1em; /* Ejemplo: Tamaño de fuente de la etiqueta cuando está en el centro */
    line-height: 1;
  }

  .floating-label.center {
    top: 50%;
    transform: translateY(-50%);
  }

  .floating-label.above {
    top: -0.7em; /* Ajusta para que la etiqueta quede justo encima del borde superior */
    font-size: 0.75em; /* Ejemplo: Tamaño de fuente de la etiqueta cuando está arriba */
    color: #3f51b5;  /* Ejemplo: Color de la etiqueta cuando está arriba (color de acento) */
  }

  .input-field {
    width: 100%; /* O un ancho fijo si lo prefieres */
    padding: 12px 10px; /* Ejemplo: Padding interno del campo de texto */
    border: none;
    border-radius: 0; /* El radio lo da .label-wrapper */
    font-size: 1em; /* Ejemplo: Tamaño de fuente del texto del input */
    color: #333333; /* Ejemplo: Color del texto del input */
    background-color: transparent;
    box-sizing: border-box; /* Importante para que el padding no afecte el ancho total */
  }

  .input-field:focus {
    outline: none; /* Quitar el outline por defecto al enfocar */
  }
  
  .input-field::placeholder {
    color: #aaaaaa; /* Ejemplo: Color del placeholder */
    opacity: 1; /* Firefox */
  }

  /* Para quitar las flechas de incremento/decremento si el input fuera type="number" */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
</style>