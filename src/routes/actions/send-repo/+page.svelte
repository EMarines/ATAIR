<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import { formatDate, sendWhatsApp, infoToBinnacle } from '$lib/functions';

  // Variable para almacenar la referencia a la ventana de WhatsApp anterior
  let previousWhatsAppInstance: { close: () => void } | null = null;
  
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

  // Variables para el seguimiento del proceso de envío
  let currentVendorIndex = -1;
  let enviadosExito = 0;
  let sinPropiedades = 0;
  let conError = 0;
  let errorDetails = [];
  let selectedVendorObjects: Contact[] = [];
  let isProcessingVendor = false; // Flag para controlar cuando se está procesando un vendedor

  // Función para enviar WhatsApp al siguiente propietario pendiente
  async function sendToNextVendor() {
    // Si ya está procesando un vendedor, evitar iniciar otro proceso
    if (isProcessingVendor) {
      console.warn("Ya se está procesando un vendedor, por favor espere...");
      return;
    }
    
    if (!isSending) {
      // Si no está en proceso de envío, iniciar nuevo proceso
      if (selectedVendors.length === 0) {
        console.warn("No hay propietarios seleccionados para enviar reportes");
        alert("Por favor, selecciona al menos un propietario para enviar reportes");
        return;
      }
      
      // Iniciar proceso de envío
      isSending = true;
      pendingVendors = [...selectedVendors];
      progress = 0;
      currentVendorIndex = -1;
      enviadosExito = 0;
      sinPropiedades = 0;
      conError = 0;
      errorDetails = [];
      
      // Crear cola de vendedores para procesar
      selectedVendorObjects = vendors.filter(
        vendor => vendor.id && selectedVendors.includes(vendor.id)
      );
      
      console.log(`🚀 Comenzando envío individual a ${selectedVendorObjects.length} propietarios seleccionados`);
    }
    
    // Avanzar al siguiente propietario
    currentVendorIndex++;
    
    // Verificar si hemos terminado con todos los propietarios
    if (currentVendorIndex >= selectedVendorObjects.length) {
      finalizarProceso();
      return;
    }
    
    // Marcar que estamos procesando un vendedor
    isProcessingVendor = true;
    
    const vendor = selectedVendorObjects[currentVendorIndex];
    const vendorFullName = `${vendor.name} ${vendor.lastname || ''}`.trim();
    console.log(`💬 [${currentVendorIndex+1}/${selectedVendorObjects.length}] Procesando propietario: ${vendorFullName}`);
    
    // Actualizar progreso
    progress = Math.round((currentVendorIndex + 0.5) / selectedVendorObjects.length * 100);
    
    // Verificar que el vendedor tenga propiedades
    if (!vendor.id || !vendorProperties[vendor.id] || vendorProperties[vendor.id].length === 0) {
      // Quitar de pendientes y actualizar progreso
      pendingVendors = pendingVendors.filter(id => id !== vendor.id);
      progress = Math.round((currentVendorIndex + 1) / selectedVendorObjects.length * 100);
      sinPropiedades++;
      console.log(`⚠️ ${vendorFullName} no tiene propiedades asociadas, omitiendo...`);
      
      // Continuar con el siguiente propietario automáticamente, pero después de un breve retraso
      isProcessingVendor = false;
      setTimeout(sendToNextVendor, 500);
      return;
    }
    
    const vendorProps = vendorProperties[vendor.id];
    console.log(`📋 Preparando reporte con ${vendorProps.length} propiedades para ${vendorFullName}`);
    
    try {
      // Cerrar ventanas previas de WhatsApp antes de enviar el nuevo mensaje
      if (previousWhatsAppInstance && typeof previousWhatsAppInstance.close === 'function') {
        try {
          previousWhatsAppInstance.close();
          console.log("Ventana de WhatsApp anterior cerrada automáticamente");
          previousWhatsAppInstance = null;
        } catch (err) {
          console.warn("No se pudo cerrar la ventana anterior de WhatsApp", err);
        }
      }
      
      // Enviar mensaje a este vendedor con sus propiedades
      await sendWhatsAppToVendor(vendor, vendorProps);
      
      // Actualizar estado
      pendingVendors = pendingVendors.filter(id => id !== vendor.id);
      progress = Math.round((currentVendorIndex + 1) / selectedVendorObjects.length * 100);
      enviadosExito++;
      console.log(`✅ Reporte enviado exitosamente a ${vendorFullName}`);
    } catch (error) {
      console.error(`❌ Error enviando mensaje a ${vendorFullName}:`, error);
      errorDetails.push(`${vendorFullName}: ${error.message || 'Error desconocido'}`);
      conError++;
      
      // Actualizar estado de progreso para este vendedor con error
      pendingVendors = pendingVendors.filter(id => id !== vendor.id);
      progress = Math.round((currentVendorIndex + 1) / selectedVendorObjects.length * 100);
    } finally {
      // Siempre marcar que ya no estamos procesando un vendedor
      isProcessingVendor = false;
    }
    
    // El botón ahora dirá "Enviar siguiente" y el usuario puede hacer clic para continuar
  }
  
  // Función para finalizar el proceso y mostrar resumen
  function finalizarProceso() {
    // Cerrar la última ventana de WhatsApp si existe
    if (previousWhatsAppInstance && typeof previousWhatsAppInstance.close === 'function') {
      try {
        previousWhatsAppInstance.close();
        console.log("Última ventana de WhatsApp cerrada");
      } catch (err) {
        console.warn("No se pudo cerrar la última ventana de WhatsApp", err);
      }
      previousWhatsAppInstance = null;
    }
    
    isSending = false;
    currentVendorIndex = -1;
    isProcessingVendor = false;
    
    // Mensaje de finalización con detalle
    if (conError === 0 && enviadosExito > 0) {
      console.log(`🎉 Proceso completado con éxito. ${enviadosExito} reportes enviados`);
      
      alert(`¡Éxito! Todos los reportes han sido enviados correctamente.
            
- Total enviados: ${enviadosExito}
- Propietarios sin propiedades: ${sinPropiedades}
- Errores: Ninguno`);
    } else if (enviadosExito > 0 || sinPropiedades > 0 || conError > 0) {
      console.warn(`⚠️ Proceso completado con algunos errores. ${enviadosExito} exitosos, ${conError} errores`);
      
      // Preparar mensaje con detalles de errores (limitado a 3 para no sobrecargar el alert)
      const errorsText = errorDetails.length > 3 
        ? errorDetails.slice(0, 3).join('\n') + `\n... y ${errorDetails.length - 3} más.` 
        : errorDetails.join('\n');
      
      alert(`Resumen del envío de reportes:
            
- Enviados con éxito: ${enviadosExito}
- Propietarios sin propiedades: ${sinPropiedades}
- Errores: ${conError}
- Total seleccionado: ${selectedVendorObjects.length}

${conError > 0 ? `\nDetalle de errores:\n${errorsText}` : ''}`);
    } else {
      // No se ha enviado ninguno, probablemente el usuario canceló antes de empezar
      console.log("Proceso de envío cancelado por el usuario");
    }
  }
  
  // Alias para mantener compatibilidad con el código existente
  const sendToSelectedVendors = sendToNextVendor;
  
  // Función para enviar WhatsApp a un vendedor específico usando la función importada
  async function sendWhatsAppToVendor(vendor: Contact, properties: Property[]) {
    if (!vendor.telephon) {
      console.error(`Error: ${vendor.name} no tiene número de teléfono`);
      throw new Error('El vendedor no tiene número de teléfono');
    }
    
    console.log(`Preparando mensaje para ${vendor.name} con ${properties.length} propiedades`);
    
    // Crear mensaje con las URLs de las propiedades
    const message = createWhatsAppMessage(vendor, properties);
    
    // Registrar en la bitácora cada propiedad enviada
    for (const property of properties) {
      if (vendor.id && property.public_id) {
        const binnacle = {
          date: Date.now(),
          action: "Propiedad enviada en reporte: ",
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
        comment: `Reporte de ${properties.length} propiedades`,
        to: vendor.id
      };
      
      infoToBinnacle(binnacle);
    }
    
    console.log(`Abriendo WhatsApp Web para ${vendor.name}...`);
    
    // Usar la función sendWhatsApp importada que devuelve un objeto con un método close
    let whatsappInstance;
    try {
      whatsappInstance = sendWhatsApp(vendor.telephon, message);
      console.log(`WhatsApp abierto correctamente para ${vendor.name}`);
    } catch (error) {
      console.error(`Error al abrir WhatsApp para ${vendor.name}:`, error);
      throw new Error(`Error al abrir WhatsApp: ${error.message || 'Error desconocido'}`);
    }
    
    // Al enviar uno por uno, dejamos la ventana abierta para que el usuario pueda interactuar
    console.log(`✅ Ventana de WhatsApp abierta para ${vendor.name} - Espera a que se envíe el mensaje y ciérrala cuando estés listo`);
    
    // Almacenar la instancia actual para cerrarla en el próximo envío
    previousWhatsAppInstance = whatsappInstance;
    
    // Mostrar prompt al usuario para que confirme el envío
    return true; // Indicar que se completó correctamente
  }
  
  // Crear mensaje de WhatsApp
  function createWhatsAppMessage(vendor: Contact, properties: Property[]) {
    // Obtener nombre completo o solo nombre si el apellido no está disponible
    const nombreCompleto = vendor.lastname ? `${vendor.name} ${vendor.lastname}` : vendor.name;
    
    // Mensaje de introducción personalizado
    let message = `Hola ${nombreCompleto},\n\n`;
    
    if (properties.length === 1) {
      message += `Seguimos publicando tu propiedad. A continuación te compartimos el enlace para que puedas revisar la información actual:\n\n`;
    } else {
      message += `Seguimos publicando tus propiedades. A continuación te compartimos los enlaces para que puedas revisar la información actual:\n\n`;
    }
    
    // Contador para propiedades con URL
    let propertiesWithUrl = 0;
    
    // Agregar cada propiedad con su enlace
    properties.forEach((property, index) => {
      // Título formateado de la propiedad
      const propertyTitle = property.title 
        ? property.title.trim() 
        : `Propiedad ${index + 1}`;
      
      // ID de la propiedad
      const propertyId = property.public_id 
        ? property.public_id.trim() 
        : 'Sin ID';
      
      // Generar línea con título e ID
      message += `*${propertyTitle}* (ID: ${propertyId})\n`;
      
      // Incluir URL pública si existe
      let hasUrl = false;
      if (property.public_url && property.public_url.trim()) {
        message += `👉 ${property.public_url.trim()}\n`;
        hasUrl = true;
        propertiesWithUrl++;
      } else if ((property as any).urlProp && (property as any).urlProp.trim()) {
        // Usar casting a any para acceder a urlProp que no está en la interfaz formal
        message += `👉 ${(property as any).urlProp.trim()}\n`;
        hasUrl = true;
        propertiesWithUrl++;
      } else {
        message += `📌 (Enlace no disponible aún)\n`;
      }
      
      message += '\n';
    });
    
    // Mensaje adaptado según si hay enlaces disponibles o no
    if (propertiesWithUrl === 0) {
      message += `Los enlaces de tus propiedades todavía no están disponibles, pero te avisaremos cuando lo estén.\n\n`;
    } else if (propertiesWithUrl < properties.length) {
      message += `Por favor revisa la información de las propiedades con enlace disponible y coméntanos si ha habido algún cambio.\n\n`;
    } else {
      message += `Por favor revisa la información y coméntanos si ha habido algún cambio en alguna de tus propiedades.\n\n`;
    }
    
    // Despedida
    message += '¡Muchas gracias!\n';
    message += 'Atentamente,\n';
    message += 'Equipo ATAIR';
    
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

<h1 class="title">Enviar Reporte de Propiedades a Propietarios</h1>

<div class="container">
  {#if isLoading}
    <div class="loading">Cargando datos...</div>
  {:else}
    <div class="section">
      <div class="section-header">
        <h2>Propietarios de inmuebles</h2>
        <div class="select-all-container">
          <input 
            type="checkbox" 
            id="select-all" 
            checked={allSelected}
            on:change={toggleSelectAll}
            disabled={isSending}
          />
          <label for="select-all" class="checkbox-label"></label>
          <span class="select-all-text">Seleccionar todos</span>
        </div>
      </div>
      
      <div class="vendor-list">
        {#each vendors as vendor}
          {#if vendor.id}
            <div class="vendor-card" 
                 class:selected={selectedVendors.includes(vendor.id)}
                 class:current-processing={isSending && currentVendorIndex >= 0 && selectedVendorObjects[currentVendorIndex]?.id === vendor.id && isProcessingVendor}>
              <div class="checkbox-container">
                <input 
                  type="checkbox" 
                  checked={selectedVendors.includes(vendor.id)}
                  on:change={() => toggleVendorSelection(vendor.id)}
                  id={`vendor-${vendor.id}`}
                  disabled={isSending}
                />
                <label for={`vendor-${vendor.id}`} class="checkbox-label"></label>
              </div>
              <div class="vendor-content">
                <div class="vendor-name">{vendor.name} {vendor.lastname}</div>
                <div class="vendor-phone">{vendor.telephon}</div>
                
                <!-- Mostrar propiedades con diseño adaptable y optimizado para altura mínima -->
                <div class="vendor-properties">
                  {#if vendor.id && vendorProperties[vendor.id]?.length > 0}
                    {#if vendorProperties[vendor.id].length === 1}
                      <!-- Si es solo una propiedad, mostrar en diseño compacto y alineado verticalmente con múltiples -->
                      <div class="property-container">
                        <div class="property-grid single-property">
                          {#each vendorProperties[vendor.id] as prop}
                            <div class="property-tile">
                              {#if prop.title_image_thumb}
                                <img src={prop.title_image_thumb} alt="" class="property-image" loading="lazy" />
                              {:else}
                                <div class="property-placeholder">
                                  <i class="fas fa-home"></i>
                                </div>
                              {/if}
                              <div class="property-id">{prop.public_id || 'ID'}</div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {:else}
                      <!-- Si son múltiples propiedades, usar diseño de cartas apiladas compacto -->
                      <div class="property-container">
                        <div 
                          class="property-stack" 
                          class:last-vendor="{vendor.id === vendors[vendors.length - 1]?.id}"
                          role="group"
                          aria-label="Propiedades del vendedor"
                          on:mouseenter={(e) => e.currentTarget.classList.add('hovered')} 
                          on:mouseleave={(e) => e.currentTarget.classList.remove('hovered')}
                        >
                          <!-- Mostrar propiedades en forma de stack (inverso para que la primera quede al frente) -->
                          {#each vendorProperties[vendor.id] as prop, i}
                            {#if i < 6} <!-- Limitar a 6 propiedades visibles -->
                              <div class="property-card" style="--index: {i}; --transition-delay: {(6-i) * 50}ms;">
                                {#if prop.title_image_thumb}
                                  <img src={prop.title_image_thumb} alt="" class="property-image" loading="lazy" />
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
                      </div>
                    {/if}
                  {:else}
                    <div class="no-properties">
                      <i class="fa-solid fa-house-slash"></i> Sin propiedades
                    </div>
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
        <div class="sending-progress" class:hidden={!isSending}>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%;"></div>
            </div>
            <div class="progress-percentage">{progress}%</div>
          </div>
          <div class="progress-text">
            <i class="fa-brands fa-whatsapp" class:fa-spin={isProcessingVendor}></i> 
            Reportes por WhatsApp: {currentVendorIndex + 1} de {selectedVendorObjects.length}
          </div>
          <div class="progress-info">
            {#if isProcessingVendor}
              <span class="processing-text">Enviando mensaje por WhatsApp. Por favor espere...</span>
            {:else if currentVendorIndex + 1 >= selectedVendorObjects.length && currentVendorIndex >= 0}
              <span class="complete-text">Proceso completado. Haz clic en "Finalizar" para terminar.</span>
            {:else}
              <span class="next-text">Haz clic en "Enviar siguiente" para continuar con el siguiente propietario.</span>
            {/if}
          </div>
          <div class="progress-details">
            <span class="badge success">
              <i class="fa-solid fa-check-circle"></i> {enviadosExito} enviados
            </span>
            <span class="badge warning">
              <i class="fa-solid fa-exclamation-circle"></i> {sinPropiedades} sin props
            </span>
            <span class="badge error">
              <i class="fa-solid fa-times-circle"></i> {conError} errores
            </span>
          </div>
        </div>

        <Button 
          element="button"
          disabled={(selectedVendors.length === 0 && !isSending) || isProcessingVendor}
          on:click={sendToNextVendor}
          icon="fa-brands fa-whatsapp"
          style={isSending 
            ? (isProcessingVendor 
                ? "background-color: #757575; color: white; opacity: 0.7; cursor: not-allowed;" 
                : "background-color: #128C7E; color: white; font-weight: bold;") 
            : (selectedVendors.length > 0 ? "background-color: #25D366; color: white;" : "")
          }
        >
          {#if isSending}
            {#if isProcessingVendor}
              <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>
              Procesando envío...
            {:else if currentVendorIndex + 1 >= selectedVendorObjects.length}
              Finalizar envío de reportes
            {:else}
              Enviar siguiente reporte ({currentVendorIndex + 1}/{selectedVendorObjects.length})
            {/if}
          {:else if selectedVendors.length > 0}
            Comenzar envío de reportes a {selectedVendors.length} propietario{selectedVendors.length !== 1 ? 's' : ''}
          {:else}
            Selecciona propietarios para enviar reportes
          {/if}
        </Button>

        {#if isSending}
          <Button 
            element="button"
            on:click={finalizarProceso}
            icon="fa-solid fa-times-circle"
            style="background-color: #f5f5f5; color: #666; margin-left: 10px;"
            disabled={isProcessingVendor}
          >
            Cancelar
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
    padding: 1rem; /* Reducido de 1.5rem a 1rem */
    padding-left: 2.5rem; /* Espacio adicional a la izquierda para el checkbox */
    border-radius: 8px;
    border: 1px solid #eaeaea;
    transition: all 0.2s ease;
    display: flex;
    align-items: flex-start;
    position: relative;
    overflow: hidden; /* Contener el contenido dentro del contenedor por defecto */
    height: auto; /* Asegurar que el contenedor se ajuste al contenido */
    min-height: 130px; /* Reducido de 150px a 130px */
    z-index: 1; /* Nivel base de z-index */
  }
  
  /* Aumentar z-index cuando se hace hover y permitir que el contenido sea visible */
  .vendor-card:hover {
    z-index: 5;
    overflow: visible; /* Permitir que el contenido sea visible durante hover */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .selected {
    background-color: #e6f7ff;
    border-color: #1890ff;
  }
  
  .current-processing {
    animation: pulse 1.5s infinite;
    border-color: #25D366;
    background-color: rgba(37, 211, 102, 0.1);
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(37, 211, 102, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(37, 211, 102, 0);
    }
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
    position: relative;
    z-index: 1;
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
    flex-direction: column;
    align-items: center;
    gap: 15px;
    margin-top: 2rem;
  }

  .sending-progress {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: 8px;
    background-color: #f9f9f9;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  
  .progress-container {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 5px 0 15px;
  }
  
  .progress-bar {
    flex: 1;
    height: 12px;
    background-color: #e6e6e6;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
    position: relative;
  }
  
  .progress-percentage {
    font-weight: bold;
    color: #25D366;
    width: 50px;
    text-align: right;
    font-size: 1rem;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #25D366, #128C7E);
    transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    position: relative;
    overflow: hidden;
  }
  
  .progress-fill::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    width: 100%;
    transform: translateX(-100%);
    animation: shimmer 2s infinite;
  }
  
  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }
  
  .progress-text {
    font-size: 1rem;
    font-weight: 500;
    color: #333;
    margin: 5px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .progress-text i {
    color: #25D366;
  }
  
  .progress-info {
    font-size: 0.95rem;
    color: #666;
    text-align: center;
    margin: 10px 0;
  }
  
  .processing-text {
    color: #128C7E;
    font-weight: 500;
    animation: blink 1.5s infinite;
  }
  
  .complete-text {
    color: #28a745;
    font-weight: 500;
  }
  
  .next-text {
    color: #666;
    font-style: italic;
  }
  
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  .fa-spin {
    animation: fa-spin 1.5s infinite linear;
  }
  
  @keyframes fa-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  /* Nuevos estilos para el envío individual */
  .action-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    margin-top: 2rem;
  }
  
  .hidden {
    display: none;
  }
  
  .progress-details {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .badge {
    padding: 5px 12px;
    border-radius: 15px;
    font-size: 0.85rem;
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: all 0.2s ease;
  }
  
  .badge:hover {
    transform: translateY(-2px);
    box-shadow: 0 3px 6px rgba(0,0,0,0.15);
  }
  
  .badge.success {
    background-color: #e7f7ef;
    color: #28a745;
    border: 1px solid #c3e6cb;
  }
  
  .badge.warning {
    background-color: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
  }
  
  .badge.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Estilos para las tarjetas de propiedades */
  .vendor-properties {
    margin-top: 0.4rem;
    width: 100%; /* Ancho completo */
    overflow: visible;
    position: relative;
    min-height: 100px; /* Ajustado para mantener consistencia entre todos los tipos */
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    align-items: center; /* Centrar el contenido horizontalmente */
    justify-content: center; /* Centrar verticalmente también */
  }

  /* Grid para propiedades */
  .property-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px; /* Reducido de 8px a 6px */
    max-height: 160px; /* Reducido de 180px a 160px */
    overflow: hidden;
    width: 100%; /* Usar el ancho completo disponible */
  }

  .property-grid.single-property {
    display: flex;
    justify-content: center; /* Centrar la imagen en el contenedor */
    grid-template-columns: auto;
    width: 100%; /* Usar el ancho completo disponible */
    max-width: none; /* Eliminar la limitación de ancho */
  }

  /* Tarjeta individual de propiedad */
  .property-tile {
    position: relative;
    height: 70px;
    width: 70px;
    aspect-ratio: 1/1; /* Mantiene la proporción cuadrada */
    overflow: hidden; /* Por defecto mantener hidden, en hover será visible */
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    background: #f5f5f5;
    border: 1px solid rgba(0,0,0,0.1);
    transition: all 0.2s ease;
    z-index: 1; /* Nivel base de z-index */
    will-change: transform, box-shadow, z-index; /* Optimización de rendimiento */
  }
  
  /* Estilos para el contenedor de una sola propiedad - alineado verticalmente con múltiples */
  .property-grid.single-property {
    width: 100%; /* Usar todo el ancho disponible */
    max-width: none; /* Eliminar restricción de ancho máximo */
    display: flex;
    justify-content: center;
    align-items: center; /* Centrar verticalmente */
    margin: 0; /* Eliminar márgenes verticales para mejor alineación */
    height: 100px; /* Misma altura que el contenedor de múltiples propiedades */
  }
  
  /* Estilo específico para cuando hay una sola propiedad */
  .single-property .property-tile {
    width: 70px;
    height: 70px;
    max-width: none; /* Eliminar restricción de ancho máximo */
    aspect-ratio: 1/1; /* Mantener proporción cuadrada */
    margin: 0 auto; /* Centrar en el contenedor */
    box-shadow: 0 3px 6px rgba(0,0,0,0.2); /* Sombra más pronunciada para destacar */
    position: relative; /* Asegurar que la posición es relativa para el efecto de hover */
    z-index: 5; /* Establecer un z-index base */
  }
  
  .property-tile:hover {
    transform: scale(1.05); /* Ligero efecto hover */
    box-shadow: 0 3px 6px rgba(0,0,0,0.3);
    z-index: 5;
  }

  /* Diseño de cartas apiladas para múltiples propiedades */
  .property-stack {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center; /* Centrar las cartas horizontalmente */
    height: 110px; /* Reducido de 130px a 110px */
    margin: 10px 0; /* Reducido de 20px a 10px */
    padding: 0; /* Quitamos padding que puede causar desbordamiento */
    overflow: visible;
    z-index: 1;
    min-height: 100px; /* Reducido de 110px a 100px */
    width: 100%; /* Usar todo el ancho disponible */
    max-width: 100%; /* Asegurar que no exceda el contenedor */
    transition: all 0.3s ease;
    box-sizing: border-box; /* Asegurar que el tamaño incluya padding y border */
  }

  .property-stack.last-vendor {
    padding-right: 90px; /* Más espacio para el último vendedor */
  }
  
  .property-stack.hovered {
    z-index: 10; /* Asegurar que al hacer hover esté por encima de otros elementos */
  }

  /* Tarjetas en el modo stack */
  .property-card {
    position: relative;
    height: 70px; /* Reducido de 80px a 70px */
    width: 70px; /* Reducido de 80px a 70px */
    aspect-ratio: 1/1; /* Mantiene la proporción cuadrada */
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transform: translateX(calc(var(--index) * -4px)); /* Reducido de -5px a -4px */
    transition: all 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
    transition-delay: var(--transition-delay, 0ms);
    z-index: calc(10 - var(--index)); /* La primera tarjeta queda al frente por defecto */
    background: #f5f5f5;
    flex-shrink: 0;
    border: 1px solid rgba(0,0,0,0.1);
    margin: 0; /* Quitamos márgenes que puedan causar problemas */
  }

  /* Estilizar el hover en la pila de propiedades - aumenta el tamaño y cambia el z-index */
  .property-stack.hovered .property-card {
    z-index: calc(20 - var(--index)); /* Aumentar el z-index sin mover las tarjetas */
    box-shadow: 0 4px 8px rgba(0,0,0,0.3); /* Sombra más notoria al hacer hover */
    transform: translateX(calc(var(--index) * -4px)) translateY(-2px) scale(1.3); /* Actualizado de -5px a -4px */
    transition-delay: calc(var(--index) * 30ms); /* Efecto secuencial según la posición */
  }

  /* Efecto hover para tarjetas - aumenta z-index y escala */
  .property-card:hover {
    z-index: 30; /* Mayor z-index para estar sobre todas las demás */
    box-shadow: 0 6px 12px rgba(0,0,0,0.25);
    border-color: rgba(0, 0, 0, 0.25);
    transition-delay: 0ms;
    transform: translateX(calc(var(--index) * -4px)) scale(1.3); /* Actualizado de -5px a -4px */
  }

  /* Imagen de la propiedad - ajuste preciso para visualización y proporción */
  .property-image {
    width: 100%;
    height: 100%;
    object-fit: cover;      /* Mantener la proporción de la imagen y llenar el contenedor */
    object-position: center; /* Centrar la imagen dentro del contenedor */
    border-radius: 0;       /* Quitar bordes redondeados en la imagen para evitar espacios blancos */
    display: block;         /* Evitar el espacio extra debajo de la imagen */
    background-color: #f0f0f0; /* Color de fondo mientras carga la imagen */
    transition: all 0.2s ease-out; /* Transición suave para efectos */
    min-width: 100%;        /* Asegurar que la imagen ocupe al menos el ancho completo */
    min-height: 100%;       /* Asegurar que la imagen ocupe al menos el alto completo */
  }
  
  /* Pequeño efecto zoom en hover para dar feedback visual */
  .property-card:hover .property-image {
    transform: scale(1.08); /* Efecto de zoom más notorio */
    filter: brightness(1.05); /* Ligero aumento de brillo para destacar */
    will-change: transform; /* Optimización de rendimiento */
  }
  
  /* Efecto suave en la imagen única - escalado igual que las múltiples */
  .single-property .property-tile:hover {
    transform: scale(1.3); /* Mismo zoom que las tarjetas múltiples */
    z-index: 30; /* Asegurar que esté por encima de otros elementos */
    box-shadow: 0 6px 12px rgba(0,0,0,0.25);
    will-change: transform; /* Optimización de rendimiento */
    overflow: visible; /* Permite que el contenido se muestre fuera del contenedor */
  }
  
  .single-property .property-tile:hover .property-image {
    transform: scale(1.08); /* Mismo zoom que las imágenes múltiples */
    filter: brightness(1.05); /* Ligero aumento de brillo */
  }

  /* Placeholder cuando no hay imagen */
  .property-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #aaa;
    font-size: 1.2rem;
    background-color: #f0f0f0;
  }
  
  /* Capa para mostrar/ocultar las propiedades en hover - mejorada */
  .property-hover-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
    pointer-events: none;
    overflow: visible; /* Permitir que el contenido sea visible fuera del contenedor */
  }
  
  .property-stack.hovered .property-hover-container {
    pointer-events: auto;
    z-index: 100;
  }
  
  /* Contenedor para mantener las tarjetas dentro de los límites visibles */
  .property-container {
    width: 100%;
    position: relative;
    overflow: visible; /* Cambiado de hidden a visible para permitir que el efecto de hover se muestre completo */
    padding: 0; /* Quitar padding */
    margin-bottom: 10px;
    margin-top: 5px;
    z-index: 1; /* Asegurar que tenga un z-index base */
    display: flex; /* Asegura que el contenido se ajuste correctamente */
    justify-content: center; /* Centrar el contenido para mejor presentación */
    box-sizing: border-box; /* Asegurar que el tamaño incluya padding y border */
    min-height: 100px; /* Altura consistente para alinear propiedades individuales y múltiples */
  }
  
  .property-container:hover {
    z-index: 10; /* Aumentar z-index en hover para evitar que otros elementos se superpongan */
    /* overflow: visible; - Ya no es necesario porque siempre es visible */
  }

  /* ID de la propiedad */
  .property-id {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.7);
    color: white;
    font-size: 0.6rem; /* Reducido de 0.65rem a 0.6rem */
    padding: 2px 3px; /* Reducido de 3px 4px a 2px 3px */
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Indicador de propiedades adicionales */
  .property-more {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: #666;
    font-style: italic;
    padding: 4px 8px;
    background: rgba(0,0,0,0.05);
    border-radius: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    margin: 0; /* Eliminar margen que puede causar problemas de alineación */
    z-index: 5; /* Asegurar que esté por encima de las tarjetas */
  }
  
  /* Media queries para pantallas pequeñas - actualizados para consistencia */
  @media (max-width: 768px) {
    .vendor-card {
      min-height: 110px; /* Reducido de 120px a 110px */
    }
    
    .property-stack {
      height: 90px; /* Reducido de 100px a 90px */
      min-height: 80px; /* Reducido de 90px a 80px */
    }
    
    /* Reducir el escalado en pantallas medianas para evitar solapamiento */
    .property-stack.hovered .property-card {
      box-shadow: 0 3px 6px rgba(0,0,0,0.2);
      transform: translateX(calc(var(--index) * -4px)) translateY(-2px) scale(1.2); /* Actualizado de -5px a -4px */
    }
    
    .property-card:hover {
      transform: translateX(calc(var(--index) * -4px)) scale(1.2); /* Actualizado de -5px a -4px */
    }
    
    /* Reducir el escalado de propiedad única en pantallas medianas */
    .single-property .property-tile:hover {
      transform: scale(1.2); /* Mismo zoom que las tarjetas múltiples en media */
    }
  }
  
  @media (max-width: 480px) {
    .vendor-card {
      padding: 0.8rem; /* Reducido de 1rem a 0.8rem */
      padding-left: 2rem; /* Mantener espacio para el checkbox */
      min-height: 90px; /* Reducido de 100px a 90px */
    }
    
    /* Reducir el tamaño en pantallas muy pequeñas */
    .property-card {
      height: 65px; /* Reducido de 70px a 65px */
      width: 65px; /* Reducido de 70px a 65px */
      transform: translateX(calc(var(--index) * -3px)); /* Menos desplazamiento horizontal */
    }
    
    /* Ajustar tamaño para propiedades únicas en móviles */
    .single-property .property-tile {
      width: 65px; /* Reducido de 70px a 65px */
      height: 65px; /* Reducido de 70px a 65px */
    }
    
    /* Altura de stack en móvil */
    .property-stack {
      height: 80px; /* Reducido de 90px a 80px */
      min-height: 75px; /* Reducido de 85px a 75px */
    }
    
    /* Reducir más el escalado en pantallas pequeñas */
    .property-stack.hovered .property-card {
      transform: translateX(calc(var(--index) * -2px)) translateY(-1px) scale(1.15); /* Actualizado de -3px a -2px */
    }
    
    .property-card:hover {
      transform: translateX(calc(var(--index) * -2px)) scale(1.15); /* Actualizado de -3px a -2px */
    }
    
    /* Reducir el escalado de propiedad única en pantallas pequeñas */
    .single-property .property-tile:hover {
      transform: scale(1.15); /* Mismo zoom que las tarjetas múltiples en móvil */
    }
  }

  .no-properties {
    font-size: 0.85rem;
    color: #999;
    font-style: italic;
    padding: 8px 12px;
    background-color: #f5f5f5;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px dashed #ddd;
  }
  
  .no-properties i {
    color: #999;
  }

  /* Estilizado de los datos del vendedor/propietario */
  .vendor-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 3px; /* Reducido de 6px a 3px */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .vendor-phone {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 5px; /* Reducido de 10px a 5px */
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .vendor-phone::before {
    content: "\f095";
    font-family: "Font Awesome 6 Free";
    font-weight: 900;
    font-size: 0.8rem;
    color: #25D366;
  }
  
  .last-activity {
    margin-top: 5px; /* Reducido de 10px a 5px */
    font-size: 0.8rem;
    color: #888;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .last-activity::before {
    content: "\f017";
    font-family: "Font Awesome 6 Free";
    font-weight: 400;
    font-size: 0.8rem;
  }
</style>