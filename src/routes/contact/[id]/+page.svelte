<script lang="ts">
  import { firebase } from '$lib/stores/firebaseStores';
  // import { deleteDoc, doc } from 'firebase/firestore';
  import { goto } from '$app/navigation';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { CardContact, CardBinnacle, AddToShedule, CardProperty, Search } from '$components';
  import { formatDate, toComaSep, toTele, infoToBinnacle, filtContPropInte, sendWhatsApp, sortBinnacle } from '$lib/functions';
  import { systStatus, propertiesStore, binnaclesStore } from '$lib/stores/dataStore';


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
  let property: Property;

  $: tel = contact?.telephon;
  $: faltanProp = propCheck.length;
  $: properties = $propertiesStore;
  $: binnacles = $binnaclesStore;
  const contact = data.contact as Contact;

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
    console.log("editContact", contact.id);
    $systStatus = "editing"
    goto("/contacts")
  }

   // Delete contact
   async function deleContact(contactId: string) {
    if (!contactId) {
        console.error("No se puede eliminar: ID de contacto no disponible");
        return;
    }

    if (confirm("¿Deseas eliminar definitivamente al contacto?")) {
        try {
            const result = await firebase.delete("contacts", contactId);
            if (result?.success) {
                goto("/contacts");
            } else {
                console.error("Error al eliminar el contacto:", result?.error);
            }
        } catch (error) {
            console.error("Error al eliminar el contacto:", error);
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
        let contInfo = (propety.public_id + " " + propety.title + " " + propety.location.name).toLowerCase();
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
      property = propCheck[sig]
      console.log("Property", property, sig, $systStatus)
      // Envía la propiedad seleccionada del listado (propCheck) Alta de Contacto
      if($systStatus === "addContact"){
          let binnacle: Binnacle = {"date": Date.now(), "comment": (`${contact.name} ${contact.lastname}`), "to": contact.id, "action": "Se agregó a: "}
          infoToBinnacle(binnacle)          
          msg = property.public_url;
          console.log("msg", msg, $systStatus)
          sendWhatsApp(tel, msg)
          binnacle = {"date": Date.now(), "comment": (property.public_id), "to": contact.id, "action": "Propiedad enviada: "}
          infoToBinnacle(binnacle)
          $systStatus = "msgGratitude";
      // Envia mensaje de agradecimiento después de enviar la propiedad en alta de contacto
      } else if($systStatus === "msgGratitude") {
        // Envía en mensaje de agradecimiento
           let binnacle = {"date": Date.now(), "comment": property.public_id, "to": contact.telephon, "action": "Propiedad enviada: "}
          infoToBinnacle(binnacle)
          msg = "Gracias por contactarnos. Enrique Marines, asesor de ventas en Match Home, tel. 614 540 4003, email matchhome@hotmail.com ✔ Visita matchhome.net ✔ ¡Seguro encuentras algo de interés!"
          sendWhatsApp(tel, msg)
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
          let msg = propCheck[sig].public_url
          sendWhatsApp(tel, msg)
          let binnacle = {"date": Date.now(), "comment": propCheck[sig].public_id, "to": contact.id, "action": "Propiedad enviada: "}
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
            to: contact.telephon,
            action: "Nota agregada: "
        };
        infoToBinnacle(binnacle);
        contBinn();
        commInpuyBinnacle = "";
    }
</script>

  <!-- Contact Data -->
    <div class="container">

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
                  <i on:click={() => deleContact} 
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
              <span>{contact.comContact}</span>              
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
            <textarea 
              on:change={textAreaComm} 
              class="texArea" 
              bind:value={commInpuyBinnacle} 
              placeholder="Ingresa un comentario"></textarea>
            <div class="waSave">
              {#if !!commInpuyBinnacle || $systStatus === "addContact" || $systStatus === "msgGratitude" || layOut === "sendProp" }
                <button  class="btn__common" on:click={selMsgWA}><i class="fa-brands fa-square-whatsapp"></i>WhatsApp</button>
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
          {#each propToRender as prop}
            <div class="select__props">
              <input type="checkbox" 
                value={prop} 
                name={prop.public_id} 
                class="form__propCheck" 
                bind:group={propCheck} 
                on:click={sendPropF}
              />	
              <CardProperty {prop} />
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
      gap: 10px;
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
      border: 1px solid rgb(56, 56, 56);
      border-radius: 8px;
      box-shadow: 1px 2px rgba(255,255,255, 0.5);
      background: rgb(56, 56, 56);
      gap: 4px;
      padding: 15px;
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

  
      
</style>