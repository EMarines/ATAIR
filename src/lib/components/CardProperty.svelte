<script lang="ts">
  import { toComaSep } from '$lib/functions/format'
  import type { Property } from '$lib/types'

  export let property: Property;

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
  <div class="card__prop">
  
    <div class="img__cont">
      <img 
        src={property?.title_image_thumb || 'https://via.placeholder.com/200x150'} 
        alt="casa"
      >
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
    .card__prop { 
      display: flex; 
      flex-direction: column;   
      width: 100%;
      max-width: 300px;
      height: 250px;     
      background: rgb(56, 56, 56);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      transition: transform 0.2s, box-shadow 0.2s;
      justify-content: center;
      padding: 8px;
      gap: 4px;
      margin: 0 auto;
      cursor: pointer;
      position: relative;
      z-index: 1;
    }

    .card__prop:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      background: rgb(76, 76, 76);
    }

    .img__cont {
      display: flex;
      width: 100%;
      height: 50%;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      overflow: hidden;
    }    
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      margin: 0;
      aspect-ratio: 16/9;
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