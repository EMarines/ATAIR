<script lang="ts">
  import {db, auth} from '$lib/firebase'; // Import the default export
  import { doc, deleteDoc } from 'firebase/firestore';
  import { goto } from '$app/navigation';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { contactsStore, propertiesStore, systStatus, binnaclesStore, property as propertyStore } from '$lib/stores/dataStore';
  import { onMount, onDestroy } from 'svelte';
  import { AddToSchedule, CardBinnacle, CardProperty, Search } from '$components';
  import AddContact from '$lib/components/AddContact.svelte';
  import { formatDate, toComaSep, toTele, infoToBinnacle, findPropertiesForContact, sendWhatsApp, sortBinnacle } from '$lib/functions';
  import { empresa } from '$lib/config/empresa'

  export let data;

  // Declaraciones
  let searchTerm = "";
  let propCheck: Property[] = [];
  let propBinn: Binnacle[] = [];
  let toSend: Property[] = [];
  let sent: Property[] = [];
  let propsStatus = ["Por Enviar", "Enviadas", "Todas"];
  let mostBusq = false;
  let showProp = false;
  let isActivated = false;
  let commInpuyBinnacle = "";
  let propToRender: Property[] = []; 
  let sortedBinn: Binnacle[] = [];
  let toRenBinn: Binnacle[] = [];
  let listToRender: Property[] = [];
  let contacto = {};
  let propFalt = 0;
  let layOut = "";
  let propInterested = "Por Enviar";
  let sig = 0;
  let msg = "";
  // Nuevas variables para manejar las propiedades enviadas y por enviar
  let alreadySentProperties: Property[] = [];
  let recommendedProperties: Property[] = [];

  $: tel = contact?.telephon;
  $: faltanProp = propCheck.length;
  $: properties = $propertiesStore;
  $: binnacles = $binnaclesStore;
  $: property = $propertyStore;

  // Verificar que el contacto tenga un ID válido
  let contactData = data.contact as Contact;
  let contact: Contact;
  
  // Verificación inmediata del ID del contacto
  if (!contactData || !contactData.id || contactData.id.trim() === '') {
    console.error('Error crítico: Contacto cargado sin ID válido', contactData);
    // Redirigir a la lista de contactos si el ID no es válido
    goto("/contacts");
  } else {
    // Solo asignar el contacto si tiene un ID válido
    contact = contactData;
  }
  
  // Verificación reactiva para asegurar que el contacto tenga un ID válido
  $: if (contact && (!contact.id || contact.id.trim() === '')) {
    console.error('Error: Contacto cargado sin ID válido', contact);
    goto("/contacts");
  }

  // Función para mostrar/ocultar la búsqueda
  const mostSearch = () => {
    mostBusq = !mostBusq;
  };

  // Cancel Button ""start""
  function onCancel() {
    goto("/contacts")
  };

  // Cambia systStatus al escribir en Text Area
  function textAreaComm() {
    $systStatus = "sendComm"
    propCheck = [];
  }

  // CRUD edit and delete
  // Edit contact
  function editContact(){
    $systStatus = "editContact";
    layOut = "";
  }

   // Delete contact
   async function deleContact(contactId: string) {
    if (!contactId || contactId.trim() === '') {
        console.error("No se puede eliminar: ID de contacto no disponible o vacío");
        alert("Error: No se puede eliminar el contacto porque el ID no es válido");
        return;
    }

    if (confirm("¿Deseas eliminar definitivamente al contacto?")) {
        try {
            // Crear referencia al documento
            const contactRef = doc(db, "contacts", contactId);
            // Eliminar de Firebase usando deleteDoc
            await deleteDoc(contactRef);
            // Si deleteDoc no lanza error, la eliminación fue exitosa
            goto("/contacts");
        } catch (error) {
            console.error("Error al eliminar el contacto:", error);
            alert("Error al eliminar el contacto: " + error);
        }
    }
  }

    // Muestra las propiedades que le podrían intesar
    function filtProp() {
      console.log("Estas en filtProp");
      // Obtener todas las propiedades recomendadas para este contacto
      propToRender = findPropertiesForContact(contact);
      
      // Obtener IDs de propiedades ya enviadas desde la bitácora
      const sentPropertyIds = sortedBinn
        .filter(item => item.action?.includes("Propiedad enviada"))
        .map(item => item.comment?.trim())
        .filter(Boolean);
      
      // Filtrar las propiedades que ya fueron enviadas
      alreadySentProperties = properties.filter(prop => 
        sentPropertyIds.includes(prop.public_id)
      );
      
      // Ordenar las propiedades enviadas de la más reciente a la más antigua
      alreadySentProperties = orderSentPropertiesByDate(alreadySentProperties);
      
      // Filtrar propiedades recomendadas quitando las ya enviadas
      recommendedProperties = propToRender.filter(prop => 
        !sentPropertyIds.includes(prop.public_id)
      );
      
      console.log("Propiedades recomendadas:", recommendedProperties.length);
      console.log("Propiedades ya enviadas:", alreadySentProperties.length);
      
      showProp = true;
      layOut = "sendProps";
    }

    // Mostrar Schedule
    function addSchedule(){
      isActivated = true;
    };

    // Cerrar Shedule                       
    function close(){
      isActivated = false;
    };

  // Search property by name
  function searProp() {
    showProp = true;
    faltanProp = propCheck.length;
    if(searchTerm.length > 0) {
      $systStatus = "sendProp";
      layOut = "sendProps"; // Cambiar a sendProps para usar el mismo layout de dos columnas
      
      // Obtener IDs de propiedades ya enviadas desde la bitácora
      const sentPropertyIds = sortedBinn
        .filter(item => item.action?.includes("Propiedad enviada"))
        .map(item => item.comment?.trim())
        .filter(Boolean);
      
      // Filtrar las propiedades que ya fueron enviadas
      alreadySentProperties = properties.filter(prop => 
        sentPropertyIds.includes(prop.public_id)
      );
      
      // Ordenar las propiedades enviadas de la más reciente a la más antigua
      alreadySentProperties = orderSentPropertiesByDate(alreadySentProperties);
      
      // Filtrar propiedades según término de búsqueda
      recommendedProperties = properties.filter((propety) => {
        // Buscar según el término de búsqueda
        let contInfo = (propety.public_id + " " + propety.title + " " + propety.location).toLowerCase();
        // No incluir propiedades que ya fueron enviadas
        return contInfo.includes(searchTerm.toLowerCase()) && 
               !sentPropertyIds.includes(propety.public_id);
      });
      
      console.log("Propiedades encontradas en búsqueda:", recommendedProperties.length);
      console.log("Propiedades ya enviadas:", alreadySentProperties.length);
      
      propToRender = [...recommendedProperties, ...alreadySentProperties];
      return propToRender;
    }
  }

  // Cambia el systStatus as escojer una propiedad o varias propiedades
  function sendPropF() {
    $systStatus = "sendProps"
    commInpuyBinnacle = "";
  };

    // Selecciona Mensaje para WA
    async function selMsgWA() {
      // Si no hay propiedad seleccionada, verificamos si el contacto tiene una propiedad asociada
      if (!property) {
        // Prioridad 1: Usar la URL del contacto si existe
        if (contact.publicUrl) {
          commInpuyBinnacle = contact.publicUrl;
          return;
        }
        
        // Prioridad 2: Usar la propiedad del store
        let foundProperty = false;
        const unsubscribe = propertyStore.subscribe(selectedProperty => {
          if (selectedProperty) {
            // Si la propiedad tiene public_url, usarla directamente
            if (selectedProperty && selectedProperty.public_url) {
              commInpuyBinnacle = selectedProperty.public_url;
              foundProperty = true;
            } 
          }
        });
        
        // Limpiar la suscripción
        unsubscribe();
        
        if (foundProperty) {
          return;
        }
      }
      
      // Envía la propiedad seleccionada del listado (propCheck) Alta de Contacto
      if($systStatus === "addContact"){
          let binnacle: Binnacle = {"date": Date.now(), "comment": (`${contact.name} ${contact.lastname}`), "to": contact.id, "action": "Se agregó a: "}
          infoToBinnacle(binnacle)          
          msg = commInpuyBinnacle;
          sendWhatsApp(tel, msg)
          binnacle = {"date": Date.now(), "comment": (property.public_id), "to": contact.id, "action": "Propiedad enviada: "}
          infoToBinnacle(binnacle)
          $systStatus = "msgGratitude";
          commInpuyBinnacle = `Gracias por contactarnos. ${empresa.agentName}, asesor de ventas en ${empresa.companyName}}, tel. ${empresa.phoneNumber}}, email ${empresa.email}.} ✔ Visita ${empresa.companyUrl}✔ ¡Seguro encuentras algo de interés!`;
        // Envia mensaje de agradecimiento después de enviar la propiedad en alta de contacto
        } else if($systStatus === "msgGratitude") {
          // Envía en mensaje de agradecimiento
            let binnacle = {"date": Date.now(), "comment": property.public_id, "to": contact.telephon, "action": "Propiedad enviada: "}
            infoToBinnacle(binnacle)
            msg = commInpuyBinnacle;
            sendWhatsApp(tel, msg)
            $systStatus = "";
        // Envía por WA lo que está en TextArea y guarda la bitácora
        } else if($systStatus === "sendComm"){
            msg = commInpuyBinnacle;
            sendWhatsApp(tel, msg)
            $systStatus = "sendWA"
            let binnacle: Binnacle = {"date": Date.now(), "comment": commInpuyBinnacle, "to": contact.id, "action": "WhatsApp enviado: "}
            infoToBinnacle(binnacle)
        } else if($systStatus === "sendProps"){
            faltanProp = propCheck.length - (sig + 1)
            let msg = propCheck[sig] && propCheck[sig].public_url ? 
              propCheck[sig].public_url : 
              "No hay URL pública disponible para esta propiedad";
            sendWhatsApp(tel, msg)
            
            const sentPropertyId = propCheck[sig] && propCheck[sig].public_id ? propCheck[sig].public_id : "Sin ID público";
            
            let binnacle = {
              "date": Date.now(), 
              "comment": sentPropertyId, 
              "to": contact.id, 
              "action": "Propiedad enviada: "
            }
            infoToBinnacle(binnacle)
            
            // Actualizar las listas de propiedades
            if (propCheck[sig] && propCheck[sig].public_id) {
              // Mover la propiedad de recommendedProperties a alreadySentProperties
              const sentProperty = propCheck[sig];
              // Agregar a propiedades enviadas si no está ya
              if (!alreadySentProperties.some(prop => prop.public_id === sentProperty.public_id)) {
                // Insertar al principio del array (no al final) para que aparezca como la más reciente
                alreadySentProperties = [sentProperty, ...alreadySentProperties];
              }
              // Quitar de propiedades recomendadas
              recommendedProperties = recommendedProperties.filter(
                prop => prop.public_id !== sentProperty.public_id
              );
            }
            
            if (propCheck.length === sig + 1) {
              setTimeout(function() {
                $systStatus = "";
                propCheck = [];
                showProp = false;
                sig = 0;
                faltanProp = 0;
                // Actualizar propToRender para mantener consistencia
                propToRender = [...recommendedProperties, ...alreadySentProperties];
                return;
              }, 2500);
            };
            sig++;
          };
          // Borra la información del envío
          if($systStatus !== "msgGratitude") {
            if($systStatus !== "sendProps") {
              msg = "";
              propCheck = [];
              commInpuyBinnacle = "";
              searchTerm = "";
              $systStatus = "";
              // Actualizar la bitácora para reflejar los cambios
              contBinn();
              
              // Actualizar las listas de propiedades si estamos en la vista de propiedades
              if (layOut === "sendProps" || layOut === "sendProp") {
                // Obtener IDs de propiedades ya enviadas desde la bitácora actualizada
                const sentPropertyIds = sortedBinn
                  .filter(item => item.action?.includes("Propiedad enviada"))
                  .map(item => item.comment?.trim())
                  .filter(Boolean);
                
                // Actualizar las listas basadas en la bitácora actualizada
                alreadySentProperties = properties.filter(prop => 
                  sentPropertyIds.includes(prop.public_id)
                );
                
                // Ordenar las propiedades enviadas de la más reciente a la más antigua
                alreadySentProperties = orderSentPropertiesByDate(alreadySentProperties);
                
                recommendedProperties = propToRender.filter(prop => 
                  !sentPropertyIds.includes(prop.public_id)
                );
              }
            }          
          }
    };

     // Busca la bitácora del contacto
     function contBinn() {
        if (!$binnaclesStore) return [];        
        let bitacora = $binnaclesStore.filter(item => item.to === contact.id);
        return sortedBinn = sortBinnacle(bitacora);
    }

    // Mover la llamada dentro de un $: para que se ejecute cuando binnaclesStore esté listo
    $: if ($binnaclesStore) {
        contBinn();
    }

  function handleListToRender(status: string) {
    if (status === "Por Enviar") {
        listToRender = propToRender.filter(prop => !sent.includes(prop));
    } else if (status === "Enviadas") {
        listToRender = sent;
    } else {
        listToRender = propToRender;
    }
  };

    //  Save notes
    function saveNote() {
        $systStatus = "binnAdding";
        let binnacle: Binnacle = {
            date: Date.now(),
            comment: commInpuyBinnacle,
            to: contact.id,
            action: "Nota agregada: "
        };
        infoToBinnacle(binnacle);
        contBinn();
        commInpuyBinnacle = "";
    }

  onMount(() => {
    // Verificar que el contacto tenga un ID válido
    if (!contact || !contact.id || contact.id.trim() === '') {
      console.error('Error en onMount: Contacto cargado sin ID válido', contact);
      goto("/contacts");
      return;
    }

    // Cargar la URL pública en el textarea
    // Prioridad 1: Usar la URL del contacto si existe
    if (property && property.public_url && $systStatus === "addContact") {
      commInpuyBinnacle = property.public_url;
      return;
    }
    
    // Prioridad 2: Usar la propiedad del store
    const unsubscribe = propertyStore.subscribe(selectedProperty => {
      if (selectedProperty) {
        
        // Si la propiedad tiene public_url, usarla directamente
        if (selectedProperty && selectedProperty.public_url && $systStatus === "addContact") {
          commInpuyBinnacle = selectedProperty.public_url;
        } 
        // Si no tiene public_url pero tiene public_id, generar la URL
        // else if (selectedProperty.public_id) {
        //   const publicUrl = `https://atair.com.mx/property/${selectedProperty.public_id}`;
        //   commInpuyBinnacle = publicUrl;
        // }
      }
    });
        
    // Limpiar la suscripción después de obtener el valor
    unsubscribe();
    
    // Si después de todo esto el textarea sigue vacío, mostrar un mensaje en la consola
    if (!commInpuyBinnacle) {
      console.log("No se encontró ninguna URL pública para cargar en el textarea");
    }
  });

  // Nueva función para ordenar propiedades enviadas por fecha de envío
  function orderSentPropertiesByDate(sentProperties: Property[]): Property[] {
    if (!sortedBinn || !sentProperties.length) return sentProperties;
    
    // Crear un mapa de propiedades con su fecha de envío
    const propertyDatesMap = new Map<string, number>();
    
    // Recorrer la bitácora de más reciente a más antigua para obtener la fecha más reciente
    sortedBinn.forEach(binnacle => {
      if (binnacle.action?.includes("Propiedad enviada")) {
        const propertyId = binnacle.comment?.trim();
        if (propertyId && !propertyDatesMap.has(propertyId)) {
          propertyDatesMap.set(propertyId, binnacle.date || 0);
        }
      }
    });
    
    // Ordenar propiedades por fecha de envío (de más reciente a más antigua)
    return [...sentProperties].sort((a, b) => {
      const dateA = propertyDatesMap.get(a.public_id) || 0;
      const dateB = propertyDatesMap.get(b.public_id) || 0;
      return dateB - dateA; // Orden descendente por fecha
    });
  }

  console.log("systStatus", $systStatus)
