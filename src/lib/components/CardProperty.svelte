<script lang="ts">
  import { toComaSep } from '$lib/functions/format'
  import type { Property } from '$lib/types'
  import { onMount } from 'svelte';

  export let property: Property;
  export let selectable = false;
  export let onSelect = () => {};
  export let isSelected = false;
  
  let imgError = false;
  $: imgSrc = property?.title_image_thumb || '/placeholder-property.png';

  // Función para manejar errores de carga de imagen
  function handleImageError() {
    imgError = true;
    imgSrc = '/placeholder-property.png';
  }

  // Función para formatear la ubicación y limitar su longitud
  const formatLocation = (location: string | { name: string } | undefined | null) => {
    if (!location) return 'Sin dirección';
    const locationStr = typeof location === 'string' ? location : location.name;
    let formattedLocation = locationStr
        .replace("Chihuahua, Chihuahua", "")
        .replaceAll(",", "")
        .replace("I, ", "")
        .replace("II", "")
        .replace("III", "")
        .replace("IV", "")
        .replace(" V ", "")
        .replaceAll(" Y ", "")
        .replace("Fraccionamiento", "")
        .replace("Residencial", "")
        .replace("Etapa", "")
        .trim();
    
    // Limitar la longitud absoluta para evitar desbordamiento
    return formattedLocation.length > 25 ? formattedLocation.substring(0, 22) + '...' : formattedLocation;
  };

  // Formatear características con longitud controlada
  const formatFeature = (value: number, unit: string) => {
    return `${toComaSep(value)} ${unit}`;
  };
</script>

<!-- Estructura simplificada - Eliminado div redundante "card-property" -->
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
        loading="lazy"
      >
      {#if imgError}
        <div class="img-error-overlay">Sin imagen</div>
      {/if}
    </div>

    <div class="info__cont">
      <div class="card__info">
        <div class="location-container">
          <span class="capitalize">
            {formatLocation(property?.location)}
          </span>
        </div>
        <span class="price">$ {toComaSep(Number(property.price || 0))}</span>
      </div>

      <div class="card__features">
        {#if property?.property_type?.toLowerCase() === "casa" ||
        property?.property_type?.toLowerCase() === "departamento"}
          <span class="feature-span">Recámaras {property?.bedrooms || 0}</span>
          <span class="feature-span">Baños {Number(property?.bathrooms || 0)}</span> 
        {:else if property?.property_type?.toLowerCase() === "terreno" ||
        property?.property_type?.toLowerCase() === "local comercial"}  
          <span class="feature-span">{toComaSep(Number(property?.construction_size || 0))} m²</span>
        {:else if property?.property_type?.toLowerCase() === "edificio" ||
        property?.property_type?.toLowerCase().startsWith("bodega")}
          <span class="feature-span">{toComaSep(Number(property?.construction_size || 0))} m²</span>
          <span class="feature-span">{toComaSep(Number(property?.lot_size || 0))} m²</span>
        {/if}
      </div>
    </div>
  </div> 
</div>

<style>
  /* Consolidados todos los estilos del div card-property en card__container */
  .card__container {
    position: relative;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    z-index: 10;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Otros estilos del componente... */
  
  /* Ajustar contenedores internos para evitar espaciado extra */
  .card__container :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  /* Ajustar cualquier padding/margin interno específico según sea necesario */

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
    height: 100%;     
    background: rgb(56, 56, 56);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s ease;
    z-index: 10;
    justify-content: space-between;
    padding: 8px;
    cursor: pointer;
    box-sizing: border-box;
  }

  .card__prop:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    background: rgb(76, 76, 76);
    z-index: 1000;
  }

  .img__cont {
    position: relative;
    width: 100%;
    height: 140px;
    overflow: hidden;
    border-radius: 8px;
    margin-bottom: 8px;
    flex-shrink: 0;
  }    
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    margin: 0;
    display: block;
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
  
  .info__cont {
    width: 100%;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: space-between;
    min-height: 0;
    max-width: 100%;
    overflow: hidden;
  }
  
  .card__info {
    display: flex;
    flex-direction: column;
    font-size: 0.9rem;
    font-weight: 300;
    align-items: center;
    justify-content: center;
    text-align: center;
    /* padding: 4px 0; */
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  /* Contenedor específico para la ubicación */
  .location-container {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    height: 1.2em; /* Altura fija para el texto */
    line-height: 1.2em;
    margin-bottom: 4px;
  }

  /* Estilo específico para el texto de la ubicación */
  .capitalize {
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    width: 100%;
    font-size: 0.9rem;
  }

  .price {
    font-weight: 500;
    font-size: 0.95rem;
    display: block;
    white-space: nowrap;
    height: 1.2em;
    line-height: 1.2em;
  }
 
  .card__features {
    display: flex;
    flex-direction: row;
    padding: 4px;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    height: 1.8em; /* Altura fija para características */
  }

  /* Clase específica para los spans de características */
  .feature-span {
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 45%;
    font-size: 0.8em;
    height: 1.2em;
    line-height: 1.2em;
  }

  /* Sistema responsive con múltiples breakpoints */
  @media (max-width: 768px) {
    .card__container {
      height: 100%;
    }
    
    .img__cont {
      height: 130px;
    }
  }

  @media (max-width: 500px) {
    .card__container {
      width: 100%;
      height: 220px;
    }
    
    .feature-span {
      font-size: 0.7rem;
    }
  }

  @media (max-width: 400px) {
    .card__container {
      height: 100%;
      margin: 0 auto 10px;
    }

    .card__prop {
      padding: 6px;
    }

    .img__cont {
      height: 120px;
    }

    .card__info {
      font-size: 0.8rem;
      padding: 2px 0;
    }

    .capitalize {
      font-size: 0.8rem;
    }

    .price {
      font-size: 0.85rem;
    }

    .card__features {
      padding: 2px;
      gap: 5px;
      height: 1.6em;
    }
  }

  /* Para dispositivos muy pequeños */
  @media (max-width: 350px) {
    .card__container {
      height: 100%;
      min-height: 100%;
    }

    .img__cont {
      height: 100px;
    }
  }
</style>