<!-- <script>

  import { toComaSep, toTele } from '$lib/functions/format'
  import { formatDate } from '$lib/functions/dateFunctions.js'
  import { property as propertyStore } from '$lib/stores/dataStore';
  import { onMount } from 'svelte';

  export let cont = {}; 
  
  // Asignar Etapa 1 si no tiene valor
  if (cont.contactStage === undefined || cont.contactStage === null || cont.contactStage === 0) {
    cont.contactStage = 1;
  }
  
  // Console log para depurar
  console.log('Contacto recibido en CardContact:', cont);
  console.log('Etapa del contacto (después de asignar):', cont.contactStage);

  // Normalizar el valor de la etapa a un número
  const normalizeStage = (stage) => {
    if (stage === undefined || stage === null) return 0;
    if (typeof stage === 'number') return stage;
    if (typeof stage === 'string') {
      // Si es "Etapa1", "Etapa2", etc.
      if (stage.startsWith('Etapa')) {
        return parseInt(stage.replace('Etapa', '')) || 0;
      }
      // Si es "1", "2", etc.
      return parseInt(stage) || 0;
    }
    return 0;
  };

  // Obtener la etapa normalizada
  const stageNumber = normalizeStage(cont.contactStage);
  
  // Función para obtener el texto de la etapa
  const getStageText = () => {
    return `E${stageNumber}`;
  };

  // Función para obtener el color de la etapa directamente
  const getStageColor = () => {
    switch(stageNumber) {
      case 1: return '#ff4444';
      case 2: return '#ff8844';
      case 3: return '#ffcc44';
      case 4: return '#44cc44';
      case 5: return '#8844cc';
      default: return '#666';
    }
  };
  
  // Variable para almacenar la propiedad asociada
  let propertyInfo = null;
  
  // Función para obtener información formateada de la propiedad
  const formatPropertyInfo = (property) => {
    if (!property) return null;
    
    return {
      title: property.title || 'Propiedad sin título',
      price: property.operations?.[0]?.formated_amount || '',
      type: property.property_type || '',
      location: typeof property.location === 'string' 
        ? property.location 
        : property.location?.name || '',
      image: property.title_image_thumb || ''
    };
  };
  
  // Obtener la propiedad del store cuando se monta el componente
  onMount(() => {
    // Suscribirse al store para obtener la propiedad
    const unsubscribe = propertyStore.subscribe(property => {
      if (property) {
        console.log("Propiedad encontrada en el store:", property);
        propertyInfo = formatPropertyInfo(property);
      }
    });
    
    // Limpiar la suscripción cuando se desmonta el componente
    return unsubscribe;
  });
</script>


  <div class="card__info">
    <!-- Círculo de etapa con estilo inline para mayor visibilidad -->
    <div class="stage-circle" style="background-color: {getStageColor()}; position: absolute; top: 0.5rem; right: 0.5rem; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.9rem; font-weight: 700; z-index: 999; box-shadow: 0 3px 6px rgba(0,0,0,0.4); border: 2px solid white;">
      {getStageText()}
    </div>
    <div class="card__infoHead">
      <span class="card__Title">{cont.name} {cont.lastname}</span>
      <span class="date">{formatDate(cont.createdAt)}</span>
    </div>
    <div class="info__cont">      
      {#if cont.telephon}
        <span> <i class="fa-solid fa-mobile-screen-button"></i> {toTele(cont.telephon)}</span>
      {/if}
      {#if cont.email }
        <span> <i class="fa-regular fa-envelope"></i> {cont.email} </span>
      {/if}
      {#if cont.publicUrl}
        <span class="public-url-info"> 
          <i class="fa-brands fa-whatsapp"></i> 
          <a href={cont.publicUrl} target="_blank" rel="noopener noreferrer" title="Ver propiedad">
            Ver propiedad
          </a>
        </span>
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
    
    <!-- Mostrar información de la propiedad si está disponible -->
    {#if propertyInfo}
      <div class="property-preview">
        <div class="property-header">
          <h3>Propiedad asociada</h3>
        </div>
        <div class="property-content">
          {#if propertyInfo.image}
            <div class="property-image">
              <img src={propertyInfo.image} alt={propertyInfo.title} />
            </div>
          {/if}
          <div class="property-details">
            <h4>{propertyInfo.title}</h4>
            {#if propertyInfo.price}
              <p class="property-price">{propertyInfo.price}</p>
            {/if}
            <p class="property-type-location">
              {#if propertyInfo.type}<span>{propertyInfo.type}</span>{/if}
              {#if propertyInfo.location}<span>{propertyInfo.location}</span>{/if}
            </p>
          </div>
        </div>
      </div>
    {/if}

  </div>
 

<style>
  .card__info {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    font-weight: 400;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 1.5rem;
    transition: all 0.2s ease-in-out;
  }

  .card__info:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateY(-2px);
  }

  .card__Title {
    font-weight: 600;
    font-size: 1.2rem;
    color: #333;
    margin-bottom: 0.2rem;
  }

  .date {
    font-size: 0.8rem;
    color: #777;
  }

  .card__infoHead {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.8rem;
  }

  .info__cont {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }

  .info__cont span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #444;
  }

  .info__cont i {
    color: #6b21a8;
    width: 18px;
  }

  .info__features {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .info__features span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #444;
  }

  .info__features i {
    color: #6b21a8;
    width: 18px;
  }

  .info__tags {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.3rem;
  }

  .info__tags span {
    font-size: 0.85rem;
    color: #555;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .to__showR {
    color: #6b21a8;
  }

  .stage-circle {
    background-color: #ff4444;
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 35px;
    height: 35px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.9rem;
    font-weight: 700;
    z-index: 999;
    box-shadow: 0 3px 6px rgba(0,0,0,0.4);
    border: 2px solid white;
  }

  .public-url-info {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
  }

  .public-url-info i {
    color: #25D366;
  }

  .public-url-info a {
    color: #4a6ee0;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .public-url-info a:hover {
    text-decoration: underline;
  }
  
  /* Estilos para la previsualización de la propiedad */
  .property-preview {
    margin-top: 1rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
  
  .property-header h3 {
    font-size: 0.95rem;
    color: #6b21a8;
    margin-bottom: 0.8rem;
    font-weight: 600;
  }
  
  .property-content {
    display: flex;
    gap: 0.8rem;
    align-items: flex-start;
  }
  
  .property-image {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
  }
  
  .property-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .property-details {
    flex: 1;
  }
  
  .property-details h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: #333;
    margin: 0 0 0.3rem 0;
    line-height: 1.3;
  }
  
  .property-price {
    font-size: 0.9rem;
    color: #6b21a8;
    font-weight: 600;
    margin: 0.2rem 0;
  }
  
  .property-type-location {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #666;
    margin: 0.2rem 0 0 0;
  }
  
  .property-type-location span:not(:last-child)::after {
    content: "•";
    margin-left: 0.5rem;
  }
</style> -->