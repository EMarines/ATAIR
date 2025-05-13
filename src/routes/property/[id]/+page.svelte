<script lang="ts">
  import { Button, CardContact } from '$components';
  import { formatDate } from '$lib/functions/dateFunctions';
  import { toComaSep } from '$lib/functions/format';
  import type { Property, Contact, ContactOption, Binnacle } from '$lib/types';
	import { goto } from '$app/navigation';
	// import { filtContPropInte } from '$lib/functions/filProperties';
	import { findContactsForProperty } from '$lib/functions/filContacts'
	import {  contactsStore, binnaclesStore, systStatus } from '$lib/stores/dataStore';
	import { deleteDoc, doc, addDoc, collection } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { diaTarde } from '$lib/functions/dateFunctions';
	import { capitalize } from '$lib/functions/capitalize';
	import { sendWhatsApp } from '$lib/functions/sendWhatsApp';
	// findPropertiesForContact
  export let data;
  let property = data.property as Property;
  let mensaje = '';
  let show__contacts = false;
  let contInterested = 'Por_Enviar';
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
	let enviados = 0;

	$: contacts = $contactsStore as Contact[];
	$: currProperty = property as Property;
	$: binnacles = $binnaclesStore as Binnacle[];

  // Funciones
  const listToRender = () => {
    contCheck = [];
    showBtn = true;
    contInterest = findContactsForProperty(currProperty, contacts);

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

  // Función para manejar cambios en checkboxes individuales
  function handleCheckboxChange() {
    contIntToSend = contCheck.length;
    contFalt = contCheck.length - enviados;
  }

  const selectAll = (e: Event) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    contCheck = isChecked ? [...contToRender] : [];
    handleCheckboxChange();
  };

  // Envía en bucle la propiedad a uno o varios contactos
	function sendProperty() {
		if(mensaje === "") {
			alert("Tienes que escribir un mensaje para enviar las propiedades");
			return;
		}
		if(contCheck.length === 0) {
			alert("Selecciona al menos un contacto");
			return;
		}
		
		contToSend = contCheck[enviados];
		contFalt = contCheck.length - (enviados + 1);
		$systStatus = "sendProps";
		sendWA(contToSend);
		
		enviados++;
		
		if (enviados === contCheck.length) {
			setTimeout(() => {
				$systStatus = "";
				contCheck = [];
				contIntToSend = 0;
				enviados = 0;
				contFalt = 0;
				show__contacts = false;
			}, 2000);
		}
	};

  const sendWA = async (contact: Contact) => {
    if (!contact || !contact.telephon) {
        alert('El contacto debe tener un número de teléfono');
        return;
    }

    let saludoHora = diaTarde();
    let contacto = capitalize(contact.name);
    let msg = property && property.public_url ? 
      `${property.public_url}    ${contacto}. ${saludoHora}.  ${mensaje}` : 
      `${contacto}. ${saludoHora}.  ${mensaje}`;
    let tel = contact.telephon;
    sendWhatsApp(tel, msg);
    
    const newBinnacle: Binnacle = {
        date: Date.now(),
        comment: property && property.public_id ? property.public_id : "Sin ID público",
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
		console.log("$propertyStore, $contactsStore", $systStatus);
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
								} en {property.selecTO === "sale" ? "Venta" : "Renta"}
							</h1>
						</div>
						<div class="prop__price">
							<h2>Precio $ {toComaSep(property.price)}.</h2>
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
            variant="solid" 
            icon="fa-brands fa-whatsapp whatsapp-icon" 
            on:click={() => sendWA(contToSend)}
        >
            Enviar WhatsApp
        </Button>
        <Button 
            element="button" 
            variant="solid" 
            icon="fa-solid fa-solid fa-users-viewfinder" 
            on:click={findCustomers}
        >
            Buscar Contactos
        </Button>
        <Button 
            element="button" 
            variant="solid" 
            icon="fa-solid fa-arrow-left" 
            on:click={actCancel}
        >
            Regresar
        </Button>
        <Button 
            element="button" 
            variant="solid" 
            icon="fa-solid fa-arrow-up-right-from-square" 
            on:click={followLink}
        >
            Ir al link
        </Button>
			
				<!-- {:else}  -->
					<Button 
						element="button" 
						variant="solid" 
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
						<button id="Evio_prop_selec" class="send__Prop" on:click={sendProperty}>
							{#if enviados === 0}
								Enviar a {contCheck.length} contactos
							{:else}
								Enviados: {enviados}, Faltan: {contCheck.length - enviados}
							{/if}
						</button>
						<label>
							<input 
								type="checkbox" 
								on:change={selectAll}
								checked={contCheck.length === contToRender.length}
							> 
							Seleccionar todos
						</label>
					{/if}
				</div>

				<div class="cards__container">
					{#each contToRender as cont}
						<div class="select__conts">					
							<input type="checkbox" 
							value={cont}
							name={cont.id}
							class="form__contCheck"
							bind:group={contCheck}
							on:change={handleCheckboxChange}
							/>
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

	.select__conts {
		position: relative;
	}

	.form__contCheck {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 20;
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
		background: rgb(56, 56, 56);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: white;
		padding: 0.75rem;
		resize: vertical;
		transition: border-color 0.2s;
	}

	.sel__msg textarea {
		outline: none;
		border-color: rgba(255, 255, 255, 0.3);
		box-shadow: 0 0 5px rgba(255, 255, 255, 0.1);
	}

	.sel__msg textarea::placeholder {
		color: rgba(255, 255, 255, 0.5);
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
		width: 100%;
		max-width: 1200px;
		padding: 10px;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 15px;
	}

	.btn__send {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		padding: 1rem;
	}

	.send__Prop {
		background: rgb(56, 56, 56);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.75rem 1.5rem;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.send__Prop:hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
		background: rgb(76, 76, 76);
	}

	.btn__send label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.btn__send input[type="checkbox"] {
		cursor: pointer;
	}

	/* .card__container {  */
      /* display: flex;  */
      /* flex-direction: column;  */
      /* width: 350px; */
      /* justify-content: center;
      align-items: center;   */
      /* border: 1px solid grey; */
      /* border-radius: 5px; */
    /* } */

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
