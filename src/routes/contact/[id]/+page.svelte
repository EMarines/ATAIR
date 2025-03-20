<script lang="ts">
  import { firebase } from '$lib/stores/firebaseStores';
  // import { deleteDoc, doc } from 'firebase/firestore';
  import { goto } from '$app/navigation';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { contactsStore, propertiesStore, systStatus, binnaclesStore, property as propertyStore } from '$lib/stores/dataStore';
  import { onMount, onDestroy } from 'svelte';
  import { AddToShedule, CardBinnacle, CardProperty, Search } from '$components';
  import AddContact from '$lib/components/AddContact.svelte';
  import GoogleContactsSync from '$lib/components/GoogleContactsSync.svelte';
  import { formatDate, toComaSep, toTele, infoToBinnacle, filtContPropInte, sendWhatsApp, sortBinnacle } from '$lib/functions';

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
  // let property: Property;

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
  }

   // Delete contact
   async function deleContact(contactId: string) {
    console.log("contactId", contactId)
    if (!contactId || contactId.trim() === '') {
        console.error("No se puede eliminar: ID de contacto no disponible o vacío");
        alert("Error: No se puede eliminar el contacto porque el ID no es válido");
        return;
    }

    if (confirm("¿Deseas eliminar definitivamente al contacto?")) {
        try {
            // Verificar si el contacto está sincronizado con Google
            const googleContactsMapStr = localStorage.getItem('googleContactsMap');
            if (googleContactsMapStr) {
                const googleContactsMap = JSON.parse(googleContactsMapStr);
                const googleResourceName = googleContactsMap[contactId];
                
                // Si está sincronizado con Google, eliminarlo automáticamente
                if (googleResourceName) {
                    try {
                        // Importar la función necesaria para eliminar de Google
                        const { deleteGoogleContact, getAccessToken } = await import('$lib/services/googleService');
                        
                        // Obtener token de acceso
                        const accessToken = await getAccessToken();
                        if (!accessToken) {
                            console.log("No se pudo obtener un token de acceso válido para Google. El contacto se eliminará solo de la base de datos local.");
                        } else {
                            // Eliminar de Google
                            await deleteGoogleContact(googleResourceName, accessToken);
                            
                            // Eliminar la asociación
                            delete googleContactsMap[contactId];
                            localStorage.setItem('googleContactsMap', JSON.stringify(googleContactsMap));
                            
                            console.log("Contacto eliminado exitosamente de Google Contacts");
                        }
                    } catch (googleError) {
                        console.error("Error al eliminar el contacto de Google:", googleError);
                        console.log("Error al eliminar el contacto de Google Contacts. El contacto se eliminará solo de la base de datos local.");
                    }
                }
            }
            
            // Eliminar de Firebase
            const result = await firebase.delete("contacts", contactId);
            if (result?.success) {
                goto("/contacts");
            } else {
                console.error("Error al eliminar el contacto:", result?.error);
                alert("Error al eliminar el contacto: " + (result?.error || "Error desconocido"));
            }
        } catch (error) {
            console.error("Error al eliminar el contacto:", error);
            alert("Error al eliminar el contacto: " + error);
        }
    }
  }

    // Muestra las propiedades que le podrían intesar
    function fitProp() {
      // contacto = $contact
      propToRender = filtContPropInte(contact) 
      showProp = true;
      layOut = "sendProps"
    };

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
    faltanProp = propCheck.length
    if(searchTerm.length > 0 ) {
      $systStatus = "sendProp";
      layOut = "sendProp";
    }
      return propToRender = properties.filter((propety) => {
        const locationStr = typeof propety.location === 'string' ? propety.location : propety.location.name;
        let contInfo = (propety.public_id + " " + propety.title + " " + locationStr).toLowerCase();
        return contInfo.includes(searchTerm.toLowerCase());
      });  
    };

      // Cambia el systStatus as escojer una propiedad o varias propiedades
      function sendPropF() {
        $systStatus = "sendProps"
        commInpuyBinnacle = "";
      };

    // Selecciona Mensaje para WA
    async function selMsgWA() {
      // Primero intentamos usar la propiedad seleccionada de la lista
      // property = propCheck[sig];
      
      // Si no hay propiedad seleccionada, verificamos si el contacto tiene una propiedad asociada
      if (!property) {
        // Prioridad 1: Usar la URL del contacto si existe
        if (contact.publicUrl) {
          console.log("Usando URL pública del contacto:", contact.publicUrl);
          commInpuyBinnacle = contact.publicUrl;
          return;
        }
        
        // Prioridad 2: Usar la propiedad del store
        let foundProperty = false;
        const unsubscribe = propertyStore.subscribe(selectedProperty => {
          if (selectedProperty) {
            console.log("Propiedad encontrada en el store:", selectedProperty);
            
            // Si la propiedad tiene public_url, usarla directamente
            if (selectedProperty && selectedProperty.public_url) {
              commInpuyBinnacle = selectedProperty.public_url.replace("easybroker.com/mx/listings", "matchhome.net/property");
              console.log("URL pública cargada directamente desde propertyStore.public_url:", commInpuyBinnacle);
              foundProperty = true;
            } 
            // Si no tiene public_url pero tiene public_id, generar la URL
            else if (selectedProperty.public_id) {
              const public_url = "https://matchhome.net";
              commInpuyBinnacle = public_url;
              foundProperty = true;
            }
          }
        });
        
        // Limpiar la suscripción
        unsubscribe();
        
        if (foundProperty) {
          return;
        }
        
        // Si no hay ninguna propiedad disponible
        console.error("Error: No hay una propiedad seleccionada para compartir");
        alert("No hay una propiedad seleccionada para compartir");
        return;
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
          commInpuyBinnacle = "Gracias por contactarnos. Enrique Marines, asesor de ventas en Match Home, tel. 614 540 4003, email matchhome@hotmail.com ✔ Visita matchhome.net ✔ ¡Seguro encuentras algo de interés!";
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
      // Envía por WA las propiedades seleccionadas
      } else if($systStatus === "sendProps"){
          faltanProp = propCheck.length - (sig + 1)
          console.log("propCheck", propCheck[sig], sig)
          let msg = propCheck[sig] && propCheck[sig].public_url ? 
            propCheck[sig].public_url : 
            "No hay URL pública disponible para esta propiedad";
          sendWhatsApp(tel, msg)
          let binnacle = {
            "date": Date.now(), 
            "comment": propCheck[sig] && propCheck[sig].public_id ? propCheck[sig].public_id : "Sin ID público", 
            "to": contact.id, 
            "action": "Propiedad enviada: "
          }
          infoToBinnacle(binnacle)
          if ( propCheck.length === sig + 1 ) {
            setTimeout ( function(){
              $systStatus = "";
              propCheck = [];
              showProp = false;
              sig = 0;
              faltanProp = 0;
              return
            }, 2500);
          };
          sig ++    
        };
        // Borra la información del envío
        if($systStatus !== "msgGratitude") {
          if($systStatus !== "sendProps") {
            msg = "";
            propCheck = [];
            commInpuyBinnacle = "";
            searchTerm = "";
            $systStatus = "";
            contBinn();
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
    if (property && property.public_url) {
      commInpuyBinnacle = property.public_url.replace("easybroker.com/mx/listings", "matchhome.net/property");
      console.log("URL pública cargada desde el contacto:", commInpuyBinnacle);
      return;
    }
    
    // Prioridad 2: Usar la propiedad del store
    const unsubscribe = propertyStore.subscribe(selectedProperty => {
      if (selectedProperty) {
        console.log("Propiedad encontrada en el store:", selectedProperty);
        
        // Si la propiedad tiene public_url, usarla directamente
        if (selectedProperty && selectedProperty.public_url) {
          commInpuyBinnacle = selectedProperty.public_url.replace("easybroker.com/mx/listings", "matchhome.net/property");
          console.log("URL pública cargada directamente desde propertyStore.public_url:", commInpuyBinnacle);
        } 
        // Si no tiene public_url pero tiene public_id, generar la URL
        else if (selectedProperty.public_id) {
          const publicUrl = `https://atair.com.mx/property/${selectedProperty.public_id}`;
          commInpuyBinnacle = publicUrl;
          console.log("URL pública generada desde propertyStore.public_id:", publicUrl);
        }
      }
    });
    
    // Limpiar la suscripción después de obtener el valor
    unsubscribe();
    
    // Si después de todo esto el textarea sigue vacío, mostrar un mensaje en la consola
    if (!commInpuyBinnacle) {
      console.log("No se encontró ninguna URL pública para cargar en el textarea");
    }
  });
</script>

  <!-- Contact Data -->
    <div class="container">
      {#if $systStatus === "editContact"}
        <AddContact 
          existingContact={contact}
          on:cancel={() => $systStatus = ""} 
          on:success={() => {
            $systStatus = "";
            // Recargar la página para ver los cambios
            window.location.reload();
          }}
        />
      {:else}
        <div class="mainContainer">

          <div class="leftContainer">

            <!-- Heaer -->
            <div class="data__container">            
                <div class="left__title">
                  <h1 class="name">{contact.name} {contact.lastname}</h1>
                </div>
                <div class="rigth__title">
                  <div class="icon__title">

                    <i on:click={()=>{editContact()}} 
                       on:keydown={()=>{}} 
                       class="fa-regular fa-pen-to-square"
                       role="button"
                       tabindex="0"></i>

                    <i on:click={() => deleContact(contact.id)} 
                       on:keydown={()=>{}} 
                       class="fa-regular fa-trash-can"
                       role="button"
                       tabindex="0"></i>
                  </div>
                    <span>Alta el: {formatDate(contact.createdAt)}</span>  
                </div>
            </div>

          <!-- Contact, notes and features-->
          <div>

            <div class="sub__title">
              {#if contact.budget}
                  <span>Presupuesto $ {toComaSep(Number(contact.budget))}.</span>
                {:else}
                  <span>Rango: {contact.rangeProp}</span>
              {/if}
              <span>{contact.contactStage}</span>
            </div>

            <div class="notes">
              {#if contact.comContact}
                <h3>Notas:</h3>
                <span>{contact.notes}</span>              
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
  
            <div class="cont__requires">          
             
              
              <div class="features__search">
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
                      <span> <i class="fa-sharp fa-regular fa-compass to__showR"></i> {contact.locaProperty.toString().replaceAll(",", ", ")} </span>              
                    {/if}
                    {#if contact.tagsProperty}
                      <span><i class="fa-solid fa-tags to__showR"></i> {contact.tagsProperty.toString().replaceAll("_", " ").replaceAll(",", ", ")} </span>              
                    {/if}
                  </div>

              </div> 

            </div>

          </div>
          
          <!-- Buttons schedule, props, prop y return -->
          <div class="btn__actions">

            <div class="icon__actions">
              <button class="btn__common" on:click={addSchedule}><i class="fa-solid fa-calendar-days"></i>Agendar</button>
              <button class="btn__common" on:click={fitProp}><i class="fa-solid fa-house-laptop"></i>Propiedades</button>
              <button class="btn__common" on:click={mostSearch}><i class="fa-solid fa-house-user"></i>Propiedad</button>
              <button class="btn__common" on:click={onCancel}><i class="fa-solid fa-rotate-left"></i>Regresar</button>                      
            </div>

            <!-- Componente invisible que maneja la sincronización en segundo plano - solo se renderiza si el contacto tiene un ID válido -->
            {#if contact && contact.id && contact.id.trim() !== ''}
              <GoogleContactsSync contact={contact} />
            {/if}

            {#if mostBusq}
              <div class="search">
                <Search bind:searchTerm on:input={searProp} on:keydown={()=>{}}/>
              </div>
            {/if} 

            {#if isActivated}
              <AddToShedule {contact} on:closeIt = {close} />
            {/if}
                
            <!-- Botonies enviar WA o guardar nota para bitácora -->              
            <div class="textAreaCont">
              <div class="textarea-wrapper">
                <textarea 
                  on:change={textAreaComm} 
                  class="texArea" 
                  bind:value={commInpuyBinnacle} 
                  placeholder="Ingresa un comentario o selecciona una propiedad para compartir"></textarea>
                {#if commInpuyBinnacle && commInpuyBinnacle.includes('atair.com.mx/property/')}
                  <button 
                    class="copy-button" 
                    on:click={() => {
                      navigator.clipboard.writeText(commInpuyBinnacle);
                      alert('URL copiada al portapapeles');
                    }}
                    title="Copiar al portapapeles"
                  >
                    <i class="fa-regular fa-copy"></i>
                  </button>
                {/if}
              </div>
              <div class="waSave">
                {#if !!commInpuyBinnacle || $systStatus === "addContact" || $systStatus === "msgGratitude" || layOut === "sendProp" }
                  <button class="btn__common" on:click={selMsgWA}><i class="fa-brands fa-square-whatsapp"></i>WhatsApp</button>
                  <button class="btn__common" on:click={saveNote}><i class="fa-solid fa-floppy-disk"></i>Guardar Info</button>
                {/if}
              </div>
            </div>
                  
          </div>

        </div>
      
        <!-- Bitácora del contacto -->
          {#if !layOut }
            <div class="rigthContainer">
              <h1 class="title">Bitácora</h1>
              <div>
                <div class="schedule">
                  <div class="binnacleHome">
                    {#each sortedBinn as binn}
                      <CardBinnacle {binn} />
                    {/each}
                  </div>              
                </div>
              </div>
            </div>
          {/if}

        </div>
      {/if}

    </div>

  <!-- Tarjeta para propiedad -->
    {#if layOut === "sendProps" || layOut === "sendProp"} 

      <div class="container">

        <div class="title__props">
          <h2 class="title sub">{propToRender.length} Propiedades encontradas</h2>
        </div>

          {#if $systStatus === "sendProps"}
            <div class="buttonSend">
              <button class="buttSendProps" on:click={selMsgWA}>
                <i class="fa-brands fa-square-whatsapp"></i>
                {$systStatus !== "sendProps" ? "Enviar propiedades seleccionadas" : `Total para enviar ${propCheck.length}. faltan ${faltanProp}`}
              </button>
            </div>          
          {/if}
          
          <div class="propRegister">
            {#each propsStatus as list}
                <label>
                    <input type="radio" 
                        bind:group={propInterested} 
                        value={list} 
                        on:change={() => handleListToRender(list)}
                    >
                    {list}
                </label>
            {/each}
          </div>
          
        
        <div class="card__container">          
          {#each propToRender as property}
            <div class="select__props">
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
        
      </div>
  
    {/if}

<style>
  /* General */
    .mainContainer {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      gap: 15px;
      flex: 1;
    }
  
    .leftContainer {
      display: flex;
      flex-direction: column;
      width: 60%;
      height: 500px;
      margin-top: 10px;
      border: 1px solid rgb(56, 56, 56);
      border-radius: 8px;
      box-shadow: 1px 2px rgba(255,255,255, 0.5);
      background: rgb(56, 56, 56);
      padding: 0 15px 0 15px;
    }
    
    .rigthContainer {
      display: flex;
      flex-direction: column;
      font-size: .8rem;
      font-weight: 300;
      line-height: 2rem;
      height: 500px;
      width: 40%;
      margin-top: 10px;
      border: 1px solid rgb(56, 56, 56);
      border-radius: 8px;
      box-shadow: 1px 2px rgba(255,255,255, 0.5);
      background: rgb(56, 56, 56);
      padding: 5px;
      overflow-y: scroll;
      border-radius: 8px;
      gap: 10px;
    }

    .title{
      display: flex;
      width: 100%;
      justify-content: center;
    }

    .sub__title {
      display: flex;
      justify-content: space-evenly;
      padding: 10px 0 0 0;
    }

    .data__container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 60px;
      padding: 25px 0 20px 0;
      /* background: green; */
    }

    .left__title{
        display: flex;
        width: 70%;
        height: 60px;
        justify-content: center;
        /* background-color: bisque; */
      }

      .rigth__title {
        display: flex;
        width: 30%;
        height: 60px;
        flex-direction: column;
        justify-content: space-between;
      }

      .icon__title {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
      }

    .buttonSend {
      display: flex;
      width: 100%;
      padding: 8px;
      justify-content: center;
      align-items: center;
      background: wheat;
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


    .card__container {
      display: flex;
      flex-direction: row;
      width: 100%;
      max-width: 1200px;
      padding: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 15px;
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
      padding: 15px;
      /* height:550px; */
      justify-content: center;
      gap: 15px;
    }

    .title__props {
      display: flex;
      justify-content: center;
    }
    
    .cont__requires {
      display: flex;
      flex-direction: column;
      padding: 0 0 0 15px;
      align-items: center;
      gap: 15px;
    }

    .waSave {
      display: flex;
      justify-content: space-evenly;
    }

      .schedule{
        display: flex;
        align-items: left;
        justify-content: left;
      }
      .binnacleHome {
        display: flex;
        flex-direction: column;
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

      .select__props{
        position: relative;
      }

      .form__propCheck {
        position: absolute;
        top: 10px; left: 10px;
      }


      @media (max-width:1200px){
      .mainContainer{
        flex-direction: column;
        margin: 0 auto;
      }
      .rigthContainer{
        width: 100%;
        height: auto;
      }
      .leftContainer {
          width: 100%;
        }
    }

    @media (max-width:400px){
      
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
         
    }

    /* Google Sync Container */
    .google-sync-container {
      display: flex;
      width: 100%;
      margin: 1rem 0;
      justify-content: center;
    }

    .google-sync-container :global(.google-sync) {
      width: 100%;
      max-width: 400px;
    }
  
      
    .textarea-wrapper {
      position: relative;
      width: 100%;
    }
  
    .copy-button {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #6b21a8;
      color: white;
      border: none;
      border-radius: 4px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
  
    .copy-button:hover {
      background: #8b5cf6;
      transform: scale(1.05);
    }
</style>