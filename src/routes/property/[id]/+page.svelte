<script lang="ts">
	import { Button, CardContact } from '$components';
	import { formatDate } from '$lib/functions/dateFunctions';
	import { toComaSep } from '$lib/functions/format';
	import type { Property, Contact, ContactOption, Binnacle } from '$lib/types';
	import { goto } from '$app/navigation';
	// import { filtContPropInte } from '$lib/functions/filProperties';
	import { findContactsForProperty } from '$lib/functions/filContacts';
	import { contactsStore, binnaclesStore, systStatus } from '$lib/stores/dataStore';
	import { deleteDoc, doc, addDoc, collection } from 'firebase/firestore';
	import { db } from '$lib/firebase_toggle';
	import { diaTarde } from '$lib/functions/dateFunctions';
	import { capitalize } from '$lib/functions/capitalize';
	import { sendWhatsApp } from '$lib/functions/whatsapp';
	import { getProposalUrl } from '$lib/functions/urlUtils';
	import { empresa } from '$lib/config/empresa';
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
	let poroShowTo: string[] = ['Posobles_Interesados', 'Por_Enviar', 'Ya_Se_Envió'];
	let showBtn = false;
	let contIntToSend = 0;
	let contFalt = 0;
	let contCheck: Contact[] = [];
	let contToSend: Contact;
	let enviados = 0;
	let autoMode = false; // Switch para modo automático vs manual
	let isProcessing = false; // Estado para controlar si está procesando

	// Popup para enviar WhatsApp manual / sin contacto previo
	let showPhonePopup = false;
	let customPhone = '';
	let customName = '';
	let copySuccess = false;

	$: contacts = $contactsStore as Contact[];
	$: currProperty = property as Property;
	$: binnacles = $binnaclesStore as Binnacle[];

	// Función segura para obtener nombre de ubicación
	function getLocationString(loc: string | { name: string } | undefined | null): string {
		if (!loc) return '';
		const str = typeof loc === 'string' ? loc : loc?.name || '';
		return str.replace('Chihuahua, Chihuahua', '').replace('I,', '').trim();
	}

	// Funciones
	const listToRender = () => {
		contCheck = [];
		showBtn = true;
		contInterest = findContactsForProperty(currProperty, contacts);

		if (contInterested === 'Posobles_Interesados') {
			msgToShow = 'Contactos Les Puede Interesar Esta Propiedad';
			contToRender = contInterest;
		} else if (contInterested === 'Por_Enviar') {
			let toSend: Contact[] = [];
			msgToShow = 'Pendiente Para Enviar Esta Propieadad';
			let res = binnacles.filter((item) => item.comment === property.public_id);
			const contsT = res.map((doc) => doc.to);
			toSend = contInterest.filter((doc) => !contsT.includes(doc.id));
			contToRender = toSend;
		} else if (contInterested === 'Ya_Se_Envió') {
			let sent: Contact[] = [];
			msgToShow = 'Ya se les envió esta propiedad';
			let res = binnacles.filter((item) => item.comment === property.public_id);
			contInterest.filter((cont) => {
				res.forEach((binn) => {
					if (cont.id === binn.to) {
						sent.push(cont);
					}
				});
				contToRender = sent;
			});
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

	// Función principal que decide el método de envío según el switch
	async function sendProperty() {
		if (mensaje === '') {
			alert('Tienes que escribir un mensaje para enviar las propiedades');
			return;
		}
		if (contCheck.length === 0) {
			alert('Selecciona al menos un contacto');
			return;
		}

		// Prevenir múltiples ejecuciones
		if (isProcessing) {
			console.log('⚠️ Ya hay un proceso en ejecución');
			return;
		}

		isProcessing = true;
		console.log(
			`🚀 Iniciando ${autoMode ? 'automático' : 'manual'} - Contactos seleccionados: ${contCheck.length}`
		);

		try {
			if (autoMode) {
				// Modo automático: enviar a n8n
				await sendToN8n();
			} else {
				// Modo manual: envío uno por uno con WhatsApp (click por click)
				await sendManually();
			}
		} catch (error) {
			console.error('❌ Error en sendProperty:', error);
			alert(`❌ Error: ${error.message}`);
		} finally {
			isProcessing = false;
		}
	} // Envía los datos a n8n para procesamiento automático
	async function sendToN8n() {
		// Cambiar estado para mostrar que está procesando
		$systStatus = 'sendingToN8N';

		try {
			// Preparar el paquete de datos para n8n
			const dataPackage = {
				property: {
					id: property.public_id,
					title: `${property.property_type || 'Propiedad'} en ${getLocationString(property.location)} en ${property.selecTO === 'sale' ? 'Venta' : 'Renta'}`,
					price: property.price,
					url: property.public_url || '',
					image: property.title_image_thumb || '',
					bedrooms: property.bedrooms || 0,
					bathrooms: property.bathrooms || 0,
					construction_size: property.construction_size || 0,
					lot_size: property.lot_size || 0
				},
				message: mensaje,
				contacts: contCheck.map((contact) => ({
					id: contact.id,
					name: contact.name,
					phone: contact.telephon,
					email: contact.email || ''
				})),
				metadata: {
					timestamp: Date.now(),
					totalContacts: contCheck.length,
					requestedBy: 'ATAIR_APP'
				}
			};

			// URL del webhook de n8n (reemplazar con la URL real)
			const webhookUrl = 'http://localhost:5678/webhook-test/86de1afe-3936-4150-a7f8-b296c5836f3c';

			console.log('📤 Enviando datos a n8n:', dataPackage);

			// Enviar datos a n8n
			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataPackage)
			});
			console.log(response);

			if (response.ok) {
				const result = await response.json();
				console.log('✅ Datos enviados exitosamente a n8n:', result);

				alert(
					`✅ Proceso automático iniciado!\n\nn8n se encargará de enviar la propiedad a ${contCheck.length} contactos.\nLos envíos se procesarán automáticamente en segundo plano.`
				);

				// Resetear estado después del éxito
				setTimeout(() => {
					$systStatus = '';
					contCheck = [];
					contIntToSend = 0;
					enviados = 0;
					contFalt = 0;
					show__contacts = false;
				}, 1000);
			} else {
				throw new Error(`Error en la respuesta: ${response.status} - ${response.statusText}`);
			}
		} catch (error) {
			console.error('❌ Error enviando a n8n:', error);
			alert(
				`❌ Error al enviar a n8n: ${error.message}\n\nVerifica la conexión y la URL del webhook.`
			);
			$systStatus = '';
		}
	}

	// Envío manual: envía al siguiente contacto en la lista cada vez que se hace click
	async function sendManually() {
		console.log(`🔍 Estado actual: enviados=${enviados}, total=${contCheck.length}`);

		// Verificar si hay contactos pendientes
		if (enviados >= contCheck.length) {
			console.log('🔄 Reiniciando proceso - todos los contactos fueron enviados');
			// Resetear para permitir nuevo envío
			enviados = 0;
			alert(
				`✅ Proceso completado!\n\nSe procesaron ${contCheck.length} contactos.\n\nPuedes seleccionar nuevos contactos o modificar la selección.`
			);
			return;
		}

		console.log(`📤 Preparando envío a contacto ${enviados + 1}/${contCheck.length}`);

		// Obtener el siguiente contacto a enviar
		const contact = contCheck[enviados];
		if (!contact) {
			console.error('❌ No se encontró el contacto en el índice:', enviados);
			return;
		}

		contToSend = contact;
		console.log(`👤 Siguiente contacto: ${contact.name}`);

		try {
			// Enviar WhatsApp y guardar en bitácora
			await sendWA(contact);

			// Actualizar contadores DESPUÉS del envío exitoso
			enviados++;
			contFalt = contCheck.length - enviados;
			contIntToSend = contCheck.length;

			console.log(`✅ Contacto ${enviados}/${contCheck.length} procesado: ${contact.name}`);
			console.log(`📊 Quedan ${contFalt} contactos por enviar`);

			// NO resetear el estado aquí, solo mostrar mensaje si es el último
			if (enviados >= contCheck.length) {
				console.log('🎉 Último contacto enviado');
			}
		} catch (error) {
			console.error('❌ Error en envío:', error);
			alert(`❌ Error al enviar a ${contact.name}: ${error.message}`);
		}
	}

	const sendWA = async (contact: Contact) => {
		// Validaciones más robustas
		if (!contact || !contact.telephon) {
			alert('El contacto debe tener un número de teléfono');
			return;
		}

		if (!contact.id) {
			alert('Error: El contacto no tiene un ID válido');
			console.error('Contacto sin ID:', contact);
			return;
		}

		if (!property || !property.public_id) {
			alert('Error: La propiedad no tiene un ID válido');
			console.error('Propiedad sin public_id:', property);
			return;
		}

		console.log('📤 Enviando propiedad:', {
			contactName: contact.name,
			contactId: contact.id,
			propertyId: property.public_id,
			telephon: contact.telephon
		});

		let saludoHora = diaTarde();
		let contacto = contact.name ? capitalize(contact.name) : '';
		let propUrl = property?.public_id
			? getProposalUrl(property.public_id, contact.id || contact.name)
			: (property?.public_url || '');
		let saludo = contacto ? `¡${saludoHora}, ${contacto}!` : `¡${saludoHora}!`;
		let infoContacto = `${empresa.agentName}, asesor de ventas en ${empresa.companyName}, tel. ${empresa.phoneNumber}, email ${empresa.email}. Visita ${empresa.companyUrl} ¡Seguro encuentras algo de interés!`;
		let msg = propUrl
			? `${propUrl}\n\n${saludo} Te comparto la información de esta propiedad.\n\n${infoContacto}`
			: `${saludo} Te comparto la información.\n\n${infoContacto}`;
		let tel = contact.telephon;

		try {
			// Enviar WhatsApp primero
			sendWhatsApp(tel, msg);

			// Crear objeto de bitácora con validaciones
			const newBinnacle: Binnacle = {
				date: Date.now(),
				comment: property.public_id.trim(), // Asegurar que no tenga espacios extra
				to: contact.id.trim(), // Asegurar que el ID esté limpio
				action: 'Propiedad enviada: ' // ✅ Espacio al final consistente con otros archivos
			};

			// Guardar en bitácora
			const binnacleToAdd = collection(db, 'binnacles');
			await addDoc(binnacleToAdd, newBinnacle);

			console.log(`✅ Bitácora guardada exitosamente: ${contact.name} - ${property.public_id}`);
		} catch (error) {
			console.error('❌ Error al guardar en bitácora:', error);
			// Mostrar error al usuario pero no interrumpir el flujo
			alert(
				`Advertencia: El mensaje se envió pero hubo un error al guardar el registro. Error: ${error}`
			);
		}

		// COMENTADO: Esta línea estaba causando que se reseteara el estado
		// if($systStatus === "sendPropToContacts"){
		//     contToSend = {} as Contact;
		//     listToRender();
		// }
	};

	function handleWhatsAppClick() {
		if (contToSend && contToSend.telephon) {
			sendWA(contToSend);
		} else {
			showPhonePopup = true;
		}
	}

	async function sendCustomWhatsApp() {
		const clean = customPhone.replace(/\D/g, '');
		if (!clean || clean.length < 10) {
			alert('Por favor ingresa un número de teléfono válido (10 dígitos).');
			return;
		}

		let saludoHora = diaTarde();
		let contacto = customName.trim() ? capitalize(customName.trim()) : '';
		let propUrl = property?.public_id
			? getProposalUrl(property.public_id, contacto || '')
			: (property?.public_url || '');
		let saludo = contacto ? `¡${saludoHora}, ${contacto}!` : `¡${saludoHora}!`;
		let infoContacto = `${empresa.agentName}, asesor de ventas en ${empresa.companyName}, tel. ${empresa.phoneNumber}, email ${empresa.email}. Visita ${empresa.companyUrl} ¡Seguro encuentras algo de interés!`;
		let msg = propUrl
			? `${propUrl}\n\n${saludo} Te comparto la información de esta propiedad.\n\n${infoContacto}`
			: `${saludo} Te comparto la información.\n\n${infoContacto}`;

		// Abrir WhatsApp con el número limpio
		sendWhatsApp(clean, msg);

		// Registrar en bitácora si es posible
		try {
			const newBinnacle: Binnacle = {
				date: Date.now(),
				comment: (property.public_id || '').trim(),
				to: `Tel: ${clean}${contacto ? ` (${contacto})` : ''}`,
				action: 'Propiedad enviada por WhatsApp: '
			};
			await addDoc(collection(db, 'binnacles'), newBinnacle);
			console.log(`✅ Bitácora guardada para envío manual a ${clean}`);
		} catch (err) {
			console.warn('No se pudo registrar en bitácora:', err);
		}

		showPhonePopup = false;
		customPhone = '';
		customName = '';
	}

	function copyCustomLink() {
		const contacto = customName.trim() ? capitalize(customName.trim()) : '';
		const propUrl = property?.public_id
			? getProposalUrl(property.public_id, contacto || '')
			: (property?.public_url || '');

		if (propUrl) {
			navigator.clipboard.writeText(propUrl);
			copySuccess = true;
			setTimeout(() => {
				copySuccess = false;
			}, 2500);
		}
	}

	function closePhonePopup() {
		showPhonePopup = false;
		copySuccess = false;
	}

	const findCustomers = () => {
		listToRender();
		show__contacts = !show__contacts;
		$systStatus = 'sendPropToContacts';
		// console.log("$propertyStore, $contactsStore", $systStatus);
	};

	const actCancel = () => {
		property = {} as Property;
		goto('/properties');
	};

	const cancel = () => {
		$systStatus = '';
		goto('/properties');
	};

	const editProp = (id: string) => {
		$systStatus = 'editing';
		goto('/properties');
	};

	const deleProperty = async (id: string) => {
		if (confirm('Deseas eliminar definitivamente la propiedad?')) {
			const targetId = property.docId || property.id || property.public_id;
			if (targetId) {
				await deleteDoc(doc(db, 'properties', targetId));
			}
			goto('/properties');
		} else {
			return;
		}
	};

	const tagToUbicacion = (tags: string[]) => {
		return tags?.join(', ') || '';
	};

	const tagToFeatures = (tags: string[]) => {
		return '';
	};

	// const toComaSep = (num: number) => {
	//   return new Intl.NumberFormat('es-MX').format(num)
	// };

	const followLink = () => {
		if (property?.public_url) {
			window.open(property.public_url, '_blank');
		} else if (property?.public_id) {
			window.open(getProposalUrl(property.public_id), '_blank');
		}
	};
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
					src={property.title_image_thumb || '/placeholder-property.png'}
					alt={getLocationString(property.location) || property.title || 'Propiedad'}
				/>
			</div>

			<div class="prop__card">
				<div class="prop__info">
					<div class="propTitle">
						<h1 class="title">
							{property.property_type || 'Propiedad'} en {getLocationString(property.location) || 'Sin ubicación'} en {property.selecTO ===
							'sale'
								? 'Venta'
								: 'Renta'}
						</h1>
					</div>
					<div class="prop__price">
						<h2>Precio $ {toComaSep(property.price)}.</h2>
						<p class="alta__prop">Alta: {formatDate(Number(property.created_at))}</p>
					</div>
					<div class="prop__cont">
						<div class="prop__features">
							{#if property.property_type === 'Casa' || property.property_type === 'Departamento'}
								<span> {Number(property.bedrooms)} <i class="fa-solid fa-bed to__show"></i></span>
								<span> {Number(property.bathrooms)} <i class="fa-solid fa-bath to__show"></i></span>
								{#if property.half_bathrooms}
									<span>
										{Number(property.half_bathrooms)}
										<i class="fa-solid fa-toilet to__show"></i></span
									>
								{/if}
								{#if property.parking_spaces}
									<span>
										{Number(property.parking_spaces)}
										<i class="fa-solid fa-car-rear to__show"></i></span
									>
								{/if}
								<!-- <span> {Number($property.halfBathroom)} <i class="fa-solid fa-bath to__show"></i></span> -->

								<span
									>{Number(property.construction_size)} m²
									<i class="fa-solid fa-ruler-combined"></i></span
								>
								<span>{property.lot_size} m² <i class="fa-solid fa-chart-area"></i></span>
							{:else if property.property_type === 'Terreno'}
								<span>{property.lot_size} m² <i class="fa-solid fa-chart-area"></i></span>
							{/if}
						</div>
						<div class="prop__features">
							{#if property.tags?.length > 0}
								<span>
									<i class="fa-sharp fa-regular fa-compass to__showR"></i>
									{tagToUbicacion(property?.tags)}
								</span>
								<span
									><i class="fa-solid fa-tags to__showR"></i> {tagToFeatures(property.tags)}
								</span>
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
				on:click={handleWhatsAppClick}
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
			<Button element="button" variant="solid" icon="fa-solid fa-arrow-left" on:click={actCancel}>
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
			<Button element="button" variant="solid" icon="fa-solid fa-xmark" on:click={cancel}>
				Cancelar
			</Button>
			<!-- {/if} -->
		</div>

		<!-- Muestra opciones para buscar contactos interesados -->
		{#if show__contacts}
			<div class="mainContainer">
				<div class="sel__msg">
					<textarea bind:value={mensaje} placeholder="Escribe el mensaje a enviar"></textarea>
				</div>

				<!-- Switch para modo automático/manual -->
				<div class="mode-selector">
					<div class="switch-container">
						<span class="mode-label" class:active={!autoMode}>📱 Manual</span>
						<label class="switch">
							<input type="checkbox" bind:checked={autoMode} />
							<span class="slider"></span>
						</label>
						<span class="mode-label" class:active={autoMode}>🤖 Automático</span>
					</div>
					<div class="mode-description">
						{#if autoMode}
							<p>🚀 Modo automático: Los mensajes se enviarán a través de n8n en segundo plano</p>
						{:else}
							<p>📱 Modo manual: Envío uno por uno, abrir WhatsApp manualmente</p>
						{/if}
					</div>
				</div>

				<div class="sect__Title">
					{#if contToRender.length === 0}
						<h1>No hay contactos para enviar</h1>
					{:else}
						<h1>A {contToRender.length} {msgToShow}</h1>
					{/if}

					<div class="opti__cont">
						{#each poroShowTo as list}
							<label>
								<input
									type="radio"
									bind:group={contInterested}
									value={list}
									on:change={listToRender}
								/>
								{list.replaceAll('_', '  ')}
							</label>
						{/each}
					</div>
				</div>
			</div>

			<!-- Muestra los contactos a los que le puede interesar la propiedad -->
			<div class="btn__send">
				{#if showBtn}
					<button
						id="Evio_prop_selec"
						class="send__Prop"
						class:auto-mode={autoMode}
						on:click={sendProperty}
						disabled={isProcessing || $systStatus === 'sendingToN8N'}
					>
						{#if $systStatus === 'sendingToN8N'}
							🚀 Enviando a n8n...
						{:else if autoMode}
							🤖 Enviar automático ({contCheck.length} contactos)
						{:else if contCheck.length > 0 && enviados < contCheck.length}
							📱 Enviar a {contCheck[enviados]?.name || 'siguiente'} ({enviados +
								1}/{contCheck.length})
						{:else if enviados >= contCheck.length && contCheck.length > 0}
							✅ Todos enviados - Reiniciar
						{:else}
							📱 Enviar manual ({contCheck.length} contactos)
						{/if}
					</button>

					{#if enviados >= contCheck.length && contCheck.length > 0}
						<button
							class="reset__btn"
							on:click={() => {
								enviados = 0;
								contCheck = [];
								contIntToSend = 0;
								contFalt = 0;
							}}
						>
							🔄 Nueva selección
						</button>
					{/if}

					<label>
						<input
							type="checkbox"
							on:change={selectAll}
							checked={contToRender.length > 0 && contCheck.length === contToRender.length}
							disabled={isProcessing || $systStatus === 'sendingToN8N'}
						/>
						Seleccionar todos
					</label>
				{/if}
			</div>

			<div class="cards__container">
				{#each contToRender as cont, index}
					<div
						class="select__conts"
						class:sent={enviados > 0 &&
							contCheck.findIndex((c) => c.id === cont.id) < enviados &&
							contCheck.some((c) => c.id === cont.id)}
					>
						<input
							type="checkbox"
							value={cont}
							name={cont.id}
							class="form__contCheck"
							bind:group={contCheck}
							on:change={handleCheckboxChange}
							disabled={isProcessing || $systStatus === 'sendingToN8N'}
						/>
						{#if enviados > 0 && contCheck.findIndex((c) => c.id === cont.id) < enviados && contCheck.some((c) => c.id === cont.id)}
							<div class="sent-indicator">✅ Enviado</div>
						{/if}
						<CardContact {cont} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showPhonePopup}
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div 
		class="popup-backdrop" 
		on:click={closePhonePopup} 
		on:keydown={(e) => e.key === 'Escape' && closePhonePopup()}
		role="dialog" 
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div 
			class="popup-card" 
			on:click|stopPropagation={() => {}} 
			on:keydown|stopPropagation={() => {}} 
			role="document"
		>
			<div class="popup-header">
				<div class="popup-title-group">
					<i class="fa-brands fa-whatsapp popup-wa-icon"></i>
					<h3>Enviar por WhatsApp</h3>
				</div>
				<button class="popup-close-btn" on:click={closePhonePopup} aria-label="Cerrar">
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="popup-prop-badge">
				<span class="popup-prop-id">{property.public_id}</span>
				<span class="popup-prop-name">
					{property.property_type || 'Propiedad'} en {getLocationString(property.location) || 'Ubicación'}
				</span>
			</div>

			<div class="popup-body">
				<div class="popup-field">
					<label for="custom-phone">Número de WhatsApp (10 dígitos) *</label>
					<div class="input-with-icon">
						<i class="fa-solid fa-phone input-icon"></i>
						<input
							id="custom-phone"
							type="tel"
							placeholder="Ej: 6141234567"
							bind:value={customPhone}
							maxlength="15"
							on:keydown={(e) => e.key === 'Enter' && sendCustomWhatsApp()}
						/>
					</div>
				</div>

				<div class="popup-field">
					<label for="custom-name">Nombre del Contacto (Opcional)</label>
					<div class="input-with-icon">
						<i class="fa-solid fa-user input-icon"></i>
						<input
							id="custom-name"
							type="text"
							placeholder="Ej: Juan Pérez"
							bind:value={customName}
							on:keydown={(e) => e.key === 'Enter' && sendCustomWhatsApp()}
						/>
					</div>
				</div>

				<!-- Vista previa del enlace de propuesta -->
				<div class="popup-link-box">
					<span class="link-label">Enlace a compartir:</span>
					<div class="link-display">
						<code>
							{property?.public_id ? getProposalUrl(property.public_id, customName.trim() || null) : (property?.public_url || 'https://matchhome.vercel.app')}
						</code>
						<button class="copy-btn" class:copied={copySuccess} on:click={copyCustomLink} title="Copiar enlace">
							<i class={copySuccess ? "fa-solid fa-check" : "fa-regular fa-copy"}></i>
							<span>{copySuccess ? "¡Copiado!" : "Copiar"}</span>
						</button>
					</div>
				</div>
			</div>

			<div class="popup-actions">
				<button class="btn-cancel" on:click={closePhonePopup}>
					Cancelar
				</button>
				<button class="btn-send-wa" on:click={sendCustomWhatsApp}>
					<i class="fa-brands fa-whatsapp"></i>
					Abrir WhatsApp
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* POPUP MODAL STYLES (ATAIR Brand Identity) */
	.popup-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
		box-sizing: border-box;
		animation: popupFadeIn 0.2s ease-out;
	}

	@keyframes popupFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.popup-card {
		background: rgb(45, 45, 45);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		width: 100%;
		max-width: 480px;
		padding: 1.5rem;
		color: #ffffff;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		box-sizing: border-box;
		animation: popupScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes popupScaleUp {
		from { transform: scale(0.95); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 0.8rem;
	}

	.popup-title-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.popup-wa-icon {
		font-size: 1.5rem;
		color: #25d366;
	}

	.popup-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 500;
		color: #ffffff;
	}

	.popup-close-btn {
		background: transparent;
		border: none;
		color: #aaa;
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.popup-close-btn:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.1);
	}

	.popup-prop-badge {
		background: rgba(107, 33, 168, 0.2);
		border: 1px solid rgba(147, 51, 234, 0.3);
		border-radius: 8px;
		padding: 0.5rem 0.8rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
	}

	.popup-prop-id {
		font-weight: 700;
		color: #c084fc;
		background: rgba(0, 0, 0, 0.3);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.popup-prop-name {
		color: #e2e8f0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.popup-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.popup-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.popup-field label {
		font-size: 0.85rem;
		color: #ccc;
	}

	.input-with-icon {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-icon {
		position: absolute;
		left: 0.9rem;
		color: #888;
		font-size: 0.95rem;
		pointer-events: none;
	}

	.input-with-icon input {
		width: 100%;
		padding: 0.65rem 0.75rem 0.65rem 2.4rem;
		background: rgb(30, 30, 30);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		color: #ffffff;
		font-size: 0.95rem;
		font-family: inherit;
		box-sizing: border-box;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.input-with-icon input:focus {
		outline: none;
		border-color: #25d366;
		box-shadow: 0 0 0 2px rgba(37, 211, 102, 0.25);
	}

	.popup-link-box {
		background: rgb(30, 30, 30);
		border: 1px dashed rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 0.65rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.link-label {
		font-size: 0.75rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.link-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.link-display code {
		color: #38bdf8;
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.copy-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: #fff;
		padding: 0.3rem 0.65rem;
		font-size: 0.8rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.copy-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.copy-btn.copied {
		background: #166534;
		border-color: #22c55e;
		color: #86efac;
	}

	.popup-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 1rem;
		margin-top: 0.2rem;
	}

	.btn-cancel {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		color: #ccc;
		padding: 0.6rem 1.1rem;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-cancel:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
	}

	.btn-send-wa {
		background: #25d366;
		border: none;
		border-radius: 8px;
		color: #0b2912;
		font-weight: 600;
		padding: 0.6rem 1.2rem;
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
	}

	.btn-send-wa:hover {
		background: #22c35e;
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4);
	}

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

	.select__conts.sent {
		opacity: 0.7;
		transform: scale(0.95);
		transition: all 0.3s ease;
	}

	.sent-indicator {
		position: absolute;
		top: 5px;
		right: 5px;
		background: rgba(76, 175, 80, 0.9);
		color: white;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: bold;
		z-index: 25;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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

	.title {
		display: flex;
		width: 100%;
		justify-content: center;
		text-transform: capitalize;
		font-size: 0.5rem;
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

	.opti__cont {
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
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		color: white;
		font-size: 1rem;
	}

	.send__Prop:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
		background: rgb(76, 76, 76);
	}

	.send__Prop:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: rgb(40, 40, 40);
	}

	.send__Prop.auto-mode {
		background: linear-gradient(135deg, #4caf50, #66bb6a);
		border-color: #4caf50;
	}

	.send__Prop.auto-mode:hover:not(:disabled) {
		background: linear-gradient(135deg, #388e3c, #4caf50);
	}

	.reset__btn {
		background: rgb(76, 76, 76);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 8px;
		padding: 0.75rem 1.5rem;
		cursor: pointer;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		color: white;
		font-size: 1rem;
	}

	.reset__btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
		background: rgb(96, 96, 96);
	}

	/* Estilos para el switch de modo */
	.mode-selector {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin: 1rem 0;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.switch-container {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.mode-label {
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.6);
		transition: all 0.3s ease;
		font-weight: 500;
	}

	.mode-label.active {
		color: #4caf50;
		font-weight: bold;
	}

	.switch {
		position: relative;
		display: inline-block;
		width: 60px;
		height: 34px;
	}

	.switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #333;
		transition: 0.4s;
		border-radius: 34px;
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.slider:before {
		position: absolute;
		content: '';
		height: 24px;
		width: 24px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.4s;
		border-radius: 50%;
	}

	input:checked + .slider {
		background-color: #4caf50;
		border-color: #4caf50;
	}

	input:checked + .slider:before {
		transform: translateX(26px);
	}

	.mode-description {
		text-align: center;
		max-width: 400px;
	}

	.mode-description p {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.8);
		margin: 0;
		line-height: 1.4;
	}

	.btn__send label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.btn__send input[type='checkbox'] {
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
			width: 100%;
		}
		img {
			width: 95%;
		}
		.prop__card {
			font-size: 0.8rem;
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