</script>

    <!-- Contact Data -->
    <div class="container">
      {#if $systStatus === "editContact"}
      <AddContact 
      existingContact={contact}
      on:cancel={() => $systStatus = ""} 
      on:success={(event) => {
        $systStatus = "";
        // Actualiza el contacto con los datos recién editados
        contact = event.detail.contact;
        // También actualiza el store de contactos si es necesario
        const updatedContacts = $contactsStore.map(c => 
          c.id === contact.id ? contact : c
        );
        contactsStore.set(updatedContacts);
      }}
    />
      {:else}
        <div class="mainContainer">

          <div class="leftContainer">

            <!-- Heaer -->
            <div class="data__container">            
                <div class="left__title">
                  <h1 class="name" title="{contact.name} {contact.lastname}">{contact.name} {contact.lastname}</h1>
                </div>
                <div class="rigth__title">                 
                    <span>Alta el: {formatDate(contact.createdAt)}</span> 
                    <span>{contact.contactStage}</span> 
                </div>
            </div>

            <div class="notes">
              {#if contact.comContact}
                <span title="{contact.comContact}">Notas: {contact.comContact}</span>
              {/if}
            </div>  

            <div class="cont__contact">
              <span>Contactar en:</span>
              {#if contact.telephon}
                <span>Tel: {toTele(contact.telephon)}</span>
              {/if}
              {#if contact.email}
                <span>Email: {contact.email}</span>              
              {/if}
            </div>

            <div class="cont__pref">              
              <span>Notas: {contact.notes}</span>              
            </div>

              <div class="features__search">
                {#if contact.budget}
                    <span>Presupuesto $ {toComaSep(Number(contact.budget))}.</span>
                  {:else}
                    <span>Rango: {contact.rangeProp}</span>
                {/if}
              
                {#if contact.numBeds}
                  <span>{contact.numBeds} <i class="fa-solid fa-bed to__show"></i></span>              
                {/if}
                {#if contact.numBaths}
                  <span>{contact.numBaths} <i class="fa-solid fa-bath to__show"></i></span>              
                {/if}
                {#if contact.halfBathroom}
                  <span>{contact.halfBathroom} <i class="fa-solid fa-toilet to__show"></i></span>              
                {/if}
                {#if contact.numParks}
                  <span>{contact.numParks} <i class="fa-solid fa-car-rear to__show"></i></span>              
                {/if}

                  <div>
                    {#if contact.locaProperty}
                      <span title="{contact.locaProperty.toString().replaceAll(",", ", ")}" > <i class="fa-sharp fa-regular fa-compass to__showR"></i> {contact.locaProperty.toString().replaceAll(",", ", ")} </span>              
                    {/if}
                    {#if contact.tagsProperty}
                      <span title ="{contact.tagsProperty.toString().replaceAll("_", " ").replaceAll(",", ", ")}"><i class="fa-solid fa-tags to__showR"></i> {contact.tagsProperty.toString().replaceAll("_", " ").replaceAll(",", ", ")} </span>              
                    {/if}
                  </div>

              </div> 

          <!-- Buttons schedule, props, prop y return -->
          <div class="btn__actions">

            <div class="icon__actions">
              <button class="btn__common" on:click={addSchedule}><i class="fa-solid fa-calendar-days"></i>Agendar</button>
              <button class="btn__common" on:click={filtProp}><i class="fa-solid fa-house-laptop"></i>Propiedades</button>
              <button class="btn__common" on:click={mostSearch}><i class="fa-solid fa-house-user"></i>Propiedad</button>
              <button class="btn__common" on:click={onCancel}><i class="fa-solid fa-rotate-left"></i>Regresar</button>                      
            </div>

            {#if mostBusq}
              <div class="search">
                <Search bind:searchTerm on:input={searProp} on:keydown={()=>{}}/>
              </div>
            {/if} 

            {#if isActivated}
              <AddToSchedule {contact} on:closeIt = {close} />
            {/if}
                
            <!-- Botonies enviar WA o guardar nota para bitácora -->              
            <div class="textAreaCont">

              <textarea 
                  on:change={textAreaComm} 
                  bind:value={commInpuyBinnacle} 
                  placeholder="Envia una nota por WhatsApp o guarda un nota"></textarea>

                <div class="waSave">
                  {#if !!commInpuyBinnacle || $systStatus === "addContact" || $systStatus === "msgGratitude" || layOut === "sendProp" }
                    <button class="btn__common" on:click={selMsgWA}><i class="fa-brands fa-square-whatsapp"></i>WhatsApp</button>
                    <button class="btn__common" on:click={saveNote}><i class="fa-solid fa-floppy-disk"></i>Guardar Info</button>
                  {/if}
                </div>

            </div>

              <div class="icon__title">
                <i on:click={()=>{editContact()}} 
                   on:keydown={()=>{}} 
                   class="fa-regular fa-pen-to-square"
                   role="button"
                   tabindex="0"
                   aria-label="Edit Contact"></i>
                
                <i on:click={() => deleContact(contact.id)} 
                   on:keydown={()=>{}} 
                   class="fa-regular fa-trash-can"
                   role="button"
                   tabindex="0"
                   aria-label="Delete Contact"></i>
              </div>
            
                  
          </div>

        </div>
      
        <!-- Bitácora del contacto -->
          {#if !layOut }
            <div class="rigthContainer">
              <h1 class="title">Bitácora</h1>
              <div>
                <div class="schedule">
                  <!-- <div class="binnacleHome"> -->
                    {#each sortedBinn as binn}
                      <CardBinnacle {binn} />
                    {/each}
                  <!-- </div>               -->
                </div>
              </div>
            </div>
          {/if}

        </div>
      {/if}

    <!-- </div> -->

    <!-- Tarjeta para propiedad -->
    {#if layOut === "sendProps" || layOut === "sendProp" } 
      <div class="property-section-container">
        <div class="properties-columns">
          <div class="properties-column">
            <div class="title__props">
              <h2 class="title sub">
                {$systStatus === "sendProp" ? "Resultados de búsqueda" : "Propiedades Recomendadas"} 
                ({recommendedProperties.length})
              </h2>
            </div>

            {#if recommendedProperties.length === 0}
              <div class="no-results">
                <p>No se encontraron propiedades {$systStatus === "sendProp" ? "con ese criterio de búsqueda" : "para recomendar"}.</p>
              </div>
            {:else}
              {#if $systStatus === "sendProps" || $systStatus === "sendProp"}
                <div class="buttonSend">
                  <button class="buttSendProps" on:click={selMsgWA}>
                    <i class="fa-brands fa-square-whatsapp"></i>
                    {`Total para enviar ${propCheck.length}. faltan ${faltanProp}`}
                  </button>
                </div>          
              {/if}
              
              <div class="cards__container">          
                {#each recommendedProperties as property}
                  <div class="select__prop">
                    <input type="checkbox" 
                      value={property} 
                      name={property.public_id} 
                      class="form__propCheck" 
                      bind:group={propCheck} 
                      on:click={sendPropF}
                    />	
                    <CardProperty {property} />
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="properties-column">
            <div class="title__props">
              <h2 class="title sub">Propiedades ya enviadas ({alreadySentProperties.length})</h2>
            </div>
            
            {#if alreadySentProperties.length === 0}
              <div class="no-results">
                <p>Aún no se han enviado propiedades a este contacto.</p>
              </div>
            {:else}
              <div class="cards__container">          
                {#each alreadySentProperties as property}
                  <div class="select__prop">
                    <CardProperty {property} />
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

<style>
    .mainContainer {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: stretch; /* Cambia de center a stretch para estirar los contenedores */
      gap: 15px;
      flex: 1;
      min-height: 70vh; /* Altura mínima para el contenedor principal */
    }

    .leftContainer, .rigthContainer {
      display: flex;
      flex-direction: column;
      margin-top: 10px;
      border: 1px solid rgb(56, 56, 56);
      border-radius: 8px;
      box-shadow: 1px 2px rgba(255,255,255, 0.5);
      background: rgb(56, 56, 56);
      height: 60vh; /* Cambiar a auto para permitir que se ajuste al contenido */
      flex: 1; /* Ambos contenedores crecerán para llenar el espacio disponible */
    }

    .leftContainer {
      width: 60%;
      padding: 0 15px 0 15px;
    }

    .rigthContainer {
      font-size: .8rem;
      font-weight: 300;
      line-height: 2rem;
      width: 40%;
      padding: 5px;
      display: flex; /* Asegurar que es flex */
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
      gap: 10px;
    }

  
    /* Contenedor para el título y contenido de la bitácora */
    .rigthContainer > div {
      display: flex;
      flex-direction: column;
      flex: 1; /* Ocupar todo el espacio disponible */
    }

    .schedule {
      display: flex;
      flex-direction: column;
      flex: 1; /* Ocupar todo el espacio disponible */
      overflow: hidden; /* Evitar desbordamiento */
    }

    .title{
      display: flex;
      width: 100%;
      justify-content: center;
    }

    .cont__pref {
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      padding: 10px 0 0 0;
    }

    .data__container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      width: 100%;
      /* height: 60px; */
      padding: 25px 0 20px 0;
      /* background: green; */
    }

    .left__title {
      display: flex;
      width: 70%;
      height: 60px;
      justify-content: center;
      /* Añadir estas propiedades para truncar el texto */
      overflow: hidden;
      position: relative;
    }

    /* Estilo para el nombre que se truncará */
    .left__title .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    /* Tooltip que aparece al hacer hover */
    .left__title .name:hover::after {
      content: attr(title);
      position: absolute;
      left: 0;
      top: 100%;
      z-index: 100;
      background-color: var(--surface-2);
      color: var(--text-1);
      padding: 8px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      white-space: normal;
      max-width: 300px;
      font-size: 0.9rem;
    }

      .rigth__title {
        display: flex;
        font-size: .8em;
        width: 35%;
        height: 60px;
        justify-content: space-between;
      }

      .icon__title {
        display: flex;
        justify-content: space-evenly;
        width: atuto;
      }

    .buttonSend {
      display: flex;
      width: 100%;
      padding: 8px;
      justify-content: center;
      align-items: center;
    }

    .buttSendProps{
      display: flex;
      font-size: 1.5rem;
      padding: 2px 15px;
      align-items: center;
      border-radius: 20px;
      background: rgb(57, 255, 47);
    }

    .fa-square-whatsapp{
      color: rgb(56, 56, 56);
    }


    .cards__container {
      display: flex;
      flex-direction: row;
      width: 100%;
      padding: 0;
      margin: 0;
      flex-wrap: wrap;
      gap: 12px; /* Aumentado para dar más espacio entre tarjetas */
      justify-content: center;
    }
    
    /* Contenedor de la tarjeta con posicionamiento relativo */
    .select__prop {
      position: relative;
      width: 165px;
      height: 165px;
      margin: 0 0 5px 0; /* Añadir margen inferior explícito */
      padding: 0;
      overflow: visible;
    }
    
    /* Aplicar solo transformación de escala al componente original */
    .select__prop :global(.card__container) {
      transform: scale(0.75);
      transform-origin: top left;
      position: absolute;
      top: 0;
      left: 0;
      width: 220px; 
      height: 220px;
      border-radius: 8px;
    }
    
    /* Ajustes para evitar problemas con hover y asegurar que el borde se vea */
    .select__prop :global(.card__prop) {
      border-radius: 8px; /* Reforzar borde redondeado */
    }
    
    .select__prop :global(.card__prop:hover) {
      transform: none !important;
    }
    
    /* Ajuste para el checkbox de selección */
    .form__propCheck {
      position: absolute;
      top: 5px;
      left: 5px;
      z-index: 25;
      width: 15px; /* Ligeramente más grande para mejor usabilidad */
      height: 15px;
    }

    /* Ajustes responsive */
    @media (max-width: 992px) {
      .cards__container {
        gap: 15px; /* Mayor espacio en pantallas medianas */
      }
      
      .select__prop {
        width: 165px;
        height: 165px;
        margin-bottom: 8px; /* Aumentar margen inferior */
      }
    }
    
    @media (max-width: 768px) {
      .cards__container {
        justify-content: center;
        gap: 12px 15px; /* Espacio horizontal y vertical separado */
      }
      
      .select__prop {
        width: 150px;
        height: 150px;
        margin-bottom: 15px; /* Mayor espacio vertical para evitar solapamiento */
      }
    }
    
    @media (max-width: 480px) {
      .cards__container {
        gap: 10px 15px; /* Espacio horizontal y vertical */
      }
      
      .select__prop {
        width: calc(50% - 15px); /* 2 tarjetas por fila con margen lateral */
        max-width: 150px;
        min-width: 130px;
        height: 150px;
        margin-bottom: 20px; /* Espacio vertical significativo en móviles */
      }
      
      /* Ajustar posición para evitar solapamiento en móviles */
      .select__prop :global(.card__container) {
        transform: scale(0.7); /* Escala ligeramente menor en móviles */
      }
    }

    .property-section-container {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 2px solid rgba(255, 255, 255, 0.2);
    }

    .no-results {
      padding: 20px;
      text-align: center;
      font-size: 1.1rem;
      color: #ffcccc;
    }

    .properties-columns {
      display: flex;
      width: 100%;
      gap: 20px;
    }
    
    .properties-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px;
      border: 1px solid rgb(56, 56, 56);
      border-radius: 8px;
      background-color: rgba(56, 56, 56, 0.1);
      overflow-y: auto; /* Enable scrolling for columns with many properties */
      max-height: 80vh; /* Limit the height to prevent excessive scrolling */
    }

    .btn__actions {
      display: flex;
      flex-direction: column;
      /* align-items: center; */
      width: 100%;
      padding: 20px 0;
      /* gap: 20px; */
      /* background: lightskyblue; */
    }

    .icon__actions {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-evenly;
    }

    .search {
      display: flex;
      justify-content: center;
      margin: 10px 0;
    }
    
    .textAreaCont {
      display: flex;
      flex-direction: column;
      padding: 20px;
      align-items: center;
      justify-content: center;
      width: 100%;
      /* background: coral; */
    }

    textarea {
      border-radius: 8px;
      width: 60%;
      height: 100px;
      padding: 8px;
      margin-bottom: 12px;
    }
    
    .notes {
      display: flex;
      padding: 5px;
      justify-content: center;
      gap: 10px;      
    }

    .features__search {
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .cont__contact {
      display: flex;
      justify-content: center;
      gap: 10px;
    }

    .title__props {
      display: flex;
      justify-content: center;
    }
    
    .waSave {
      display: flex;
      justify-content: space-evenly;
    }

      i {
        font-size: 1.8rem;
        padding: 5px 15px 5px 0;
      }

      .to__show {
        font-size: 1rem;
        padding: 5px 20px 5px 5px;
      }

      .to__showR {
        font-size: 1rem;
        padding: 5px 5px 5px 20px;
      }

      .fa-square-whatsapp {
        color: rgb(2, 255, 2);
      }

      .fa-pen-to-square, .fa-trash-can {
        display: flex;
        align-items:baseline;
        font-size: 1.2rem;

      }

      .btn__common {
        width: 150px;
        background: rgb(255, 247, 238);
        border-radius: 15px;
        cursor: pointer;
      }

      .btn__common:hover {
        color: rgb(153, 153, 0);
      }

      .select__prop{
        position: relative;
      }

      .form__propCheck {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 20;
      }

      .properties-columns {
        display: flex;
        width: 100%;
        gap: 20px;
      }
      
      .properties-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px;
        border: 1px solid rgb(56, 56, 56);
        border-radius: 8px;
        background-color: rgba(56, 56, 56, 0.1);
      }
      
      @media (max-width: 1000px) {
        .properties-columns {
          flex-direction: column;
        }
        
        .properties-column {
          width: 100%;
          margin-bottom: 20px;
        }
      }

      @media (max-width:1200px){
      .mainContainer{
        flex-direction: column;
        margin: 0 auto;
      }

      .rigthContainer, .leftContainer {
        width: 100%;
      }
      
      .rigthContainer {
        height: auto;
        min-height: 300px; /* Altura mínima en modo móvil */
      }
    }

    @media (max-width:500px){

      .data__container {
        flex-direction: column;
      }
      
      textarea{
        width: 100%;
      }
      i {
        padding-right: 25px;
      }
      .waSave{
        flex-direction: column;
        width: 100%;
        align-items: center;
        gap: 5px;
      }
      .btn__common{
        width: 90%;
      }
   
      .cont__contact{
        flex-direction: column;
      }

      .title__props {
        font-size: .6rem;
        padding: 20px;
      }

      .form__propCheck {
        position: absolute;
        top: 5px; left: 5px;
      }

      .left__title {
        display: felx;
        justify-content: center;
        align-items: center;
        width: 100%;
        font-weight: bold;
        height: auto;
        margin-bottom: 10px;
        overflow: visible; /* Cambiar de 'hidden' a 'visible' */
      }
      
      .left__title .name {
        font-size: 2rem;
        max-width: 100%;
        padding: 0 10px;
        white-space: normal; /* Cambiar de 'nowrap' a 'normal' */
        overflow: visible; /* Cambiar de 'hidden' a 'visible' */
        text-overflow: clip; /* Quitar ellipsis */
        word-wrap: break-word; /* Permitir que las palabras se rompan */
      }
      
      .rigth__title {
        width: 100%; /* Cambia de 30% a 100% */
        justify-content: space-around; /* Mejor distribución en móvil */
      }
         
    }

</style>