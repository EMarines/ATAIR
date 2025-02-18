<script lang="ts">
  import { Button, CardContact } from '$components';
  import { formatDate } from '$lib/functions/dateFunctions';
  import { toComaSep } from '$lib/functions/format';
  import type { Property, Contact, ContactOption, Binnacle } from '$lib/types';
	import { goto } from '$app/navigation';
	import { filtContPropInte } from '$lib/functions/filProperties';
	import { filtPropContInte } from '$lib/functions/filContacts.js'
	import {  contactsStore, binnaclesStore, systStatus } from '$lib/stores/dataStore';
	import { deleteDoc, doc, addDoc, collection } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { diaTarde } from '$lib/functions/dateFunctions';
	import { capitalize } from '$lib/functions/capitalize';
	import { sendWhatsApp } from '$lib/functions/sendWhatsApp';
   
  export let data;
  let property = data.property as Property;
  let mensaje = '';
  let show__contacts = false;
  let contInterested = '';
	let contInterest: Contact[] = [];
  let contToRender: Contact[] = [];
	let contInitial = [];
	let msgToShow = '';
	let poroShowTo: ContactOption[] = ["Posobles_Interesados", "Por_Enviar", "Ya_Se_Envió"];
	let showBtn = false;
	let contIntToSend = 0;
	let contFalt = 0;
	let contCheck: Contact[] = [];
	let contToSend: Contact;

	$: contacts = $contactsStore as Contact[];
	$: currProperty = property as Property;
	$: binnacles = $binnaclesStore as Binnacle[];

  // Funciones
  const listToRender = () => {
    contCheck = [];
    showBtn = true;
    contInterest = filtPropContInte(currProperty, contacts);
    if(contInterested === "Posobles_Interesados"){
      msgToShow = "Contactos Les Puede Interesar Esta Propiedad"
      contToRender = contInterest
    } else if(contInterested === "Por_Enviar"){
      let toSend: Contact[] = [];
      msgToShow = "Pendiente Para Enviar Esta Propieadad"
      let res =  binnacles.filter(item =>
      item.comment === property.public_id)
      const contsT = res.map(doc => doc.to)
      toSend = contInterest.filter(doc => !contsT.includes(doc.id))               
      contToRender = toSend
    } else if(contInterested === "Ya_Se_Envió"){
      let sent: Contact[] = [];
      msgToShow = "Ya se les envió esta propiedad"
      let res = binnacles.filter(item =>
      item.comment === property.public_id)
      contInterest.filter((cont) =>{
        res.forEach(binn => {
          if(cont.id === binn.to){
            sent.push(cont)
            }
          })
          contToRender = sent
    })
    } 
  };

  const selectAll = (e: Event) => {
    contCheck = (e.target as HTMLInputElement).checked ? [...contToRender] : [];
  };

  // Envía en bucle la propiedad a uno o varios contactos
	function sendProperty() {
		let sig = 0;
			if(mensaje === ""){
				alert("Tienes que escribir un mensaje para enviar las propiedades")
				return
			}
			contToSend = contCheck[sig]
			contFalt = contCheck.length - (sig + 1)
			$systStatus = "sendProps"
			sendWA(contToSend)
			if ( contIntToSend === sig + 1 ) {
				setTimeout ( function(){
					$systStatus = "";
					contCheck = [];
					contIntToSend = 0;
					show__contacts = false;
					sig = 0;
					contFalt = 0;
					return
				}, 2000);
			};
				sig ++
		};

  const sendWA = async (contact: Contact) => {
    if (!contact || !contact.telephon) {
        alert('El contacto debe tener un número de teléfono');
        return;
    }

    let saludoHora = diaTarde();
    let contacto = capitalize(contact.name);
    let msg = `${property.public_url}    ${contacto}. ${saludoHora}.  ${mensaje}`;
    let tel = contact.telephon;
    sendWhatsApp(tel, msg);
    
    const newBinnacle: Binnacle = {
        date: Date.now(),
        comment: property.public_id,
        to: contact.id,
        action: "Propiedad enviada:"
    };

    try {
        const binnacleToAdd = collection(db, "binnacles");
        await addDoc(binnacleToAdd, newBinnacle);					
    } catch (error) {
        console.log(error);
    }

    if($systStatus === "sendPropToContacts"){
        contToSend = {} as Contact;
        listToRender();
    }
  };

  const findCustomers = () => {
    listToRender()
		show__contacts = !show__contacts
		$systStatus = "sendPropToContacts"
  };

  const actCancel = () => {
    property = {} as Property;
    goto('/propiedades');
  };

  const cancel = () => {
		$systStatus = "";
		goto('/propiedades');
  };

  const editProp = (id: string) => {
    $systStatus = 'editing';
		goto('/propiedades/altaPropiedad');
  };

  const deleProperty = async (id: string) => {
    if (confirm('Deseas eleiminar definitivamente la propiedad?')) {
				await deleteDoc(doc(db, 'properties', property.public_id));
				goto('/propiedades');
			} else {
				return;
			}
  };

  const tagToUbicacion = (tags: string[]) => {
    // Implementar esta función
  };

  const tagToFeatures = (tags: string[]) => {
    // Implementar esta función
  };

  // const toComaSep = (num: number) => {
  //   return new Intl.NumberFormat('es-MX').format(num)
  // };


  const followLink = () => {
    // Implementa la lógica que necesites aquí
    console.log('Siguiendo enlace...')
  }
