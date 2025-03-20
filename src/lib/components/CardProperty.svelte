<script lang="ts">
  import { toComaSep } from '$lib/functions/format'
  import type { Property } from '$lib/types'
  import { onMount } from 'svelte';

  export let property: Property;
  export let selectable = false;
  export let onSelect = () => {};
  export let isSelected = false;
  
  let imgError = false;
  let imgSrc = property?.title_image_thumb || '/placeholder-property.png';

  // Función para manejar errores de carga de imagen
  function handleImageError() {
    imgError = true;
    imgSrc = '/placeholder-property.png';
  }

  // Función para formatear la ubicación
  const formatLocation = (location: string | { name: string } | undefined | null) => {
    if (!location) return 'Sin dirección';
    const locationStr = typeof location === 'string' ? location : location.name;
    return locationStr
        .replace("Chihuahua, Chihuahua", "")
        .replaceAll(",", "")
        .replace("I, ", "")
        .replace("II", "")
        .replace("III", "")
        .replace("IV", "")
        .replace(" V ", "")
        .replaceAll(" Y ", "")
        .trim();
  };

</script>

<div class="card__container">
  {#if selectable}
    <input 
      type="radio" 
      class="property-selector"
      checked={isSelected}
      on:change={onSelect}
    />
  {/if}
  <div class="card__prop">
  
    <div class="img__cont">
      <img 
        src={imgSrc} 
        alt="Imagen de propiedad"
        on:error={handleImageError}
      >
      {#if imgError}
        <div class="img-error-overlay">Sin imagen</div>
      {/if}
    </div>

    <div class="info__cont">

      <div class="card__info">
        <span class="capitalize">
          {formatLocation(property?.location)}
        </span>
        <span>$ {toComaSep(Number(property?.operations?.[0]?.amount || 0))}</span>
      </div>

      <div class="card__features">
        {#if property?.property_type?.toLowerCase() === "casa" ||
         property?.property_type?.toLowerCase() === "departamento"}
          <span>Recámaras {property?.bedrooms || 0}</span>
          <span>Baños {Number(property?.bathrooms || 0)}</span> 
        {:else if property?.property_type?.toLowerCase() === "terreno" ||
         property?.property_type?.toLowerCase() === "local comercial"}  
          <span>{toComaSep(Number(property?.construction_size || 0))} m²</span>
        {:else if property?.property_type?.toLowerCase() === "edificio" ||
         property?.property_type?.toLowerCase().startsWith("bodega")}
          <span>{toComaSep(Number(property?.construction_size || 0))} m²</span>
          <span>{toComaSep(Number(property?.lot_size || 0))} m²</span>
        {/if}
      </div>

    </div>
    
  </div> 
</div>

<style>
    .card__container {
      position: relative;
      width: 100%;
      height: 100%;
      z-index: 10;
    }

    .property-selector {
      position: absolute;
      top: 15px;
      left: 15px;
      z-index: 1001;
      margin: 0;
      cursor: pointer;
      width: 20px;
      height: 20px;
      accent-color: #6b21a8;
    }

    .card__prop { 
      position: relative;
      display: flex; 
      flex-direction: column;   
      width: 100%;
      height: 250px;     
      background: rgb(56, 56, 56);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: visible; /* Cambiado de hidden a visible para permitir que el contenido se expanda */
      transition: all 0.3s ease;
      z-index: 10;
      max-width: 300px;
      justify-content: center;
      padding: 8px;
      gap: 4px;
      margin: 0 auto;
      cursor: pointer;
    }

    .card__prop:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      background: rgb(76, 76, 76);
      z-index: 1000; /* Aumentar z-index al hacer hover */
    }

    .img__cont {
      position: relative;
      display: flex;
      width: 100%;
      height: 50%;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }    
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      margin: 0;
      aspect-ratio: 16/9;
    }
    
    .img-error-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      font-size: 1rem;
      border-radius: 8px;
    }
    
    .info__cont{
      width: 100%;
      /* height: 50%; */
      /* align-items: baseline;s */
    }
    
    .card__info {
      display: flex;
      flex-direction: column;
      font-size: 0.9rem;
      font-weight: 300;
      align-items: center;
      justify-content: center;
    }
   
    .card__features {
      display: flex;
      flex-direction: row;
      font-size: 0.8em;
      padding: 4px;
      gap: 8px;
      justify-content: center;
    }

    @media(max-width: 400px) {
      .card__prop {
        max-width: 100%;
        height: 200px;
      }

      .img__cont {
        height: 60%;
      }

      .info__cont {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
        padding: 15px 10px;
        color: white;
      }

      span {
        color: white;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      }
    }

    /* Asegurar que el input quede por encima */
    :global(input) {
      position: relative;
      z-index: 2;
    }
</style>