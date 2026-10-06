<!-- src/routes/property/[id]/+page.svelte -->
<!-- Ficha Completa de Propiedad con Generador Móvil de Propuesta Ligera - ATAIR CRM -->

<script lang="ts">
	import { onMount } from 'svelte';
	import type { Property, Contact } from '$lib/types';
	import { formatCurrency, formatNumber } from '$lib/functions/formatUtils';
	import { formatDisplayPhone, extractCleanPhone } from '$lib/functions/phoneUtils';
	import { getProposalUrl } from '$lib/functions/urlUtils';
	import { buildProposalWhatsAppMessage, formatPropertyPhrase } from '$lib/functions/proposalMessage';
	import { notifications } from '$lib/stores/notificationStore';
	import { userStore, userProfile, isAdmin } from '$lib/firebase/authManager';
	import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase/config';

	export let data: { property: Property };

	$: property = data.property;
	$: code = property.public_id || property.clavePropiedad || property.id || '';
	$: isRental =
		String(property.tipoOperacion || property.operation_type || property.selecTO)
			.toLowerCase()
			.includes('rent');
	$: price = property.price || property.precio || 0;
	$: title = property.title || property.titulo || 'Propiedad sin título';
	$: colonia = property.colonia || property.location || 'Chihuahua, Chih.';
	$: type = property.property_type || property.tipoPropiedad || 'Propiedad';

	// Imágenes y Galería
	$: imagesList = Array.isArray(property.images) && property.images.length > 0
		? property.images
		: property.title_image_thumb
			? [property.title_image_thumb]
			: ['/placeholder-property.png'];

	let activeImageIndex = 0;
	$: currentImage = imagesList[activeImageIndex] || '/placeholder-property.png';

	// Cartera de contactos del asesor para generar propuestas personalizadas
	let contacts: Contact[] = [];
	let loadingContacts = true;
	let contactSearch = '';
	let selectedContact: Contact | null = null;
	let isCustomNumber = false;
	let customPhone = '';
	let customName = '';

	// Mensaje generado reactivo
	$: activeClientName = selectedContact
		? (selectedContact.name || selectedContact.fullName || 'Cliente')
		: customName || 'Cliente';

	$: activeClientPhone = selectedContact
		? (selectedContact.telephon || selectedContact.phoneFormatted || '')
		: customPhone;

	$: activeContactId = selectedContact?.id || (isCustomNumber ? customName : '');

	$: generated = buildProposalWhatsAppMessage({
		clientName: activeClientName,
		propertyType: type,
		propertyTitle: title,
		propertyPublicId: code,
		contactOrIdentifier: selectedContact ? selectedContact.id : (customName || null),
		phone: activeClientPhone,
		isFirstContact: !selectedContact // Si es contacto seleccionado de cartera, es seguimiento
	});

	onMount(async () => {
		await loadContacts();
	});

	async function loadContacts() {
		loadingContacts = true;
		try {
			const user = $userStore;
			let q;
			if ($isAdmin) {
				q = query(collection(db, 'contacts'));
			} else if (user?.uid) {
				q = query(collection(db, 'contacts'), where('associate_id', '==', user.uid));
			} else {
				q = query(collection(db, 'contacts'));
			}

			const snap = await getDocs(q);
			contacts = snap.docs.map((d) => ({
				id: d.id,
				...(d.data() as any)
			}));
		} catch (err) {
			console.warn('[PropertyDetail] Error cargando contactos:', err);
		} finally {
			loadingContacts = false;
		}
	}

	// Filtro predictivo de contactos
	$: filteredContacts = contactSearch.trim()
		? contacts.filter((c) => {
				const term = contactSearch.toLowerCase();
				const name = `${c.name || ''} ${c.lastname || ''} ${c.fullName || ''}`.toLowerCase();
				const tel = String(c.telephon || '').toLowerCase();
				return name.includes(term) || tel.includes(term);
		  }).slice(0, 8)
		: contacts.slice(0, 8);

	function selectContact(c: Contact) {
		selectedContact = c;
		contactSearch = `${c.name || ''} ${c.lastname || ''}`.trim();
		isCustomNumber = false;
	}

	function clearContactSelection() {
		selectedContact = null;
		contactSearch = '';
		isCustomNumber = false;
		customPhone = '';
		customName = '';
	}

	function copyProposalUrlOnly() {
		const url = getProposalUrl(code, selectedContact ? selectedContact.id : null);
		navigator.clipboard.writeText(url);
		notifications.success('¡Enlace de propuesta copiado al portapapeles!');
	}

	function copyFullWhatsAppMessage() {
		if (!generated.text) return;
		navigator.clipboard.writeText(generated.text);
		notifications.success('¡Mensaje de WhatsApp copiado al portapapeles!');
	}

	async function recordSentProposal() {
		try {
			if (selectedContact?.id) {
				await addDoc(collection(db, 'binnacles'), {
					contactId: selectedContact.id,
					tipo: 'whatsapp',
					descripcion: `Propuesta enviada: ${code} - ${title}`,
					comment: code,
					fecha: new Date(),
					date: Date.now(),
					author: $userProfile?.displayName || $userStore?.email || 'Asesor',
					action: 'Envío de propuesta pública'
				});
			}
		} catch (err) {
			console.warn('[PropertyDetail] No se pudo guardar bitácora:', err);
		}
	}

	function handleSendWhatsApp() {
		if (!generated.url) {
			notifications.warning('Ingresa un número telefónico válido para enviar por WhatsApp.');
			return;
		}
		recordSentProposal();
		window.open(generated.url, '_blank');
	}