</script>

	<!-- Title -->
  <div class="container">

		<div class="mainContainer">
			<h2>Propiedad Seleccionada</h2>

	<!-- Muestra la propieda seleccionada -->
			<div class="prop__ima__info">
				<div class="prop__image">
					<p class="prop__clave">{property.public_id}</p>
					<img 
						src={property.title_image_thumb} 
						alt={typeof property.location === 'string' ? property.location : property.location.name} 
					/>
				</div>

				<div class="prop__card">
					<div class="prop__info">
						<div class="propTitle">
							<h1 class="title">
								{property.property_type} en {typeof property.location === 'string' ? 
									property.location.replace("Chihuahua, Chihuahua", "").replace("I,", "") : 
									property.location.name.replace("Chihuahua, Chihuahua", "").replace("I,", "")
								} en {property.operations[0].type === "sale" ? "Venta" : "Renta"}
							</h1>
						</div>
						<div class="prop__price">
							<h2>Precio $ {toComaSep(property.operations[0].amount)}.</h2>
							<p class="alta__prop">Alta: {formatDate(Number(property.created_at))}</p>
						</div>
						<div class="prop__cont">
							<div class="prop__features">
								{#if property.property_type === 'Casa' || property.property_type === 'Departamento'}
									<span> {Number(property.bedrooms)}  <i class="fa-solid fa-bed to__show"></i></span>
									<span> {Number(property.bathrooms)} <i class="fa-solid fa-bath to__show"></i></span>
									{#if property.half_bathrooms}
										<span> {Number(property.half_bathrooms)} <i class="fa-solid fa-toilet to__show"></i></span>										
									{/if}
									{#if property.parking_spaces}
										<span> {Number(property.parking_spaces)} <i class="fa-solid fa-car-rear to__show"></i></span>										
									{/if}
									<!-- <span> {Number($property.halfBathroom)} <i class="fa-solid fa-bath to__show"></i></span> -->

									<span>{Number(property.construction_size)} m² <i class="fa-solid fa-ruler-combined"></i></span>
									<span>{property.lot_size} m² <i class="fa-solid fa-chart-area"></i></span>
								{:else if property.property_type === 'Terreno'}
									<span>{property.lot_size} m² <i class="fa-solid fa-chart-area"></i></span>
								{/if}
							</div>
							<div class="prop__features">
								{#if property.tags?.length > 0}
										<span> <i class="fa-sharp fa-regular fa-compass to__showR"></i> {tagToUbicacion(property?.tags)} </span>              
										<span><i class="fa-solid fa-tags to__showR"></i> {tagToFeatures(property.tags)} </span>              
								{/if}
							</div>
						</div>
					</div>
					<div class="actions">
						<i 
							class="fa-regular fa-pen-to-square" 
							on:click={() => editProp(property.public_id)} 
							on:keydown={() => {}} 
							role="button" 
							tabindex="0"
							aria-label="Editar propiedad"
						></i>
						
						<i 
							class="fa-regular fa-trash-can" 
							on:click={() => deleProperty(property.public_id)} 
							on:keydown={() => {}} 
							role="button" 
							tabindex="0"
							aria-label="Eliminar propiedad"
						></i>
					</div>
				</div>
			</div>
	<!-- Botones -->
			<div class="btn__options">
				<!-- {#if $systStatus !== "sendPropToContacts"}  -->
        <Button 
            element="button" 
            variant="outline" 
            icon="fa-brands fa-whatsapp whatsapp-icon" 
            on:click={() => sendWA(contToSend)}
        >
            Enviar WhatsApp
        </Button>
        <Button 
            element="button" 
            variant="outline" 
            icon="fa-solid fa-solid fa-users-viewfinder" 
            on:click={findCustomers}
        >
            Buscar Contactos
        </Button>
        <Button 
            element="button" 
            variant="outline" 
            icon="fa-solid fa-arrow-left" 
            on:click={actCancel}
        >
            Regresar
        </Button>
        <Button 
            element="button" 
            variant="outline" 
            icon="fa-solid fa-arrow-up-right-from-square" 
            on:click={followLink}
        >
            Ir al link
        </Button>
			
				<!-- {:else}  -->
					<Button 
						element="button" 
						variant="outline" 
						icon="fa-solid fa-xmark" 
						on:click={cancel}
					>
						Cancelar
					</Button>
				<!-- {/if} -->
			</div>

	<!-- Muestra opciones para buscar contactos interesados -->
			{#if show__contacts}
				<div class="mainContainer">
					<div class="sel__msg">
							<textarea 
								bind:value={mensaje} 
								placeholder="Escribe el mensaje a enviar"
							></textarea>
					</div>
					
					<div class="sect__Title">					
						{#if contToRender.length === 0}
							<h1>No hay contactos para enviar</h1>
						{:else }
							<h1>A {contInitial.length} {msgToShow}</h1>
						{/if}					

						<div class="opti__cont">
							{#each poroShowTo as list}
									<label>
										<input type="radio" bind:group={contInterested} value={list} on:change={listToRender}>
										{list.replaceAll("_", "  ")}
									</label>
							{/each}
						</div>
					</div>
				</div>
				
	<!-- Muestra los contactos a los que le puede interesar la propiedad -->
				<div class="btn__send">
					{#if showBtn}
						<button id="Evio_prop_selec" class="send__Prop" on:click={sendProperty}>{`Total para enviar ${contIntToSend}. faltan ${contFalt}`}</button>
						<label>
							<input type="checkbox" on:change={selectAll}> Seleccionar todos
						</label>
						{/if}
				</div>
				<div class="cards__container">
					{#each contToRender as cont}
					<div class="card__container">
						<input type="checkbox" 
							value={cont.id} 
							name={cont.id}  
							bind:group={contCheck} 
						>
						<CardContact {cont}/>         
					</div>
					{/each}        
				</div>  
			{/if}

		</div>

		</div>

<style>
	.mainContainer {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 25px;
	}

  .prop__ima__info {
		display: flex;
		flex-direction: row;
    width: 100%;
		align-items: center;
		justify-content: center;
    padding: 10px;
		gap: 15px;
	}

  .prop__image {
		position: relative;
		display: flex;
    width: 50%;
  }

	.prop__clave {
		position: absolute;
		top: 13px;
		left: 15px;
		background: black;
		opacity: 50%;
		padding: 0 10px;
	}

  .prop__card {
		display: flex;
		flex-direction: column;
		justify-content: center;
		border: 1px solid white;
		width: 50%;
		height: auto;
		gap: 20px;
		padding: 15px;
		border-radius: 8px;
	}

	img {
		width: 98%;
		height: auto;
		border-radius: 8px;
		object-fit: cover;
	}

	h1,
	h2 {
		margin: 0 auto;
		font-weight: 300;
	}

	.title{
		display: flex;
		width: 100%;
		justify-content: center;
		text-transform: capitalize;
		font-size: .5rem;
	}

	.prop__info {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 85%;
	}

	.prop__card h1 {
		font-size: 1.5rem;
		font-weight: 100;
	}

	.prop__price {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 15px;
	}
	.prop__cont {
		display: flex;
		flex-direction: column;
		gap: 10px;
		justify-content: space-evenly;
	}

	.prop__features {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
	}

	.actions {
		display: flex;
		width: 100%;
		height: 10%;
		justify-content: space-around;
		font-size: 1.5rem;
	}

	.btn__options {
		display: flex;
		width: 100%;
		justify-content: space-evenly;
		flex-wrap: wrap;
	}

	.sel__msg {
		display: flex;
		flex-direction: row;
		width: 100%;
		justify-content: center;
		align-items: center;
		gap: 10px;
	}

	.sel__msg textarea {
		width: 650px;
		height: 50px;
		font-size: 1rem;
		background: transparent;
			}

	.sect__Title {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.opti__cont{
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 30px;
	}

	.cards__container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		flex-wrap: wrap;
		padding-bottom: 20px;
		gap: 8px;
	}

	.btn__send {
		display: flex;
		justify-content: space-evenly;	
		padding: 10px;
		/* background: yellowgreen;	 */
	}

	.send__Prop {
		background: green;
		padding: 5px 15px;
		border-radius: 5px;
	}

	.card__container { 
      display: flex; 
      flex-direction: column; 
      width: 350px;
      /* height: auto;    */
      justify-content: center;
      align-items: center;  
      /* color: grey; */
      border: 1px solid grey;
      border-radius: 5px;
      padding: 8px;
    }

	@media (max-width: 800px) {
		.prop__ima__info {
			flex-direction: column;
			/* width: auto; */
		}
		.prop__image {
			/* display: flex; */
			/* width: 100%; */
			align-items: center;
			justify-content: center;
		}
		.prop__clave {
			top: 350px;
			left: 230px;
		}
		img {
			width: 100%;
		}
		.prop__card {
			width: 98%;
			height: auto;
			padding: 10px;
		}
	}

	@media (max-width: 400px) {
		.prop__image {
			width:100%;
		}
		img {
			width: 95%;
		}
    .prop__card {
      font-size: .8rem;
    }
    .prop__clave {
			top: 15px;
			left: 15px;
    }
		.sel__msg textarea {	
			width: 100%;
		}
  
	}



</style>
