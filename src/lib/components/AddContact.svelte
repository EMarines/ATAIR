<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { AddContactEvents } from '$lib/types';
    import { goto } from '$app/navigation';
    import { collection, addDoc, deleteDoc, getDoc, getDocs, doc, updateDoc} from 'firebase/firestore';
    import { db } from '$lib/firebase';
    import { systStatus, propertiesStore, contact, property} from '$lib/stores/dataStore';
    import { Search, Tags, Ubication, InputText, InputOptions, InputEmail, InputDate, CardProperty } from '$components';
    import { mosRange, infoToBinnacle, cleanNumber, cleanName, convertOperationEbFb } from '$functions'
    import { typeContacts, modeContact, typeProperties, modePays, oneToFive, oneToFour, oneToThree, contStage, range } from '$lib/parameters';
    import type { Property, Contact } from '$lib/types';
	import { firebase } from '$lib/stores/firebaseStores';

    let dataAdd = false;
    let propChecked: Property[] = [];
    let searchTerm = "";
    let propCheck = [];
    let propBinn = [];
    let toSend = [];
    let sent = [];
    let propsStatus = ["Por Enviar", "Enviadas", "Todas"];
    let mostBusq = false;
    let showProp = false;
    let isActivated = false;
    let commInpuyBinnacle = "";
    let propToRender = $propertiesStore; 
    let sortedBinn = [];
    let toRenBinn = [];
    let propFalt = 0;
    let layOut = "";
    let propInterested = "Por Enviar";
    let sig = 0;
    let msg = "";

    // $: tel = $contact?.telephon;
    $: faltanProp = propCheck.length;

    if($contact.id === ""){
      console.log("estas en el contact.id ===", $contact);
    } else {
      console.log("estas en el contact", $contact);
    }

    // $contact = ;
    // Inicializar el store contact si es null
    // $: if (!$contact) {
    //     contact.set({
    //       createdAt: Date.now(),
    //         name: '',
    //         typeContact: '',
    //         telephon: '',
    //         lastname: '',
    //         email: '',
    //         budget: 0,
    //         selecTP: '',
    //         contactStage: '',
    //         comContact: '',
    //         tagsProperty: [],
    //         locaProperty: [],
    //         color: '',
    //         contactType: '',
    //         contMode: '',
    //         halfBathroom: '',
    //         id: '',
    //         lastContact: 0,
    //         modePay: '',
    //         numBaths: '',
    //         numBeds: '',
    //         numParks: '',
    //         propCont: '',
    //         rangeProp: '',
    //         selecTO: '',
    //         selecMC: '',
    //         sendedProperties: [],
    //         title: '',
    //         typeProperty: '',
    //         typeOperation: ''
    //     });
    // }

   let contacto: Contact;

  // let propToRender = $propertiesStore
  
    // Handle Submit
        async function handleSubmit(propChecked: Property[]) {
            try {
                // Validación básica
                if (!$contact?.name || !$contact?.email || !$contact?.telephon) {
                    throw new Error('Por favor complete los campos requeridos');
                }

                $property = propChecked[0];
                
                // contacto.telephon = cleanNumber($contact.telephon);
                // contacto.name = cleanName($contact.name);
                // contacto.lastname = cleanName($contact.lastname);
                // if (contacto.budget) {
                //     contacto.budget = Number(cleanNumber(contacto.budget.toString()));
                // }
                
                // $contact = contacto;
                console.log("estas en el contact", $contact);
                try {
                    if ($contact) {
                        $contact.telephon = cleanNumber($contact.telephon || '');
                        $contact.name = cleanName($contact.name || '');
                        $contact.lastname = cleanName($contact.lastname || '');
                        if ($contact.budget) {
                            $contact.budget = Number(cleanNumber($contact.budget.toString()));
                        }
                    }
                    console.log("estas en el contact", $contact);
                } catch (error) {
                    console.log(error);
                }        
                // Edita a contacto
                if($systStatus === "editing"){ 
                    try {
                        await firebase.update('cotacts', $contact.id, $contact);
                        // await updateDoc(doc(db, "contacts", $contact.id), $contact);
                    } catch (error) {
                        console.log(error);
                    } 
                } else {
                    // Da de alta al contacto con los datos de la propiedad por la que contactó
                    $contact.createdAt= Date.now();            
                    $contact.contactStage = "Etapa 1"
                    if($property){
                        $contact.selecTP = $property.property_type
                        $contact.typeContact = convertOperationEbFb($property.operations[0].type)
                        $contact.rangeProp = mosRange(Number($property.budget))
                    }
    
                    try {
                        const contToAdd = collection(db, "contacts")
                        await addDoc(contToAdd, $contact);
                        $systStatus = "addContact"              
                    } catch (error) {
                        console.log(error);
                    }
                }   
                contact.reset();
                $systStatus = ""

                dispatch('success', { contact: $contact });
            } catch (error) {
                console.error(error);
                dispatch('error', { error });
            }
        }
  
    // Cancel
        function onCancel() {
            $contact = null;
            $systStatus = "";
            dispatch('cancel');
        }
  
    // Search property by name

        function searProp(searchTerm: string) {
          if(searchTerm.length !== 0){
          showProp = true;
          return propToRender = $propertiesStore.filter((propety) => {
            let contInfo = (propety.location.name + " " + propety.title + " " + propety.public_id).toLowerCase();
            return contInfo.includes(searchTerm.toLowerCase());
          });
        } else {
          showProp = false;
        }
        };
  
        // Muestra el resto del fromulario
        function detaAlta(e){
          e.preventDefault();
           dataAdd = !dataAdd;
        }
  
  
  </script>
  
    <!-- Muestro o oculta la fecha para mostrar o editar -->
  
      <div class="cont__alta">
        <h1 class="title">Alta de Contacto</h1>
        <form on:submit|preventDefault={() => handleSubmit(propChecked)} id="altaContactos">      
          <div class="features">
            <div>
              {#if $systStatus === "editing"}
                <InputDate identifier="createdAt" name="* Alta en " bind:value={$contact.createdAt} />
              {/if}
            </div>
  
            <div class="inp__lat">  
              <InputText identifier="name" name="* Nombre" bind:value={$contact.name} />            
              <InputText identifier="lastname" name="* Apellido" bind:value={$contact.lastname} />
            </div>
            
            <div class="inp__lat">          
              <InputText identifier="telephon" name="* Teléfono" bind:value={$contact.telephon} />  
              <InputEmail identifier="email" name="* Email" bind:value={$contact.email}/>        
            </div>
  
            <div class="inp__lat">
              <InputOptions identificador="typeContact" name="Tipo de Contacto" choices={typeContacts} bind:value ={$contact.typeContact}/>
              <InputOptions identificador="selecMC" name="Modo de Contacto" choices={modeContact} bind:value ={$contact.selecMC}/>
            </div>
            
            <label class="inp__lat">
              <p class={$contact.comContact ? ' above' : ' center'}>Comentarios</p>
              <textarea 
                class="in__sel notes" 
                name="comContact" 
                bind:value={$contact.comContact} 
                placeholder="* Comentarios"
              ></textarea>
            </label>
            
            {#if !dataAdd }
              <Search bind:searchTerm on:input={searProp(searchTerm)}/>          
            {/if}
            
            {#if dataAdd}
              <div class="inp__lat">
                <InputOptions identificador="selecTP" name="Tipo de Propiedad" choices={typeProperties} bind:value ={$contact.selecTP}/>
                <InputText identifier="budget" name="* Presupuesto" bind:value={$contact.budget} />
              </div>
  
              <div class="inp__unic">
                <InputOptions identificador="modePay" name="Modo de Pago" choices={modePays} bind:value ={$contact.modePay}/>
              </div>
              
              <div class="inp__lat">
                <InputOptions identificador="numBeds" name="# Recámaras" choices={oneToFive} bind:value ={$contact.numBeds}/>
                <InputOptions identificador="numBaths" name="# Baños" choices={oneToFive} bind:value ={$contact.numBaths}/>
              </div>
              
              <div class="inp__lat">
                <InputOptions identificador="halfBathroom" name="# Medios Baños" choices={oneToThree} bind:value ={$contact.halfBathroom}/>
                <InputOptions identificador="numParks" name="# Estacionamientos" choices={oneToFive} bind:value ={$contact.numParks}/>
              </div>
              
              <div class="inp__lat">
                <InputOptions identificador="rangeProp" name="Rango" choices={range} bind:value ={$contact.rangeProp}/>
                <InputOptions identificador="contactStage" name="Etapa" choices={contStage} bind:value ={$contact.contactStage}/>
              </div>
  
              <div class="ubi__Tags">
                  <Ubication 
                      bind:ubication={$contact.locaProperty} 
                      on:change={(e: UbicationEvent) => $contact.locaProperty = e.detail.ubication} 
                  />
                  <Tags 
                      bind:tags={$contact.tagsProperty} 
                      on:change={(e: TagsEvent) => $contact.tagsProperty = e.detail.tags} 
                  />
              </div>
            {/if}
  
            <!-- Botones Guardar Eiditar y Regresar-->
            <div class="inp__lat">
              <button class="btn__save" on:click={detaAlta}>Alta Detalles</button>  
              <button class="bt__SaveEdit" type="submit">{#if $systStatus === "addContact"}Guardar{:else}Guardar Cambios{/if}</button>
              <button class="btn-cancel" on:click={onCancel}>Regresar</button>
            </div>
  
          </div>
        </form>
      </div>
        
    <!-- Renderiza las Tarjetas para Propiedad -->
        {#if showProp} 
          <h2 class="title sub">{propToRender.length} Propiedades encontradas</h2>
            <div class="card__container">
              {#each propToRender as prop}
                <div class="card__prop">
                  <div class="sel__prop">
                    <input  type="checkbox" name={prop.claveEB} value={prop} bind:group={propChecked} >
                  </div>
                  <div >
                    <CardProperty {prop} />
                  </div>
                </div>
              {/each}
              {#if propToRender.length === 0}
                <h3>"No hay Propiedades para este contacto"</h3>
              {/if}
            </div>
        {/if}
  
  <style>
  
  .features {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 800px;
      gap: 8px;
      margin: 0 auto;
      padding: 20px 0;
    }
    .cont__alta{
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
    }
  
    .inp__lat {
      position: relative; 
      display: flex;
      flex-direction: row;
      justify-content: center;
      gap: 8px;
    }
  
    .inp__unic {
      display: flex;
      justify-content: center;
    }
    textarea::placeholder,
    input::placeholder{
      color: navy;
    }
  
    .notes {
      width: 510px;
      max-height: 500px;
    }
  
    .ubi__Tags {
      display: flex;
      flex-direction: row;
    }
  
    .card__container {
      display: flex;
      flex-direction: row;
      width: 100%;
      padding: 10px;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }
  
    .card__prop { 
      display: flex; 
      flex-direction: column;   
      width: 200px;
      height: 250px;     
      font-family: cursive;
      color: grey;
      border: 1px solid grey;
      border-radius: 5px;
      justify-content: baseline;
      padding: 8px;
      gap: 4px;
    }
  
    .sel__prop {
      display: block; 
      padding: 0; 
      margin: 0;  
      width: 0%; 
      border-radius: 0; 
      line-height: 1;
      position: relative;
      top: 30px;
      left: 5px;
    }
  
    @media(max-width:400px){
      .card__container {
        flex-direction: column;
        width: 100%;
      }
  
      .inp__lat{
        flex-direction: column;
      }
      .in__sel {
        width: 100%;
      }
      .ubi__Tags {
        flex-direction: column;
      }
      .card__prop {
        width: 100%;
        height: 100%;
        align-items: center;
        border: none;
      }
      .sel__prop {
        position: relative;
        top: 43px;
        left: 10px;
      }
  
    }
  </style>
  
  