</script>

<svelte:head>
	<title>{title} ({code}) | ATAIR CRM</title>
</svelte:head>

<div class="property-detail-page">
	<!-- Barra de Navegación Superior -->
	<div class="top-nav-bar">
		<a href="/properties" class="btn-back">
			<i class="fa-solid fa-arrow-left"></i>
			<span>Volver al Catálogo</span>
		</a>

		<div class="top-badges-group">
			<span class="badge-op" class:rental={isRental}>
				{isRental ? 'RENTA' : 'VENTA'}
			</span>
			<span class="badge-code">{code}</span>
		</div>
	</div>

	<!-- Layout Principal (2 Columnas en Desktop, 1 Columna en Móvil) -->
	<div class="detail-grid">
		<!-- Columna Izquierda: Galería e Información Técnica -->
		<div class="main-info-col">
			<!-- Galería de Fotos -->
			<div class="gallery-card">
				<div class="main-photo-frame">
					<img src={currentImage} alt={title} class="main-photo" />
					<span class="photo-counter-pill">
						<i class="fa-regular fa-image"></i>
						{activeImageIndex + 1} / {imagesList.length}
					</span>
				</div>

				{#if imagesList.length > 1}
					<div class="thumbnails-track">
						{#each imagesList as imgUrl, idx}
							<button
								type="button"
								class="thumb-btn"
								class:active={activeImageIndex === idx}
								on:click={() => (activeImageIndex = idx)}
							>
								<img src={imgUrl} alt="Miniatura {idx + 1}" class="thumb-img" />
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Título, Precio y Ubicación -->
			<div class="section-card">
				<div class="price-header">
					<div class="price-val">
						{formatCurrency(price)}
						{#if isRental}<span class="rental-period">/mes</span>{/if}
					</div>
					<span class="type-pill">{type}</span>
				</div>

				<h1 class="property-full-title">{title}</h1>

				<div class="location-banner">
					<i class="fa-solid fa-location-dot loc-pin"></i>
					<span>{colonia}</span>
				</div>
			</div>

			<!-- Tarjeta de Especificaciones Técnicas -->
			<div class="section-card">
				<h2 class="section-title">
					<i class="fa-solid fa-list-check title-ico"></i>
					Especificaciones del Inmueble
				</h2>

				<div class="specs-grid">
					{#if property.bedrooms || property.recamaras}
						<div class="spec-tile">
							<i class="fa-solid fa-bed spec-icon"></i>
							<div class="spec-data">
								<span class="spec-label">Recámaras</span>
								<span class="spec-value">{property.bedrooms || property.recamaras}</span>
							</div>
						</div>
					{/if}

					{#if property.bathrooms || property.banos}
						<div class="spec-tile">
							<i class="fa-solid fa-bath spec-icon"></i>
							<div class="spec-data">
								<span class="spec-label">Baños</span>
								<span class="spec-value">{property.bathrooms || property.banos}</span>
							</div>
						</div>
					{/if}

					{#if property.half_bathrooms || property.mediosBanos}
						<div class="spec-tile">
							<i class="fa-solid fa-toilet spec-icon"></i>
							<div class="spec-data">
								<span class="spec-label">Medios Baños</span>
								<span class="spec-value">{property.half_bathrooms || property.mediosBanos}</span>
							</div>
						</div>
					{/if}

					{#if property.parking_spaces || property.estacionamientos}
						<div class="spec-tile">
							<i class="fa-solid fa-car spec-icon"></i>
							<div class="spec-data">
								<span class="spec-label">Estacionamientos</span>
								<span class="spec-value">{property.parking_spaces || property.estacionamientos}</span>
							</div>
						</div>
					{/if}

					{#if property.construction_size || property.construccion}
						<div class="spec-tile">
							<i class="fa-solid fa-ruler-combined spec-icon"></i>
							<div class="spec-data">
								<span class="spec-label">Construcción</span>
								<span class="spec-value">{formatNumber(property.construction_size || property.construccion)} m²</span>
							</div>
						</div>
					{/if}

					{#if property.lot_size || property.terreno}
						<div class="spec-tile">
							<i class="fa-solid fa-chart-area spec-icon"></i>
							<div class="spec-data">
								<span class="spec-label">Terreno</span>
								<span class="spec-value">{formatNumber(property.lot_size || property.terreno)} m²</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Memoria Descriptiva -->
			{#if property.description || property.descripcion}
				<div class="section-card">
					<h2 class="section-title">
						<i class="fa-solid fa-align-left title-ico"></i>
						Descripción y Detalles
					</h2>
					<div class="description-content">
						{property.description || property.descripcion}
					</div>
				</div>
			{/if}

			<!-- Contacto del Captador si es Sinergia o Directa -->
			{#if property.source === 'synergy' || property.source === 'direct' || property.nombreContactoCaptador || property.companiaCaptadora}
				<div class="section-card captador-card">
					<h2 class="section-title">
						<i class="fa-solid fa-handshake title-ico"></i>
						Datos del Captador / Alianza
					</h2>

					<div class="captador-body">
						<div class="captador-row">
							<span class="captador-lbl">Origen:</span>
							<span class="captador-val">{property.sourceName || 'Sinergia Comercial'}</span>
						</div>

						{#if property.companiaCaptadora}
							<div class="captador-row">
								<span class="captador-lbl">Empresa:</span>
								<span class="captador-val">{property.companiaCaptadora}</span>
							</div>
						{/if}

						{#if property.nombreContactoCaptador}
							<div class="captador-row">
								<span class="captador-lbl">Contacto:</span>
								<span class="captador-val">{property.nombreContactoCaptador}</span>
							</div>
						{/if}

						{#if property.telefonoContactoCaptador}
							<div class="captador-row">
								<span class="captador-lbl">Teléfono:</span>
								<a
									href="https://wa.me/52{extractCleanPhone(String(property.telefonoContactoCaptador))}"
									target="_blank"
									rel="noopener noreferrer"
									class="captador-wa-link"
								>
									<i class="fa-brands fa-whatsapp"></i>
									{formatDisplayPhone(String(property.telefonoContactoCaptador))}
								</a>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Columna Derecha: Generador Móvil de Propuesta & WhatsApp -->
		<aside class="proposal-aside-col">
			<div class="proposal-card">
				<div class="proposal-card-header">
					<div class="proposal-badge-row">
						<i class="fa-solid fa-paper-plane send-ico"></i>
						<span class="proposal-tag">Generador de Propuesta</span>
					</div>
					<h3 class="proposal-heading">Compartir con Cliente</h3>
					<p class="proposal-desc">
						Envía la ficha interactiva oficial en 1 clic por WhatsApp con el mensaje ligero canónico.
					</p>
				</div>

				<!-- Selección de Destinatario: Contacto de Cartera vs Número Libre -->
				<div class="target-type-selector">
					<button
						type="button"
						class="toggle-type-btn"
						class:active={!isCustomNumber}
						on:click={() => (isCustomNumber = false)}
					>
						<i class="fa-solid fa-address-book"></i>
						Mi Cartera
					</button>
					<button
						type="button"
						class="toggle-type-btn"
						class:active={isCustomNumber}
						on:click={() => {
							isCustomNumber = true;
							selectedContact = null;
						}}
					>
						<i class="fa-solid fa-phone"></i>
						Número Nuevo
					</button>
				</div>

				{#if !isCustomNumber}
					<!-- Selector de Contacto de Cartera -->
					<div class="contact-picker-box">
						<label for="contact-search-input" class="picker-label">Buscar en mi cartera:</label>
						<div class="picker-input-wrap">
							<i class="fa-solid fa-magnifying-glass picker-ico"></i>
							<input
								id="contact-search-input"
								type="text"
								bind:value={contactSearch}
								placeholder="Escribe nombre o teléfono..."
								class="picker-input"
							/>
							{#if contactSearch}
								<button class="picker-clear-btn" on:click={clearContactSelection}>
									<i class="fa-solid fa-xmark"></i>
								</button>
							{/if}
						</div>

						<!-- Lista desplegable de coincidencias -->
						{#if !selectedContact && filteredContacts.length > 0}
							<div class="contacts-dropdown-list">
								{#each filteredContacts as c}
									<button
										type="button"
										class="dropdown-contact-item"
										on:click={() => selectContact(c)}
									>
										<div class="contact-item-name">
											{c.name || ''} {c.lastname || ''}
										</div>
										<div class="contact-item-phone">
											{formatDisplayPhone(c.telephon || '')}
										</div>
									</button>
								{/each}
							</div>
						{/if}

						{#if selectedContact}
							<div class="selected-contact-pill">
								<i class="fa-solid fa-circle-check check-ico"></i>
								<div class="pill-info">
									<strong>{selectedContact.name} {selectedContact.lastname || ''}</strong>
									<span>{formatDisplayPhone(selectedContact.telephon || '')}</span>
								</div>
								<button class="remove-pill-btn" on:click={clearContactSelection}>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Captura de Número Libre -->
					<div class="custom-phone-form">
						<div class="input-field">
							<label for="custom-name-field" class="picker-label">Nombre del cliente:</label>
							<input
								id="custom-name-field"
								type="text"
								bind:value={customName}
								placeholder="Ej. Roberto Martínez"
								class="picker-input"
							/>
						</div>

						<div class="input-field">
							<label for="custom-phone-field" class="picker-label">Teléfono (10 dígitos):</label>
							<input
								id="custom-phone-field"
								type="tel"
								bind:value={customPhone}
								placeholder="Ej. 614 275 4512"
								class="picker-input"
							/>
						</div>
					</div>
				{/if}

				<!-- Vista Previa del Mensaje Ligero de WhatsApp -->
				<div class="preview-box">
					<div class="preview-header">
						<span class="preview-title">
							<i class="fa-brands fa-whatsapp wa-preview-ico"></i>
							Mensaje que recibirá:
						</span>
						<button
							type="button"
							class="copy-msg-btn"
							on:click={copyFullWhatsAppMessage}
							title="Copiar texto completo"
						>
							<i class="fa-regular fa-copy"></i>
							Copiar
						</button>
					</div>

					<div class="msg-bubble">
						{generated.text}
					</div>
				</div>

				<!-- Botones de Acción Primarios -->
				<div class="action-buttons-stack">
					<button
						type="button"
						class="btn-wa-primary"
						on:click={handleSendWhatsApp}
						disabled={!activeClientPhone}
					>
						<i class="fa-brands fa-whatsapp wa-lg-ico"></i>
						<span>Enviar por WhatsApp</span>
					</button>

					<div class="action-secondary-row">
						<button
							type="button"
							class="btn-copy-url"
							on:click={copyProposalUrlOnly}
						>
							<i class="fa-solid fa-link"></i>
							<span>Copiar Link</span>
						</button>

						<a
							href={generated.proposalUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="btn-open-proposal"
						>
							<i class="fa-solid fa-arrow-up-right-from-square"></i>
							<span>Ver Propuesta</span>
						</a>
					</div>
				</div>
			</div>
		</aside>
	</div>
</div>

<style>
	.property-detail-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem 1rem;
		box-sizing: border-box;
	}

	.top-nav-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.btn-back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #38bdf8;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		background: rgba(12, 191, 246, 0.08);
		border: 1px solid rgba(12, 191, 246, 0.25);
		transition: background 0.15s ease;
	}

	.btn-back:hover {
		background: rgba(12, 191, 246, 0.2);
	}

	.top-badges-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge-op {
		background: #10b981;
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		padding: 0.3rem 0.75rem;
		border-radius: 6px;
	}

	.badge-op.rental {
		background: #0284c7;
	}

	.badge-code {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #e4e4e7;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.3rem 0.65rem;
		border-radius: 6px;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 420px;
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 960px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	.main-info-col {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.section-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.25rem;
		box-sizing: border-box;
	}

	/* Galería */
	.gallery-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.main-photo-frame {
		position: relative;
		width: 100%;
		height: 420px;
		background: #09090b;
	}

	@media (max-width: 640px) {
		.main-photo-frame {
			height: 240px;
		}
	}

	.main-photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.photo-counter-pill {
		position: absolute;
		bottom: 12px;
		right: 12px;
		background: rgba(0, 0, 0, 0.75);
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.3rem 0.65rem;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.thumbnails-track {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
		overflow-x: auto;
		background: #121215;
		scrollbar-width: thin;
	}

	.thumb-btn {
		width: 72px;
		height: 52px;
		flex-shrink: 0;
		border-radius: 6px;
		overflow: hidden;
		border: 2px solid transparent;
		background: #27272a;
		cursor: pointer;
		padding: 0;
		transition: border-color 0.15s ease, opacity 0.15s ease;
		opacity: 0.6;
	}

	.thumb-btn.active {
		border-color: #0cbff6;
		opacity: 1;
	}

	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Precios y Títulos */
	.price-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.price-val {
		font-size: 1.85rem;
		font-weight: 800;
		color: #4ade80;
		letter-spacing: -0.02em;
	}

	.rental-period {
		font-size: 1rem;
		color: #a1a1aa;
		font-weight: 500;
	}

	.type-pill {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.35);
		padding: 0.25rem 0.65rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.property-full-title {
		font-size: 1.35rem;
		font-weight: 800;
		color: #ffffff;
		line-height: 1.3;
		margin: 0 0 0.75rem 0;
	}

	.location-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #a1a1aa;
		font-size: 0.9rem;
	}

	.loc-pin {
		color: #0cbff6;
	}

	.section-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 1rem 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.title-ico {
		color: #0cbff6;
		font-size: 0.95rem;
	}

	/* Specs Grid */
	.specs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.75rem;
	}

	.spec-tile {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.spec-icon {
		font-size: 1.1rem;
		color: #0cbff6;
	}

	.spec-data {
		display: flex;
		flex-direction: column;
	}

	.spec-label {
		font-size: 0.7rem;
		color: #71717a;
		text-transform: uppercase;
		font-weight: 700;
	}

	.spec-value {
		font-size: 0.95rem;
		font-weight: 700;
		color: #ffffff;
	}

	.description-content {
		color: #d4d4d8;
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-line;
	}

	/* Captador */
	.captador-card {
		border-color: rgba(12, 191, 246, 0.2);
	}

	.captador-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.88rem;
	}

	.captador-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.captador-lbl {
		color: #71717a;
		font-weight: 600;
		min-width: 80px;
	}

	.captador-val {
		color: #ffffff;
		font-weight: 600;
	}

	.captador-wa-link {
		color: #4ade80;
		text-decoration: none;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* Columna Derecha / Sticky Card */
	.proposal-aside-col {
		position: sticky;
		top: 80px;
	}

	.proposal-card {
		background: #18181b;
		border: 1px solid rgba(12, 191, 246, 0.3);
		border-radius: 12px;
		padding: 1.25rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.proposal-card-header {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.proposal-badge-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.send-ico {
		color: #0cbff6;
		font-size: 0.85rem;
	}

	.proposal-tag {
		font-size: 0.72rem;
		font-weight: 800;
		color: #38bdf8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.proposal-heading {
		font-size: 1.15rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
	}

	.proposal-desc {
		font-size: 0.8rem;
		color: #a1a1aa;
		margin: 0;
		line-height: 1.4;
	}

	.target-type-selector {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		background: rgba(255, 255, 255, 0.04);
		padding: 0.25rem;
		border-radius: 8px;
	}

	.toggle-type-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.4rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition: all 0.15s ease;
	}

	.toggle-type-btn.active {
		background: #27272a;
		color: #ffffff;
		font-weight: 700;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.picker-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: #a1a1aa;
		margin-bottom: 0.35rem;
	}

	.picker-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.picker-ico {
		position: absolute;
		left: 0.75rem;
		color: #71717a;
		font-size: 0.85rem;
	}

	.picker-input {
		width: 100%;
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.6rem 2.2rem 0.6rem 2.2rem;
		color: #ffffff;
		font-size: 0.85rem;
		outline: none;
		box-sizing: border-box;
	}

	.picker-input:focus {
		border-color: #0cbff6;
	}

	.picker-clear-btn {
		position: absolute;
		right: 0.6rem;
		background: transparent;
		border: none;
		color: #71717a;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.contacts-dropdown-list {
		margin-top: 0.4rem;
		max-height: 160px;
		overflow-y: auto;
		background: #202024;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
	}

	.dropdown-contact-item {
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		padding: 0.5rem 0.75rem;
		text-align: left;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: background 0.15s ease;
	}

	.dropdown-contact-item:hover {
		background: rgba(12, 191, 246, 0.15);
	}

	.contact-item-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: #ffffff;
	}

	.contact-item-phone {
		font-size: 0.75rem;
		color: #a1a1aa;
	}

	.selected-contact-pill {
		margin-top: 0.5rem;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.35);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.check-ico {
		color: #10b981;
		font-size: 0.95rem;
	}

	.pill-info {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}

	.pill-info strong {
		font-size: 0.82rem;
		color: #ffffff;
	}

	.pill-info span {
		font-size: 0.75rem;
		color: #34d399;
	}

	.remove-pill-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.custom-phone-form {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.custom-phone-form .picker-input {
		padding-left: 0.75rem;
	}

	/* Vista Previa */
	.preview-box {
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.preview-title {
		font-size: 0.72rem;
		font-weight: 700;
		color: #a1a1aa;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.wa-preview-ico {
		color: #4ade80;
		font-size: 0.85rem;
	}

	.copy-msg-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #e4e4e7;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.copy-msg-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.msg-bubble {
		font-size: 0.78rem;
		color: #e4e4e7;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		background: rgba(16, 185, 129, 0.08);
		border-left: 2px solid #10b981;
		padding: 0.5rem 0.65rem;
		border-radius: 0 6px 6px 0;
	}

	/* Botones de Acción */
	.action-buttons-stack {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.btn-wa-primary {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-wa-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	.btn-wa-primary:not(:disabled):hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(16, 185, 129, 0.45);
	}

	.wa-lg-ico {
		font-size: 1.15rem;
	}

	.action-secondary-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.btn-copy-url,
	.btn-open-proposal {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.5rem 0.5rem;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.btn-copy-url:hover,
	.btn-open-proposal:hover {
		background: rgba(12, 191, 246, 0.15);
		border-color: #0cbff6;
		color: #ffffff;
	}
</style>
