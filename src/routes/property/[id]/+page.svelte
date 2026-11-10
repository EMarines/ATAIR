<script lang="ts">
	import { Button, CardContact } from '$components';
	import { formatDate } from '$lib/functions/dateFunctions';
	import { toComaSep } from '$lib/functions/format';
	import type { Property, Contact, Binnacle } from '$lib/types';
	import { goto } from '$app/navigation';
	// import { filtContPropInte } from '$lib/functions/filProperties';
	import { findContactsForProperty } from '$lib/functions/filContacts';
	import { isStage3Or4ForBroadcast } from '$lib/functions/contactBadge';
	import { contactsStore, binnaclesStore, systStatus } from '$lib/stores/dataStore';
	import { whatsappBroadcastStore } from '$lib/stores/whatsappBroadcastStore';
	import { notifications } from '$lib/stores/notificationStore';
	import { deleteDoc, doc, addDoc, collection } from 'firebase/firestore';
	import { db } from '$lib/firebase_toggle';
	import { diaTarde } from '$lib/functions/dateFunctions';
	import { capitalize } from '$lib/functions/capitalize';
	import { sendWhatsApp } from '$lib/functions/whatsapp';
	import { getProposalUrl } from '$lib/functions/urlUtils';
	import { empresa } from '$lib/config/empresa';
	import { formatZona, tagToFeatures } from '$lib/functions/tagConverters';
	// findPropertiesForContact
	export let data;
	let property = data.property as Property;
	let show__contacts = false;
	let contInterested = 'Por_Enviar';
	let contInterest: Contact[] = [];
	let contToRender: Contact[] = [];
	let excludedOtherStagesCount = 0;
	let msgToShow = '';
	let poroShowTo: string[] = ['Posobles_Interesados', 'Por_Enviar', 'Ya_Se_Envió'];
	let showBtn = false;
	let contCheck: Contact[] = [];
	let contToSend: Contact;

	// Popup para enviar WhatsApp manual / sin contacto previo
	let showPhonePopup = false;
	let customPhone = '';
	let customName = '';
	let copySuccess = false;

	// Popup para compartir en Facebook, Grupos e Instagram (@matchhome.mx)
	let showSocialPopup = false;
	let socialShareText = '';
	let socialCopySuccess = false;
	let socialToastMsg = '';

	$: contacts = $contactsStore as Contact[];
	$: currProperty = property as Property;
	$: binnacles = $binnaclesStore as Binnacle[];

	// Función robusta para obtener nombre de ubicación (colonia, dirección o municipio)
	function getLocationString(propOrLoc: any): string {
		if (!propOrLoc) return '';
		let rawStr = '';
		if (typeof propOrLoc === 'string') {
			rawStr = propOrLoc;
		} else if (typeof propOrLoc === 'object') {
			if (typeof propOrLoc.name === 'string' && propOrLoc.name) {
				rawStr = propOrLoc.name;
			} else if (typeof propOrLoc.location === 'string' && propOrLoc.location) {
				rawStr = propOrLoc.location;
			} else if (typeof propOrLoc.location === 'object' && propOrLoc.location?.name) {
				rawStr = propOrLoc.location.name;
			} else if (typeof propOrLoc.colonia === 'string' && propOrLoc.colonia) {
				rawStr = propOrLoc.colonia;
			} else if (typeof propOrLoc.ubicacion === 'string' && propOrLoc.ubicacion) {
				rawStr = propOrLoc.ubicacion;
			} else if (typeof propOrLoc.direccion === 'string' && propOrLoc.direccion) {
				rawStr = propOrLoc.direccion;
			}
		}

		if (!rawStr) return '';

		return rawStr
			.replace(/,?\s*Chihuahua,?\s*Chihuahua/gi, '')
			.replace(/,?\s*Chihuahua/gi, '')
			.replaceAll(',', ', ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Formato de título estándar: "[Tipo] Col. [Colonia] en [Venta/Renta]"
	function formatPropertyTitle(p: Property): string {
		if (!p) return 'Propiedad';
		const type = p.property_type || 'Propiedad';
		const isRental = p.selecTO === 'rental' || p.selecTO === 'rent' || String(p.tipoOperacion).toLowerCase() === 'renta' || p.operation_type === 'rental';
		const op = isRental ? 'Renta' : 'Venta';
		const col = getLocationString(p);
		if (!col) {
			return `${type} en ${op}`;
		}
		const cleanCol = col.replace(/^colonia\s+/i, '').replace(/^col\.?\s+/i, '').trim();
		return `${type} Col. ${cleanCol} en ${op}`;
	}

	// Funciones de filtrado y despacho masivo WABA (estricto Etapa 3 y Etapa 4)
	function computeFilteredLists(
		prop: Property,
		allContacts: Contact[],
		allBinnacles: Binnacle[],
		tab: string,
		resetSelection: boolean = false
	) {
		showBtn = true;
		const allMatches = findContactsForProperty(prop, allContacts);
		contInterest = allMatches.filter(isStage3Or4ForBroadcast);
		excludedOtherStagesCount = Math.max(0, allMatches.length - contInterest.length);

		const sentContactIds = new Set(
			allBinnacles.filter((item) => item.comment === prop.public_id).map((doc) => doc.to)
		);

		if (tab === 'Posobles_Interesados') {
			msgToShow = 'Contactos (Etapas 3 y 4) a quienes les interesa esta propiedad';
			contToRender = contInterest;
		} else if (tab === 'Por_Enviar') {
			msgToShow = 'Pendientes por enviar (Etapas 3 y 4)';
			contToRender = contInterest.filter((doc) => !sentContactIds.has(doc.id));
		} else if (tab === 'Ya_Se_Envió') {
			msgToShow = 'Contactos (Etapas 3 y 4) a quienes ya se les envió';
			contToRender = contInterest.filter((doc) => sentContactIds.has(doc.id));
		}

		if (resetSelection) {
			contCheck = [];
		} else {
			const renderIds = new Set(contToRender.map((c) => c.id));
			contCheck = contCheck.filter((c) => renderIds.has(c.id));
		}
	}

	const listToRender = () => {
		computeFilteredLists(currProperty, contacts, binnacles, contInterested, true);
	};

	$: if (show__contacts && currProperty) {
		computeFilteredLists(currProperty, contacts, binnacles, contInterested, false);
	}

	$: sentContactIdsForProp = new Set(
		binnacles.filter((item) => item.comment === property?.public_id).map((doc) => doc.to)
	);

	function isContactQueued(cont: Contact, queuedKeys: string[]): boolean {
		if (!property?.public_id || !cont?.id) return false;
		return queuedKeys.includes(`${property.public_id.trim()}::${cont.id.trim()}`);
	}

	function isContactSent(cont: Contact, sentKeys: string[], sentIds: Set<string | undefined>): boolean {
		if (!cont?.id) return false;
		if (sentIds.has(cont.id)) return true;
		if (!property?.public_id) return false;
		return sentKeys.includes(`${property.public_id.trim()}::${cont.id.trim()}`);
	}

	const selectAll = (e: Event) => {
		const isChecked = (e.target as HTMLInputElement).checked;
		if (!isChecked) {
			contCheck = [];
			return;
		}
		const queued = $whatsappBroadcastStore.queuedKeys;
		contCheck = contToRender.filter((c) => !isContactQueued(c, queued));
	};

	// Envío oficial por Meta WhatsApp Cloud API en segundo plano (SOLO Etapas 3 y 4)
	function sendProperty() {
		if (contCheck.length === 0) {
			notifications.warning('Selecciona al menos un contacto para iniciar el envío.', 4000);
			return;
		}

		const enqueued = whatsappBroadcastStore.enqueue(currProperty, contCheck);
		if (enqueued > 0) {
			contCheck = [];
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
		const targetId = property.public_id || property.id || property.clavePropiedad || id;
		if (targetId) {
			goto(`/subir-propiedad?edit=${encodeURIComponent(targetId)}`);
		}
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

	function getPublicSocialUrl(p: Property): string {
		const id = p?.public_id || p?.easybroker_id || p?.id || p?.clavePropiedad || '';
		if (id) {
			return `https://matchhome.vercel.app/property/${encodeURIComponent(id.trim())}`;
		}
		return p?.public_url || 'https://matchhome.vercel.app';
	}

	function buildDefaultSocialCopy(p: Property): string {
		if (!p) return '';
		const title = formatPropertyTitle(p);
		const priceStr = p.price ? `$${toComaSep(Number(p.price))} MXN` : 'Precio a consultar';
		const specs: string[] = [];
		if (Number(p.bedrooms) > 0) specs.push(`🛏️ ${Number(p.bedrooms)} Recámaras`);
		if (Number(p.bathrooms) > 0) specs.push(`🚿 ${Number(p.bathrooms)} Baños`);
		if (Number(p.half_bathrooms) > 0) specs.push(`🚽 ${Number(p.half_bathrooms)} Medios baños`);
		if (Number(p.parking_spaces) > 0) specs.push(`🚗 ${Number(p.parking_spaces)} Estacionamientos`);
		if (Number(p.construction_size) > 0) specs.push(`📐 ${Number(p.construction_size)} m² construcción`);
		if (Number(p.lot_size) > 0) specs.push(`🌳 ${Number(p.lot_size)} m² terreno`);

		const zona = formatZona(p);
		const amenidades = tagToFeatures(p.tags || []);
		const rawDesc = (p.description || p.public_description || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
		const shortDesc = rawDesc.length > 220 ? `${rawDesc.substring(0, 217)}...` : rawDesc;
		const pubUrl = getPublicSocialUrl(p);
		const waPhone = (empresa?.phoneNumber || '6145404003').replace(/\D/g, '');

		const lines: string[] = [
			`🏡 ${title.toUpperCase()}`,
			`💰 ${priceStr}${zona ? ` | 📍 Zona ${zona}` : ''}`
		];

		if (specs.length > 0) {
			lines.push('', specs.join(' • '));
		}
		if (amenidades.length > 0) {
			lines.push(`✨ Equipo y amenidades: ${amenidades.join(', ')}`);
		}
		if (shortDesc) {
			lines.push('', shortDesc);
		}

		lines.push(
			'',
			`📲 Informes y citas por WhatsApp: https://wa.me/52${waPhone}`,
			`🔗 Ver galería completa y ubicación: ${pubUrl}`
		);

		return lines.join('\n');
	}

	function openSocialSharePopup() {
		socialShareText = buildDefaultSocialCopy(property);
		socialCopySuccess = false;
		socialToastMsg = '';
		showSocialPopup = true;
	}

	function closeSocialSharePopup() {
		showSocialPopup = false;
		socialCopySuccess = false;
		socialToastMsg = '';
	}

	async function copySocialTextToClipboard(customFeedback?: string) {
		try {
			await navigator.clipboard.writeText(socialShareText);
			socialCopySuccess = true;
			socialToastMsg = customFeedback || '✅ ¡Texto comercial copiado al portapapeles! Solo presiona Ctrl+V (o Pegar) en Facebook/Instagram.';
			setTimeout(() => {
				socialCopySuccess = false;
			}, 4000);
		} catch (err) {
			console.warn('No se pudo copiar al portapapeles:', err);
		}
	}

	async function logSocialShareBinnacle(channelLabel: string) {
		try {
			const newBinnacle: Binnacle = {
				date: Date.now(),
				comment: (property?.public_id || '').trim(),
				to: channelLabel,
				action: 'Propiedad compartida en redes: '
			};
			await addDoc(collection(db, 'binnacles'), newBinnacle);
		} catch (err) {
			console.warn('No se pudo registrar bitácora social:', err);
		}
	}

	async function shareOnFacebookAndGroups() {
		const shareUrl = getPublicSocialUrl(property);
		await copySocialTextToClipboard('✅ ¡Texto copiado! En la ventana de Facebook elige "Compartir en un grupo" o en tu muro y presiona Ctrl+V.');
		const fbSharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
		window.open(fbSharerUrl, 'facebook-share-dialog', 'width=720,height=680,noopener,noreferrer');
		await logSocialShareBinnacle('Facebook / Grupos');
	}

	async function shareInFacebookGroupsFeed() {
		await copySocialTextToClipboard('✅ ¡Texto y link copiados! Elige tu grupo (ej. Casas en Venta y Renta en Chihuahua) y presiona Ctrl+V.');
		window.open('https://www.facebook.com/groups/joins/', '_blank', 'noopener,noreferrer');
		await logSocialShareBinnacle('Grupos de Facebook');
	}

	async function shareOnMetaPageAndInstagram() {
		await copySocialTextToClipboard('✅ ¡Texto copiado! Sube la foto en Meta Business Suite y pega el texto (Ctrl+V) para publicar en Match Home + @matchhome.mx.');
		// Forzar ID oficial verificado: Portfolio MatchHome (823519881333281) y Página (296651260964331)
		window.open('https://business.facebook.com/latest/composer?business_id=823519881333281&page_id=296651260964331&asset_id=296651260964331', '_blank', 'noopener,noreferrer');
		await logSocialShareBinnacle('Facebook Match Home + Instagram @matchhome.mx');
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
					src={property.title_image_thumb || '/placeholder-property.png'}
					alt={formatPropertyTitle(property)}
				/>
			</div>

			<div class="prop__card">
				<div class="prop__info">
					<div class="propTitle">
						<h1 class="title">
							{formatPropertyTitle(property)}
						</h1>
					</div>
					<div class="prop__price">
						<h2>Precio $ {toComaSep(property.price)}.</h2>
						<p class="alta__prop">Alta: {formatDate(Number(property.created_at))}</p>
					</div>
					{#if property.source === 'synergy' || property.procedencia?.startsWith('S') || property.companiaCaptadora || property.idCompaniaCaptadora}
						{@const procLabel = (property.procedencia || '').replace(/^Sinergia\s*/i, '').trim()}
						<div class="prop__captador_row">
							<span class="badge-syn-tag">
								🤝 {procLabel ? `${procLabel}: ` : ''}{property.nombreContactoCaptador || property.companiaCaptadora || property.idCompaniaCaptadora || 'Aliada'}{property.nombreContactoCaptador && (property.companiaCaptadora || property.idCompaniaCaptadora) && property.nombreContactoCaptador !== (property.companiaCaptadora || property.idCompaniaCaptadora) ? ` (${property.companiaCaptadora || property.idCompaniaCaptadora})` : ''}
							</span>
							{#if property.telefonoContactoCaptador}
								<a
									href="https://wa.me/52{String(property.telefonoContactoCaptador).replace(/\D/g, '')}"
									target="_blank"
									rel="noopener noreferrer"
									class="badge-phone-link"
								>
									📞 {property.telefonoContactoCaptador} (WhatsApp)
								</a>
							{/if}
						</div>
					{:else if property.source === 'direct' || (!property.public_id?.startsWith('EB-') && property.source !== 'easybroker')}
						<div class="prop__captador_row">
							<span class="badge-direct-tag">📝 Captura Directa (Manual)</span>
							{#if property.companiaCaptadora || property.idCompaniaCaptadora}
								<span class="badge-comp-tag">🏢 {property.companiaCaptadora || property.idCompaniaCaptadora}</span>
							{/if}
							{#if property.telefonoContactoCaptador}
								<a
									href="https://wa.me/52{String(property.telefonoContactoCaptador).replace(/\D/g, '')}"
									target="_blank"
									rel="noopener noreferrer"
									class="badge-phone-link"
								>
									📞 {property.telefonoContactoCaptador} (WhatsApp)
								</a>
							{/if}
						</div>
					{/if}
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
							{#if formatZona(property)}
								<span title="Zona de la Ciudad">
									<i class="fa-sharp fa-regular fa-compass to__showR"></i>
									{formatZona(property)}
								</span>
							{/if}
							{#if tagToFeatures(property.tags).length > 0}
								<span title="Amenidades">
									<i class="fa-solid fa-tags to__showR"></i>
									{tagToFeatures(property.tags).join(', ')}
								</span>
							{/if}
						</div>
					</div>
				</div>
				<div class="actions">
					<i
						class="fa-regular fa-pen-to-square action-icon edit-icon"
						on:click={() => editProp(property.public_id)}
						on:keydown={() => {}}
						role="button"
						tabindex="0"
						aria-label="Editar propiedad"
						title="Editar propiedad"
					></i>

					<i
						class="fa-regular fa-trash-can action-icon delete-icon"
						on:click={() => deleProperty(property.public_id)}
						on:keydown={() => {}}
						role="button"
						tabindex="0"
						aria-label="Eliminar propiedad"
						title="Eliminar propiedad"
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
				icon="fa-brands fa-facebook"
				on:click={openSocialSharePopup}
			>
				Compartir FB / IG
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

		<!-- Muestra opciones para buscar contactos interesados (SOLO Etapas 3 y 4) -->
		{#if show__contacts}
			<div class="mainContainer">
				<div class="waba-dispatch-panel">
					<div class="waba-dispatch-top">
						<div class="waba-dispatch-title">
							<i class="fa-brands fa-whatsapp"></i>
							<span>Envío Masivo Oficial · WhatsApp Cloud API (2° Plano)</span>
						</div>
						<div class="waba-badges">
							<span class="waba-shield-badge">🔒 Solo Etapas 3 y 4</span>
							{#if excludedOtherStagesCount > 0}
								<span class="waba-excluded-badge" title="Contactos de Etapas 1, 2, 5, Post-Venta o Sinergias excluidos automáticamente">
									{excludedOtherStagesCount} de otras etapas omitidos
								</span>
							{/if}
						</div>
					</div>
					<p class="waba-dispatch-desc">
						Plantilla aprobada: <code>nuevo_inventario_match</code> · Se envía automáticamente con el nombre del prospecto, ubicación, precio y enlace personalizado sin abrir pestañas ni bloquear ATAIR.
					</p>
				</div>

				<div class="sect__Title">
					{#if contToRender.length === 0}
						<h1>No hay contactos en Etapa 3 o 4 en esta vista</h1>
					{:else}
						<h1>{contToRender.length} — {msgToShow}</h1>
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
								{list === 'Posobles_Interesados'
									? 'Posibles Interesados'
									: list.replaceAll('_', ' ')}
							</label>
						{/each}
					</div>
				</div>
			</div>

			<!-- Barra de acción para envío en segundo plano -->
			{#if showBtn && contInterested !== 'Ya_Se_Envió' && contToRender.length > 0}
				<div class="btn__send">
					<button
						id="Evio_prop_selec"
						class="send__Prop auto-mode"
						on:click={sendProperty}
						disabled={contCheck.length === 0}
					>
						🚀 Enviar en 2° plano ({contCheck.length}
						{contCheck.length === 1 ? 'contacto' : 'contactos'})
					</button>

					<label>
						<input
							type="checkbox"
							on:change={selectAll}
							checked={contToRender.length > 0 && contCheck.length === contToRender.length}
						/>
						Seleccionar todos ({contToRender.length})
					</label>
				</div>
			{/if}

			<div class="cards__container">
				{#each contToRender as cont (cont.id)}
					{@const queued = isContactQueued(cont, $whatsappBroadcastStore.queuedKeys)}
					{@const alreadySent = isContactSent(cont, $whatsappBroadcastStore.sentKeys, sentContactIdsForProp)}
					<div class="select__conts" class:sent={alreadySent}>
						{#if contInterested !== 'Ya_Se_Envió'}
							<input
								type="checkbox"
								value={cont}
								name={cont.id}
								class="form__contCheck"
								bind:group={contCheck}
								disabled={queued}
							/>
						{/if}
						{#if queued}
							<div class="queued-indicator">⏳ En cola 2° plano...</div>
						{:else if alreadySent}
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
					{formatPropertyTitle(property)}
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

{#if showSocialPopup}
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="popup-backdrop"
		on:click={closeSocialSharePopup}
		on:keydown={(e) => e.key === 'Escape' && closeSocialSharePopup()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div
			class="popup-card social-popup-card"
			on:click|stopPropagation={() => {}}
			on:keydown|stopPropagation={() => {}}
			role="document"
		>
			<div class="popup-header">
				<div class="popup-title-group">
					<i class="fa-brands fa-facebook popup-fb-icon"></i>
					<i class="fa-brands fa-instagram popup-ig-icon"></i>
					<h3>Compartir en Facebook, Grupos e Instagram</h3>
				</div>
				<button class="popup-close-btn" on:click={closeSocialSharePopup} aria-label="Cerrar">
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="popup-prop-badge">
				<span class="popup-prop-id">{property.public_id}</span>
				<span class="popup-prop-name">
					{formatPropertyTitle(property)} — ${toComaSep(Number(property.price || 0))}
				</span>
			</div>

			<div class="popup-body">
				<div class="social-tip-banner">
					<i class="fa-solid fa-circle-info"></i>
					<span>
						Al tocar cualquier botón de abajo, <strong>se copia automáticamente el texto comercial</strong> a tu portapapeles. En la ventana de Facebook podrás elegir arriba <strong>"Compartir en un grupo"</strong> o en tu muro y solo presionar <strong>Ctrl + V</strong> (Pegar).
					</span>
				</div>

				<div class="popup-field">
					<div class="social-label-row">
						<label for="social-share-textarea">Texto Comercial para la Publicación (Editable):</label>
						<button
							type="button"
							class="copy-btn"
							class:copied={socialCopySuccess}
							on:click={() => copySocialTextToClipboard()}
						>
							<i class={socialCopySuccess ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
							<span>{socialCopySuccess ? '¡Texto Copiado!' : 'Copiar Texto'}</span>
						</button>
					</div>
					<textarea
						id="social-share-textarea"
						class="social-textarea"
						rows="5"
						bind:value={socialShareText}
					></textarea>
				</div>

				{#if socialToastMsg}
					<div class="social-toast-box">
						{socialToastMsg}
					</div>
				{/if}

				<div class="popup-link-box">
					<span class="link-label">Ficha Pública con Vista Previa (OpenGraph):</span>
					<div class="link-display">
						<code>{getPublicSocialUrl(property)}</code>
						{#if property.title_image_thumb}
							<a
								href={property.title_image_thumb}
								target="_blank"
								rel="noopener noreferrer"
								class="copy-btn"
								title="Ver / Guardar foto principal para Instagram"
							>
								<i class="fa-regular fa-image"></i>
								<span>Foto Portada</span>
							</a>
						{/if}
					</div>
				</div>

				<div class="social-actions-grid">
					<button type="button" class="btn-social-fb" on:click={shareOnFacebookAndGroups}>
						<i class="fa-brands fa-facebook"></i>
						<div class="btn-social-text">
							<strong>Compartir en Facebook o en un Grupo</strong>
							<small>Abre ventana oficial (elige Muro, Página o Grupo) + Auto-copia texto</small>
						</div>
					</button>

					<button type="button" class="btn-social-groups" on:click={shareInFacebookGroupsFeed}>
						<i class="fa-solid fa-users"></i>
						<div class="btn-social-text">
							<strong>Ir directo a Mis Grupos de Facebook</strong>
							<small>Ideal para publicar directo en "Casas en Venta y Renta en Chihuahua"</small>
						</div>
					</button>

					<button type="button" class="btn-social-meta" on:click={shareOnMetaPageAndInstagram}>
						<i class="fa-brands fa-instagram"></i>
						<div class="btn-social-text">
							<strong>Publicar en Match Home (FB + Instagram @matchhome.mx)</strong>
							<small>Abre Meta Business Suite para publicación simultánea en ambas redes</small>
						</div>
					</button>
				</div>
			</div>

			<div class="popup-actions">
				<button class="btn-cancel" on:click={closeSocialSharePopup}>
					Cerrar
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
		overflow-y: auto;
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

	.social-popup-card {
		max-width: 560px;
		max-height: 88vh;
		overflow: hidden;
		margin: auto;
		padding: 1.15rem 1.35rem;
		gap: 0.75rem;
	}

	.social-popup-card .popup-header,
	.social-popup-card .popup-prop-badge,
	.social-popup-card .popup-actions {
		flex-shrink: 0;
	}

	.social-popup-card .popup-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding-right: 0.35rem;
		gap: 0.75rem;
	}

	.popup-fb-icon {
		font-size: 1.45rem;
		color: #1877f2;
	}

	.popup-ig-icon {
		font-size: 1.45rem;
		color: #e1306c;
	}

	.social-tip-banner {
		background: rgba(24, 119, 242, 0.14);
		border: 1px solid rgba(56, 189, 248, 0.35);
		border-radius: 8px;
		padding: 0.65rem 0.85rem;
		font-size: 0.82rem;
		line-height: 1.4;
		color: #e0f2fe;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.social-tip-banner i {
		color: #38bdf8;
		font-size: 1rem;
		margin-top: 0.12rem;
	}

	.social-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.social-textarea {
		width: 100%;
		padding: 0.7rem 0.85rem;
		background: rgb(26, 26, 26);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 8px;
		color: #f8fafc;
		font-size: 0.85rem;
		line-height: 1.45;
		font-family: inherit;
		resize: vertical;
		box-sizing: border-box;
	}

	.social-textarea:focus {
		outline: none;
		border-color: #38bdf8;
		box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
	}

	.social-toast-box {
		background: rgba(22, 101, 52, 0.35);
		border: 1px solid rgba(34, 197, 94, 0.5);
		color: #bbf7d0;
		font-size: 0.82rem;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		font-weight: 500;
	}

	.social-actions-grid {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-top: 0.2rem;
	}

	.btn-social-fb,
	.btn-social-groups,
	.btn-social-meta {
		width: 100%;
		border: none;
		border-radius: 10px;
		padding: 0.75rem 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		text-align: left;
		color: #ffffff;
		transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
	}

	.btn-social-fb {
		background: linear-gradient(135deg, #1877f2, #0d5bd9);
		box-shadow: 0 4px 14px rgba(24, 119, 242, 0.35);
	}

	.btn-social-groups {
		background: linear-gradient(135deg, #0284c7, #0369a1);
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);
	}

	.btn-social-meta {
		background: linear-gradient(135deg, #833ab4, #fd1d1d 55%, #fcb045);
		box-shadow: 0 4px 14px rgba(225, 48, 108, 0.35);
	}

	.btn-social-fb:hover,
	.btn-social-groups:hover,
	.btn-social-meta:hover {
		transform: translateY(-2px);
		filter: brightness(1.07);
	}

	.btn-social-fb i,
	.btn-social-groups i,
	.btn-social-meta i {
		font-size: 1.5rem;
		min-width: 1.6rem;
		text-align: center;
	}

	.btn-social-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.btn-social-text strong {
		font-size: 0.92rem;
		font-weight: 700;
	}

	.btn-social-text small {
		font-size: 0.76rem;
		opacity: 0.9;
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
		align-items: center;
		gap: 1rem;
	}

	.actions .action-icon {
		--fa-display: inline-flex;
		display: inline-flex !important;
		align-items: center !important;
		justify-content: center !important;
		width: 36px;
		height: 36px;
		padding: 0 !important;
		margin: 0 !important;
		line-height: 1 !important;
		box-sizing: border-box !important;
	}

	.btn__options {
		display: flex;
		width: 100%;
		justify-content: space-evenly;
		flex-wrap: wrap;
	}

	.queued-indicator {
		position: absolute;
		top: 10px;
		right: 10px;
		background: rgba(245, 158, 11, 0.92);
		color: #111827;
		padding: 4px 9px;
		border-radius: 12px;
		font-size: 0.78rem;
		font-weight: 700;
		z-index: 25;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
	}

	.waba-dispatch-panel {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: min(860px, 96%);
		margin: 1rem auto;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(17, 24, 39, 0.75));
		border: 1px solid rgba(16, 185, 129, 0.35);
		border-radius: 12px;
	}

	.waba-dispatch-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.waba-dispatch-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: #ecfdf5;
	}

	.waba-dispatch-title i {
		color: #25d366;
		font-size: 1.2rem;
	}

	.waba-badges {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.waba-shield-badge {
		background: rgba(16, 185, 129, 0.2);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.45);
		padding: 0.22rem 0.65rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.waba-excluded-badge {
		background: rgba(255, 255, 255, 0.08);
		color: #d1d5db;
		border: 1px solid rgba(255, 255, 255, 0.15);
		padding: 0.22rem 0.65rem;
		border-radius: 999px;
		font-size: 0.75rem;
	}

	.waba-dispatch-desc {
		margin: 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.78);
		line-height: 1.45;
	}

	.waba-dispatch-desc code {
		background: rgba(0, 0, 0, 0.35);
		color: #6ee7b7;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.sect__Title {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.6rem;
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
		flex-wrap: wrap;
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
		font-weight: 600;
	}

	.send__Prop:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
		background: rgb(76, 76, 76);
	}

	.send__Prop:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		background: rgb(40, 40, 40);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.send__Prop.auto-mode:not(:disabled) {
		background: linear-gradient(135deg, #10b981, #059669);
		border-color: #10b981;
	}

	.send__Prop.auto-mode:hover:not(:disabled) {
		background: linear-gradient(135deg, #059669, #047857);
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

	.prop__captador_row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.35rem 0;
	}

	.badge-syn-tag {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.4);
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
	}

	.badge-phone-link {
		background: rgba(56, 189, 248, 0.15);
		color: #0284c7;
		border: 1px solid rgba(56, 189, 248, 0.35);
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
		text-decoration: none;
		font-family: monospace;
		transition: all 0.2s ease;
	}

	.badge-phone-link:hover {
		background: rgba(56, 189, 248, 0.25);
		color: #0369a1;
	}


	.badge-direct-tag {
		background: rgba(147, 51, 234, 0.15);
		color: #7e22ce;
		border: 1px solid rgba(147, 51, 234, 0.35);
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
	}

	.badge-comp-tag {
		background: rgba(245, 158, 11, 0.15);
		color: #d97706;
		border: 1px solid rgba(245, 158, 11, 0.35);
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
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
	}
</style>
