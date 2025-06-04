<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import { formatDate, sendWhatsApp, infoToBinnacle } from '$lib/functions';

  
  let vendors: Contact[] = [];
  let isLoading = true;
  let selectedVendors: string[] = [];
  let vendorProperties: Record<string, Property[]> = {};
  let pendingVendors: string[] = []; // Para rastrear los vendedores pendientes de envío
  let isSending = false; // Estado para controlar el proceso de envío
  let progress = 0; // Progreso del envío (0-100%)
  
  // Suscripción a las stores
  const unsubContacts = contactsStore.subscribe(allContacts => {
    // Filtrar solo los vendedores
    vendors = allContacts.filter(contact => contact.typeContact === 'Vendedor');
    updateVendorProperties();
  });
  
  const unsubBinnacle = binnaclesStore.subscribe(() => {
    updateVendorProperties();
  });
  
  const unsubProperties = propertiesStore.subscribe(() => {
    updateVendorProperties();
  });
  
  // Actualizar las propiedades asociadas a cada vendedor
  function updateVendorProperties() {
    if (!vendors.length) return;
    
    vendorProperties = {};
    
    vendors.forEach(vendor => {
      if (!vendor.id) return;
      
      // Buscar en binnacle registros relacionados a este vendedor
      const vendorBinnacles = $binnaclesStore.filter(
        binnacle => binnacle.to === vendor.id && binnacle.action?.includes("Propiedad enviada")
      );
      
      // Extraer IDs de propiedades enviadas de la bitácora
      const propertyIds = new Set<string>();
      vendorBinnacles.forEach(binnacle => {
        if (binnacle.comment && typeof binnacle.comment === 'string') {
          propertyIds.add(binnacle.comment.trim());
        }
      });
      
      // También revisar la propiedad sendedProperties del vendedor
      if (vendor.sendedProperties && Array.isArray(vendor.sendedProperties)) {
        vendor.sendedProperties.forEach(id => {
          if (id && typeof id === 'string') {
            propertyIds.add(id);
          }
        });
      }
      
      // Buscar detalles de las propiedades
      const vendorProps = Array.from(propertyIds)
        .map(id => {
          return $propertiesStore.find(p => 
            (p && p.public_id && p.public_id === id) || 
            (p && p.public_id && p.public_id && p.public_id === id) || 
            (p && p.public_id && p.public_id === id)
          );
        })
        .filter(prop => prop !== null && prop !== undefined) as Property[];
      
      vendorProperties[vendor.id] = vendorProps;
    });
    
    isLoading = false;
  }
  
  // Función para manejar la selección de vendedores
  function toggleVendorSelection(vendorId: string) {
    if (selectedVendors.includes(vendorId)) {
      selectedVendors = selectedVendors.filter(id => id !== vendorId);
    } else {
      selectedVendors = [...selectedVendors, vendorId];
    }
  }
  
  // Función para seleccionar o deseleccionar todos los vendedores
  function toggleSelectAll(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      // Seleccionar todos los vendedores que tienen ID
      selectedVendors = vendors
        .filter(vendor => vendor.id)
        .map(vendor => vendor.id as string);
    } else {
      // Deseleccionar todos
      selectedVendors = [];
    }
  }
  
  // Valor computado para el estado del checkbox "Seleccionar todos"
  $: allSelected = vendors.length > 0 && 
                   vendors.filter(v => v.id).length === selectedVendors.length;

  // Enviar WhatsApp a los vendedores seleccionados
  async function sendToSelectedVendors() {
    if (selectedVendors.length === 0) return;
    
    // Iniciar proceso de envío
    isSending = true;
    pendingVendors = [...selectedVendors];
    progress = 0;
    
    // Crear cola de vendedores para procesar
    const selectedVendorObjects = vendors.filter(
      vendor => vendor.id && selectedVendors.includes(vendor.id)
    );
    
    // Procesar cada vendedor secuencialmente
    for (let i = 0; i < selectedVendorObjects.length; i++) {
      const vendor = selectedVendorObjects[i];
      
      // Verificar que el vendedor tenga propiedades
      if (!vendor.id || !vendorProperties[vendor.id] || vendorProperties[vendor.id].length === 0) {
        // Quitar de pendientes y actualizar progreso
        pendingVendors = pendingVendors.filter(id => id !== vendor.id);
        progress = Math.round((i + 1) / selectedVendorObjects.length * 100);
        continue; // Saltar a siguiente vendedor
      }
      
      const vendorProps = vendorProperties[vendor.id];
      
      try {
        // Enviar mensaje a este vendedor con sus propiedades
        await sendWhatsAppToVendor(vendor, vendorProps);
        
        // Actualizar estado
        pendingVendors = pendingVendors.filter(id => id !== vendor.id);
        progress = Math.round((i + 1) / selectedVendorObjects.length * 100);
        
        // Pequeña pausa para evitar problemas con la API de WhatsApp
        if (i < selectedVendorObjects.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error enviando mensaje a ${vendor.name}:`, error);
      }
    }
    
    // Finalizar proceso
    isSending = false;
    
    // Mensaje de finalización
    if (pendingVendors.length === 0) {
      alert('Todos los mensajes han sido enviados correctamente');
    } else {
      alert(`Se enviaron ${selectedVendorObjects.length - pendingVendors.length} de ${selectedVendorObjects.length} mensajes`);
    }
  }
  
  // Función para enviar WhatsApp a un vendedor específico usando la función importada
  async function sendWhatsAppToVendor(vendor: Contact, properties: Property[]) {
    if (!vendor.telephon) {
      throw new Error('El vendedor no tiene número de teléfono');
    }
    
    // Crear mensaje con las URLs de las propiedades
    const message = createWhatsAppMessage(vendor, properties);
    
    // Usar la función sendWhatsApp importada
    sendWhatsApp(vendor.telephon, message);
    
    // Registrar en la bitácora cada propiedad enviada
    for (const property of properties) {
      if (vendor.id && property.public_id) {
        const binnacle = {
          date: Date.now(),
          action: "Propiedad enviada: ",
          comment: property.public_id,
          to: vendor.id
        };
        
        // Guardar en la bitácora
        infoToBinnacle(binnacle);
      }
    }
    
    // Agregar una entrada adicional para el mensaje completo
    if (vendor.id) {
      const binnacle = {
        date: Date.now(),
        action: "WhatsApp enviado: ",
        comment: "Reporte de propiedades",
        to: vendor.id
      };
      
      infoToBinnacle(binnacle);
    }
    
    // Devolver promesa que se resuelve después de un tiempo para simular el envío
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Crear mensaje de WhatsApp
  function createWhatsAppMessage(vendor: Contact, properties: Property[]) {
    let message = `Hola ${vendor.name}, te comparto actualización sobre tus propiedades:\n\n`;
    
    properties.forEach(property => {
      // Incluir nombre de la propiedad
      message += `- ${property.title || 'Propiedad'}\n`;
      
      // // Incluir URL pública si existe
      // if (property.public_url) {
      //   message += `  Ver propiedad: ${property.public_url}\n`;
      // } else if (property.urlProp) {
      //   message += `  Ver propiedad: ${property.urlProp}\n`;
      // }
      
      message += '\n';
    });
    
    message += 'Por favor contáctame si requieres más información.';
    return message;
  }
  
  // Limpiar suscripción al desmontar
  onMount(() => {
    return () => {
      unsubContacts();
      unsubBinnacle();
      unsubProperties();
    };
  });
</script>

<h1 class="title">Enviar Reporte a Vendedores</h1>

<div class="container">
  {#if isLoading}
    <div class="loading">Cargando datos...</div>
  {:else}
    <div class="section">
      <div class="section-header">
        <h2>Vendedores</h2>
        <div class="select-all-container">
          <input 
            type="checkbox" 
            id="select-all" 
            checked={allSelected}
            on:change={toggleSelectAll}
          />
          <label for="select-all" class="checkbox-label"></label>
          <span class="select-all-text">Seleccionar todos</span>
        </div>
      </div>
      
      <div class="vendor-list">
        {#each vendors as vendor}
          {#if vendor.id}
            <div class="vendor-card" class:selected={selectedVendors.includes(vendor.id)}>
              <div class="checkbox-container">
                <input 
                  type="checkbox" 
                  checked={selectedVendors.includes(vendor.id)}
                  on:change={() => toggleVendorSelection(vendor.id)}
                  id={`vendor-${vendor.id}`}
                />
                <label for={`vendor-${vendor.id}`} class="checkbox-label"></label>
              </div>
              <div class="vendor-content">
                <div class="vendor-name">{vendor.name} {vendor.lastname}</div>
                <div class="vendor-phone">{vendor.telephon}</div>
                
                <!-- Mostrar propiedades con diseño adaptable -->
                <div class="vendor-properties">
                  {#if vendor.id && vendorProperties[vendor.id]?.length > 0}
                    {#if vendorProperties[vendor.id].length === 1}
                      <!-- Si es solo una propiedad, mostrar en el diseño normal -->
                      <div class="property-grid single-property">
                        {#each vendorProperties[vendor.id] as prop}
                          <div class="property-tile">
                            {#if prop.title_image_thumb}
                              <img src={prop.title_image_thumb} alt="" class="property-image" />
                            {:else}
                              <div class="property-placeholder">
                                <i class="fas fa-home"></i>
                              </div>
                            {/if}
                            <div class="property-id">{prop.public_id || 'ID'}</div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <!-- Si son múltiples propiedades, usar diseño de cartas apiladas con efecto hover -->
                      <div 
                        class="property-stack" 
                        class:last-vendor="{vendor.id === vendors[vendors.length - 1]?.id}"
                        role="group"
                        aria-label="Propiedades del vendedor"
                        on:mouseenter={(e) => e.currentTarget.classList.add('hovered')} 
                        on:mouseleave={(e) => {
                          e.currentTarget.classList.remove('hovered');
                          // Reset de las posiciones
                          setTimeout(() => {
                            e.currentTarget.classList.add('reset-transition');
                            setTimeout(() => e.currentTarget.classList.remove('reset-transition'), 50);
                          }, 500);
                        }}
                      >
                        {#each vendorProperties[vendor.id] as prop, i}
                          {#if i < 6} <!-- Limitar a 6 propiedades visibles -->
                            <div class="property-card" style="--index: {i}; --transition-delay: {i * 100}ms;">
                              {#if prop.title_image_thumb}
                                <img src={prop.title_image_thumb} alt="" class="property-image" />
                              {:else}
                                <div class="property-placeholder">
                                  <i class="fas fa-home"></i>
                                </div>
                              {/if}
                              <div class="property-id">{prop.public_id || 'ID'}</div>
                            </div>
                          {/if}
                        {/each}
                        {#if vendorProperties[vendor.id].length > 6}
                          <div class="property-more">+{vendorProperties[vendor.id].length - 6} más</div>
                        {/if}
                      </div>
                    {/if}
                  {:else}
                    <div class="no-properties">Sin propiedades</div>
                  {/if}
                </div>
                
                <!-- Última actividad -->
                {#if vendor.id && $binnaclesStore.filter(b => b.to === vendor.id).length > 0}
                  <div class="last-activity">
                    Última: {formatDate($binnaclesStore.filter(b => b.to === vendor.id).sort((a, b) => (b.date || 0) - (a.date || 0))[0]?.date)}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      </div>
      
      <div class="action-buttons">
        {#if isSending}
          <div class="sending-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%;"></div>
            </div>
            <div class="progress-text">
              Enviando: {selectedVendors.length - pendingVendors.length} de {selectedVendors.length}
            </div>
          </div>
        {:else}
          <Button 
            element="button"
            disabled={selectedVendors.length === 0}
            on:click={sendToSelectedVendors}
          >
            {#if selectedVendors.length > 0}
              Enviar a {selectedVendors.length} Vendedores Seleccionados
            {:else}
              Selecciona Vendedores para Enviar
            {/if}
          </Button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  .section {
    margin-bottom: 2rem;
    background-color: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  h2 {
    color: #333;
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .vendor-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .vendor-card {
    padding: 1.5rem;
    padding-left: 2.5rem; /* Espacio adicional a la izquierda para el checkbox */
    border-radius: 8px;
    border: 1px solid #eaeaea;
    transition: all 0.2s ease;
    display: flex;
    align-items: flex-start;
    position: relative;
    overflow: visible; /* Permitir que los elementos hijos sobresalgan */
  }

  .selected {
    background-color: #e6f7ff;
    border-color: #1890ff;
  }

  .checkbox-container {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 5;
  }

  .vendor-content {
    flex: 1;
    width: 100%; /* Asegurar que tome todo el ancho disponible */
    overflow: visible; /* Permitir que los elementos hijos sobresalgan */
  }

  input[type="checkbox"] {
    opacity: 0;
    position: absolute;
    cursor: pointer;
    width: 20px;
    height: 20px;
    z-index: 2;
  }

  .checkbox-label {
    display: inline-block;
    width: 20px;
    height: 20px;
    background: white;
    border: 2px solid #ddd;
    border-radius: 4px;
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  input[type="checkbox"]:checked + .checkbox-label {
    background: #1890ff;
    border-color: #1890ff;
  }

  input[type="checkbox"]:checked + .checkbox-label:after {
    content: "";
    position: absolute;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    font-size: 1.2rem;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eaeaea;
  }
  
  .select-all-container {
    display: flex;
    align-items: center;
    position: relative;
  }
  
  .select-all-text {
    margin-left: 8px;
    font-size: 0.9rem;
    color: #555;
  }
  
  .vendor-properties {
    margin-top: 0.5rem;
    width: 100%;
    overflow: visible; /* Permitir que los elementos hijos sobresalgan */
  }
  
  /* Diseño tradicional en grid para una sola propiedad */
  .property-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    max-height: 172px;
    overflow: hidden;
  }
  
  .property-grid.single-property {
    grid-template-columns: 1fr;
  }
  
  .property-tile {
    position: relative;
    height: 80px;
    overflow: hidden;
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    background: #f0f0f0;
  }
  
  /* Diseño de cartas apiladas para múltiples propiedades */
  .property-stack {
    position: relative;
    display: flex;
    align-items: center;
    height: 100px;
    margin: 10px 0;
    overflow: visible;
    padding-left: 0; /* Reducir padding izquierdo */
    padding-right: 60px;
  }
  
  /* Usamos una clase específica para detectar cuando el ratón está sobre el stack */
  /* .property-stack.hovered .property-card {
    transform: translateX(calc(var(--index) * -25px));
  } */
  
  /* Clase para resetear las transiciones */
  /* .property-stack.reset-transition .property-card {
    transition: none; 
    transform: translateX(calc(var(--index) * -15px));
  } */
  
  /* Clase especial para el último vendedor */
  .property-stack.last-vendor {
    padding-right: 100px; /* Más espacio a la derecha para el último */
  }
  
  .property-card {
    position: relative;
    height: 80px;
    width: 80px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transform: translateX(calc(var(--index) * -15px)); /* Posición inicial */
    transition: transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1); /* Transición más lenta */
    transition-delay: var(--transition-delay, 0ms);
    z-index: calc(10 - var(--index));
    background: #f0f0f0;
    flex-shrink: 0; /* Evitar que las cards se compriman */
  }
  
  /* El efecto de hover ahora se aplica a cada tarjeta individualmente */
  .property-card:hover {
    transform: translateX(calc(var(--index) * -25px)) scale(1.3); /* Escala un poco mayor */
    z-index: 20;
    box-shadow: 0 6px 12px rgba(0,0,0,0.3); /* Sombra más pronunciada */
    transition-delay: 0ms; /* Sin retraso al hacer hover para una respuesta más inmediata */
  }
  
  /* Contenedor padre que mantiene el contexto */
  .vendor-card {
    padding: 1.5rem;
    padding-left: 2.5rem; /* Espacio adicional a la izquierda para el checkbox */
    border-radius: 8px;
    border: 1px solid #eaeaea;
    transition: all 0.2s ease;
    display: flex;
    align-items: flex-start;
    position: relative;
    overflow: visible; /* Permitir que los elementos hijos sobresalgan */
  }
  
  .vendor-content {
    flex: 1;
    width: 100%; /* Asegurar que tome todo el ancho disponible */
    overflow: visible; /* Permitir que los elementos hijos sobresalgan */
  }
  
  .vendor-properties {
    margin-top: 0.5rem;
    width: 100%;
    overflow: visible; /* Permitir que los elementos hijos sobresalgan */
  }
  
  /* Asegurar que la imagen cubra toda la tarjeta */
  .property-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center; /* Centrar la imagen */
  }
  
  .property-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #aaa;
    font-size: 0.9rem;
  }
  
  .property-id {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.6);
    color: white;
    font-size: 0.6rem;
    padding: 2px 4px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .property-more {
    margin-left: 10px; 
    font-size: 0.7rem;
    color: #666;
    font-style: italic;
    padding: 4px 8px;
    background: rgba(0,0,0,0.05);
    border-radius: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }
  
  .no-properties {
    font-size: 0.7rem;
    color: #999;
    font-style: italic;
  }
  
  .last-activity {
    margin-top: 0.3rem;
    font-size: 0.7rem;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Eliminar estilos que ya no usamos */
  /* .property-row,
  .property-pill,
  .pill-image,
  .pill-text,
  .property-pill.more { */
    /* Ya no se utilizan */
  /* } */
  
  .sending-progress {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background-color: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background-color: #1890ff;
    transition: width 0.3s ease;
  }
  
  .progress-text {
    font-size: 0.9rem;
    color: #666;
  }
</style>