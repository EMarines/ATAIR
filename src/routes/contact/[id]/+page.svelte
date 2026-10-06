<!-- src/routes/contact/[id]/+page.svelte -->
<!-- Detalle de Contacto, Gestión de Etapas y Bitácora con Aislamiento Estricto (Paso 2) -->
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { db } from '$lib/firebase/config';
	import {
		doc,
		getDoc,
		updateDoc,
		collection,
		query,
		where,
		orderBy,
		onSnapshot,
		addDoc,
		serverTimestamp,
		type Unsubscribe
	} from 'firebase/firestore';
	import { userProfile, userStore, isAdmin, isAsociado } from '$lib/firebase/authManager';
	import { notifications } from '$lib/stores/notificationStore';
	import { getContactBadgeInfo } from '$lib/functions/contactBadge';
	import { getProposalUrl } from '$lib/functions/urlUtils';
	import { empresa } from '$lib/config/empresa';
	import type { Contact, Binnacle } from '$lib/types';

	const contactId = $page.params.id;

	let contact: Contact | null = null;
	let binnacles: Binnacle[] = [];
	let loading = true;
	let unauthorized = false;
	let unsubscribeBinnacles: Unsubscribe | null = null;

	// Formulario de nueva entrada en bitácora
	let newBinnType: 'llamada' | 'whatsapp' | 'visita' | 'nota' = 'llamada';
	let newBinnDesc = '';
	let isSavingBinnacle = false;

	// Estado de edición de etapa
	let isUpdatingStage = false;

	$: currentUid = $userProfile?.uid || $userStore?.uid;
	$: badge = contact ? getContactBadgeInfo(contact) : null;
	$: isBuyer = !contact?.typeContact || contact.typeContact === 'Comprador';
	$: isTenant = contact?.typeContact === 'Arrendatario';

	onMount(async () => {
		await loadContact();
	});

	onDestroy(() => {
		if (unsubscribeBinnacles) unsubscribeBinnacles();
	});

	async function loadContact() {
		loading = true;
		unauthorized = false;

		try {
			const docRef = doc(db, 'contacts', contactId);
			const snap = await getDoc(docRef);

			if (!snap.exists()) {
				notifications.error('El contacto solicitado no existe.');
				goto('/contacts');
				return;
			}

			const d = snap.data();
			const cData: Contact = {
				id: snap.id,
				name: d.name || '',
				lastname: d.lastname || '',
				fullName: d.fullName || `${d.name || ''} ${d.lastname || ''}`.trim(),
				telephon: d.telephon || '',
				phoneRaw: d.phoneRaw || '',
				phoneFormatted: d.phoneFormatted || '',
				email: d.email || '',
				typeContact: d.typeContact || 'Comprador',
				contactStage: d.contactStage || 1,
				source: d.source || '',
				lonaCode: d.lonaCode || '',
				propertyInterestId: d.propertyInterestId || '',
				propertyTitle: d.propertyTitle || '',
				presupuestoMax: d.presupuestoMax || 0,
				budgetTope: d.budgetTope || '',
				comContact: d.comContact || '',
				notes: d.notes || '',
				associate_id: d.associate_id || '',
				associate_name: d.associate_name || '',
				city_id: d.city_id || '',
				procedencia: d.procedencia || '',
				createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : d.createdAt || Date.now()
			};

			// Verificación de aislamiento estricto de cartera
			if (!$isAdmin && cData.associate_id && currentUid && cData.associate_id !== currentUid) {
				unauthorized = true;
				loading = false;
				return;
			}

			contact = cData;
			loading = false;

			// Suscribir a la bitácora de seguimiento
			setupBinnaclesListener();
		} catch (err: any) {
			console.error('[ContactDetail] Error cargando contacto:', err);
			notifications.error('Error al cargar datos del contacto.');
			loading = false;
		}
	}

	function setupBinnaclesListener() {
		try {
			const binnCol = collection(db, 'binnacles');
			const q = query(binnCol, where('contactId', '==', contactId));

			unsubscribeBinnacles = onSnapshot(q, (snapshot) => {
				const list = snapshot.docs.map((doc) => {
					const d = doc.data();
					return {
						id: doc.id,
						contactId: d.contactId,
						tipo: d.tipo || 'nota',
						descripcion: d.descripcion || d.comment || d.action || '',
						asesor: d.asesor || d.author || '',
						fecha: d.fecha?.toMillis ? d.fecha.toMillis() : d.fecha || d.date || Date.now()
					} as Binnacle;
				});

				// Ordenar cronológicamente descendente
				binnacles = list.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
			});
		} catch (err) {
			console.error('[ContactDetail] Error en listener de bitácora:', err);
		}
	}

	async function changeStage(targetStage: number | string) {
		if (!contact || isUpdatingStage) return;

		isUpdatingStage = true;
		try {
			const docRef = doc(db, 'contacts', contact.id);
			await updateDoc(docRef, {
				contactStage: targetStage,
				updatedAt: serverTimestamp()
			});

			// Registrar en bitácora el avance de etapa
			const asesorName = $userProfile?.name || $userProfile?.displayName || 'Asesor';
			await addDoc(collection(db, 'binnacles'), {
				contactId: contact.id,
				tipo: 'sistema',
				descripcion: `Etapa actualizada a ${targetStage} por ${asesorName}.`,
				fecha: serverTimestamp(),
				asesor: asesorName
			});

			contact.contactStage = targetStage;
			notifications.success(`Etapa actualizada a ${targetStage}`);
		} catch (err: any) {
			console.error('[ContactDetail] Error cambiando etapa:', err);
			notifications.error('No se pudo actualizar la etapa.');
		} finally {
			isUpdatingStage = false;
		}
	}

	async function addBinnacleEntry() {
		if (!newBinnDesc.trim() || !contact) return;

		isSavingBinnacle = true;
		try {
			const asesorName = $userProfile?.name || $userProfile?.displayName || 'Asesor';
			await addDoc(collection(db, 'binnacles'), {
				contactId: contact.id,
				tipo: newBinnType,
				descripcion: newBinnDesc.trim(),
				fecha: serverTimestamp(),
				asesor: asesorName
			});

			newBinnDesc = '';
			notifications.success('Entrada guardada en bitácora.');
		} catch (err: any) {
			console.error('[ContactDetail] Error agregando bitácora:', err);
			notifications.error('Error guardando nota de seguimiento.');
		} finally {
			isSavingBinnacle = false;
		}
	}

	// Construir enlace de WhatsApp con formato ligero
	function getContactWhatsAppUrl(): string {
		if (!contact) return '';
		const cleanPhone = (contact.phoneRaw || contact.telephon || '').replace(/\D/g, '').slice(-10);
		if (!cleanPhone) return '';

		let propLink = '';
		if (contact.propertyInterestId || contact.lonaCode) {
			const code = contact.propertyInterestId || contact.lonaCode || '';
			propLink = getProposalUrl(code, {
				id: contact.id,
				name: contact.name,
				lastname: contact.lastname,
				telephon: cleanPhone
			});
		}

		const fName = contact.name || 'Cliente';
		let msg = `Hola ${fName}, gracias por contactarnos.\n\nTe envío la información de la propiedad que te interesó, quedo al pendiente para cuando desees conocerla.`;
		if (propLink) {
			msg += `\n\n${propLink}`;
		}

		return `https://wa.me/52${cleanPhone}?text=${encodeURIComponent(msg)}`;
	}

	function formatDateTime(val: any): string {
		if (!val) return '';
		const d = new Date(val);
		return d.toLocaleDateString('es-MX', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>{contact ? `${contact.fullName} | Detalle de Contacto` : 'Detalle de Contacto'} | ATAIR CRM</title>
</svelte:head>

<div class="contact-detail-page">
	<div class="container">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Cargando información del prospecto...</p>
			</div>
		{:else if unauthorized}
			<div class="unauthorized-card">
				<div class="unauth-icon">
					<i class="fa-solid fa-lock"></i>
				</div>
				<h2>Aislamiento de Cartera Activo</h2>
				<p>Este prospecto se encuentra indexado y protegido bajo la autoría de otro asesor comercial.</p>
				<a href="/contacts" class="btn-return">
					<i class="fa-solid fa-arrow-left"></i> Volver a Mi Cartera
				</a>
			</div>
		{:else if contact}
			<!-- Barra de Navegación Superior -->
			<div class="top-nav-row">
				<a href="/contacts" class="back-link">
					<i class="fa-solid fa-arrow-left"></i> Volver a Cartera
				</a>

				<div class="top-badges">
					{#if contact.city_id}
						<span class="city-badge"><i class="fa-solid fa-location-dot"></i> {contact.city_id.toUpperCase()}</span>
					{/if}
					{#if badge}
						<span
							class="badge-indicator"
							style="background-color: {badge.color}; border-radius: {badge.shape === 'square' ? '4px' : '50%'};"
						>
							{badge.text}
						</span>
					{/if}
				</div>
			</div>

			<!-- Encabezado Principal del Lead -->
			<header class="contact-hero">
				<div class="hero-main">
					<div class="name-block">
						<h1 class="hero-name">{contact.fullName}</h1>
						<span class="type-tag">{contact.typeContact || 'Comprador'}</span>
					</div>

					<div class="hero-actions">
						{#if contact.phoneRaw || contact.telephon}
							{@const cleanTel = (contact.phoneRaw || contact.telephon).replace(/\D/g, '').slice(-10)}
							<a href="tel:+52{cleanTel}" class="hero-btn call-hero-btn">
								<i class="fa-solid fa-phone"></i> Llamar (+52 {cleanTel})
							</a>
							<a
								href={getContactWhatsAppUrl()}
								target="_blank"
								rel="noopener noreferrer"
								class="hero-btn wa-hero-btn"
							>
								<i class="fa-brands fa-whatsapp"></i> WhatsApp Propuesta
							</a>
						{/if}
					</div>
				</div>

				<!-- Barra Interactiva de Pipeline / Etapas -->
				<div class="pipeline-tracker">
					<span class="tracker-title">
						<i class="fa-solid fa-layer-group"></i> Progresión de Etapa:
					</span>

					<div class="stages-pills-row">
						{#if isBuyer}
							<!-- Etapas Comprador (E1 - E5) -->
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage) === '1' || String(contact.contactStage).includes('E1')}
								on:click={() => changeStage(1)}
								disabled={isUpdatingStage}
							>
								1. E1 Contacto
							</button>
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage) === '2' || String(contact.contactStage).includes('E2')}
								on:click={() => changeStage(2)}
								disabled={isUpdatingStage}
							>
								2. E2 Calificación
							</button>
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage) === '3' || String(contact.contactStage).includes('E3')}
								on:click={() => changeStage(3)}
								disabled={isUpdatingStage}
							>
								3. E3 Muestra
							</button>
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage) === '4' || String(contact.contactStage).includes('E4')}
								on:click={() => changeStage(4)}
								disabled={isUpdatingStage}
							>
								4. E4 Cierre
							</button>
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage) === '5' || String(contact.contactStage).includes('E5')}
								on:click={() => changeStage(5)}
								disabled={isUpdatingStage}
							>
								5. E5 Concluido
							</button>
						{:else if isTenant}
							<!-- Etapas Renta (A1 - A2) -->
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage).includes('A1') || String(contact.contactStage) === '1'}
								on:click={() => changeStage('A1')}
								disabled={isUpdatingStage}
							>
								A1. Primer Contacto
							</button>
							<button
								type="button"
								class="stage-pill"
								class:active={String(contact.contactStage).includes('A2') || String(contact.contactStage) === '4'}
								on:click={() => changeStage('A2')}
								disabled={isUpdatingStage}
							>
								A2. Búsqueda Sinergias
							</button>
						{:else}
							<!-- Sinergias / Agentes -->
							<button type="button" class="stage-pill active" disabled>
								{contact.procedencia || 'Sinergia'}
							</button>
						{/if}
					</div>
				</div>
			</header>

			<!-- Contenido en 2 Columnas: Datos del Lead y Bitácora de Seguimiento -->
			<div class="content-grid">
				<!-- Columna 1: Ficha del Lead -->
				<section class="card-column">
					<div class="section-card">
						<h2 class="card-title"><i class="fa-solid fa-circle-info"></i> Datos del Prospecto</h2>

						<div class="info-list">
							<div class="info-item">
								<span class="info-label">Teléfono:</span>
								<span class="info-value text-highlight">{contact.phoneFormatted || contact.telephon}</span>
							</div>

							{#if contact.email}
								<div class="info-item">
									<span class="info-label">Correo:</span>
									<span class="info-value">{contact.email}</span>
								</div>
							{/if}

							<div class="info-item">
								<span class="info-label">Inmueble / Lona:</span>
								<span class="info-value">{contact.propertyTitle || contact.lonaCode || 'Lona General'}</span>
							</div>

							{#if contact.budgetTope || contact.presupuestoMax}
								<div class="info-item">
									<span class="info-label">Presupuesto Tope:</span>
									<span class="info-value text-budget">
										{contact.budgetTope || `$${Number(contact.presupuestoMax).toLocaleString('es-MX')}`}
									</span>
								</div>
							{/if}

							<div class="info-item">
								<span class="info-label">Origen / Canal:</span>
								<span class="info-value">{contact.source === 'lona_llamada' ? 'Llamada de Lona' : contact.source || 'Directo'}</span>
							</div>

							{#if contact.associate_name}
								<div class="info-item">
									<span class="info-label">Asesor Asignado:</span>
									<span class="info-value">{contact.associate_name}</span>
								</div>
							{/if}

							<div class="info-item">
								<span class="info-label">Fecha de Ingesta:</span>
								<span class="info-value">{formatDateTime(contact.createdAt)}</span>
							</div>
						</div>

						{#if contact.comContact || contact.notes}
							<div class="notes-box">
								<span class="notes-title"><i class="fa-solid fa-comment-dots"></i> Notas Iniciales:</span>
								<p class="notes-text">{contact.comContact || contact.notes}</p>
							</div>
						{/if}
					</div>
				</section>

				<!-- Columna 2: Bitácora de Seguimiento -->
				<section class="card-column">
					<div class="section-card">
						<h2 class="card-title"><i class="fa-solid fa-clipboard-list"></i> Bitácora de Seguimiento</h2>

						<!-- Formulario de Nueva Interacción -->
						<form on:submit|preventDefault={addBinnacleEntry} class="binnacle-form">
							<div class="binnacle-type-selector">
								<label class="type-radio" class:active={newBinnType === 'llamada'}>
									<input type="radio" bind:group={newBinnType} value="llamada" />
									<i class="fa-solid fa-phone"></i> Llamada
								</label>
								<label class="type-radio" class:active={newBinnType === 'whatsapp'}>
									<input type="radio" bind:group={newBinnType} value="whatsapp" />
									<i class="fa-brands fa-whatsapp"></i> WhatsApp
								</label>
								<label class="type-radio" class:active={newBinnType === 'visita'}>
									<input type="radio" bind:group={newBinnType} value="visita" />
									<i class="fa-solid fa-house-user"></i> Visita
								</label>
								<label class="type-radio" class:active={newBinnType === 'nota'}>
									<input type="radio" bind:group={newBinnType} value="nota" />
									<i class="fa-solid fa-note-sticky"></i> Nota
								</label>
							</div>

							<div class="form-row">
								<textarea
									bind:value={newBinnDesc}
									rows="2"
									placeholder="Añadir nota de seguimiento (ej. Le gustó la propiedad, agendamos cita para el sábado a las 11 AM)..."
									class="binnacle-textarea"
									disabled={isSavingBinnacle}
								></textarea>
							</div>

							<button type="submit" class="binnacle-submit-btn" disabled={isSavingBinnacle || !newBinnDesc.trim()}>
								{#if isSavingBinnacle}
									<i class="fa-solid fa-spinner fa-spin"></i> Guardando...
								{:else}
									<i class="fa-solid fa-paper-plane"></i> Registrar en Bitácora
								{/if}
							</button>
						</form>

						<!-- Lista Cronológica de Interacciones -->
						<div class="binnacles-timeline">
							{#if binnacles.length === 0}
								<p class="empty-timeline">No hay registros de seguimiento adicionales aún.</p>
							{:else}
								{#each binnacles as binn (binn.id || binn.fecha)}
									<div class="timeline-item">
										<div class="timeline-icon-wrap" class:icon-call={binn.tipo === 'llamada'} class:icon-wa={binn.tipo === 'whatsapp'} class:icon-visit={binn.tipo === 'visita'}>
											{#if binn.tipo === 'llamada'}
												<i class="fa-solid fa-phone"></i>
											{:else if binn.tipo === 'whatsapp'}
												<i class="fa-brands fa-whatsapp"></i>
											{:else if binn.tipo === 'visita'}
												<i class="fa-solid fa-house-user"></i>
											{:else if binn.tipo === 'sistema'}
												<i class="fa-solid fa-gear"></i>
											{:else}
												<i class="fa-solid fa-note-sticky"></i>
											{/if}
										</div>

										<div class="timeline-content">
											<div class="timeline-meta">
												<span class="timeline-type">{binn.tipo?.toUpperCase() || 'NOTA'}</span>
												<span class="timeline-date">{formatDateTime(binn.fecha)}</span>
											</div>
											<p class="timeline-desc">{binn.descripcion}</p>
											{#if binn.asesor}
												<span class="timeline-author"><i class="fa-solid fa-user"></i> {binn.asesor}</span>
											{/if}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</section>
			</div>
		{/if}
	</div>
</div>

<style>
	.contact-detail-page {
		min-height: calc(100vh - 120px);
		background-color: #09090b;
		padding: 1.5rem 1rem 3rem 1rem;
	}

	.container {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.top-nav-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.back-link {
		color: #a1a1aa;
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		transition: color 0.15s ease;
	}

	.back-link:hover {
		color: #0cbff6;
	}

	.top-badges {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.city-badge {
		font-size: 0.75rem;
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.3);
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
		font-weight: 700;
	}

	.badge-indicator {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 800;
		font-size: 0.8rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		border: 1.5px solid rgba(255, 255, 255, 0.9);
	}

	/* Hero Principal */
	.contact-hero {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.hero-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.name-block {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.hero-name {
		font-size: 1.6rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
	}

	.type-tag {
		align-self: flex-start;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.3);
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.hero-btn {
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 700;
		padding: 0.65rem 1rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		transition: transform 0.15s ease;
	}

	.hero-btn:hover {
		transform: translateY(-2px);
	}

	.call-hero-btn {
		background: #27272a;
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.wa-hero-btn {
		background: #22c55e;
		color: #000000;
		box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
	}

	/* Tracker de Etapas */
	.pipeline-tracker {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding-top: 1rem;
	}

	.tracker-title {
		font-size: 0.78rem;
		color: #a1a1aa;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.stages-pills-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.stage-pill {
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #a1a1aa;
		padding: 0.45rem 0.85rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.stage-pill:hover:not(:disabled) {
		border-color: #0cbff6;
		color: #ffffff;
	}

	.stage-pill.active {
		background: #0cbff6;
		color: #000000;
		border-color: #0cbff6;
		font-weight: 800;
		box-shadow: 0 2px 10px rgba(12, 191, 246, 0.3);
	}

	/* Columnas de Contenido */
	.content-grid {
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		gap: 1.25rem;
	}

	.section-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		padding-bottom: 0.75rem;
	}

	.info-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
		border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
		padding-bottom: 0.4rem;
	}

	.info-label {
		color: #71717a;
	}

	.info-value {
		color: #e4e4e7;
		font-weight: 600;
		text-align: right;
	}

	.text-highlight {
		color: #38bdf8;
	}

	.text-budget {
		color: #4ade80;
	}

	.notes-box {
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.notes-title {
		font-size: 0.72rem;
		color: #a1a1aa;
		font-weight: 700;
		text-transform: uppercase;
	}

	.notes-text {
		font-size: 0.82rem;
		color: #d4d4d8;
		margin: 0;
		line-height: 1.4;
	}

	/* Formulario Bitácora */
	.binnacle-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: #09090b;
		padding: 0.85rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.binnacle-type-selector {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.type-radio {
		font-size: 0.75rem;
		font-weight: 600;
		color: #a1a1aa;
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.type-radio input {
		display: none;
	}

	.type-radio.active {
		background: rgba(12, 191, 246, 0.15);
		border-color: #0cbff6;
		color: #38bdf8;
	}

	.binnacle-textarea {
		width: 100%;
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		color: #ffffff;
		padding: 0.6rem;
		font-size: 0.85rem;
		resize: vertical;
		box-sizing: border-box;
	}

	.binnacle-textarea:focus {
		outline: none;
		border-color: #0cbff6;
	}

	.binnacle-submit-btn {
		align-self: flex-end;
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		padding: 0.5rem 0.9rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.binnacle-submit-btn:hover:not(:disabled) {
		background: #0cbff6;
		color: #000000;
		border-color: #0cbff6;
	}

	.binnacle-submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Timeline de Bitácoras */
	.binnacles-timeline {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-height: 480px;
		overflow-y: auto;
		padding-right: 0.3rem;
	}

	.empty-timeline {
		font-size: 0.82rem;
		color: #71717a;
		text-align: center;
		padding: 1.5rem 0;
	}

	.timeline-item {
		display: flex;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.timeline-icon-wrap {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #27272a;
		color: #a1a1aa;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.timeline-icon-wrap.icon-call {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}

	.timeline-icon-wrap.icon-wa {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
	}

	.timeline-icon-wrap.icon-visit {
		background: rgba(234, 179, 8, 0.2);
		color: #facc15;
	}

	.timeline-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-grow: 1;
	}

	.timeline-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
	}

	.timeline-type {
		font-weight: 700;
		color: #0cbff6;
	}

	.timeline-date {
		color: #71717a;
	}

	.timeline-desc {
		font-size: 0.82rem;
		color: #d4d4d8;
		margin: 0;
		line-height: 1.4;
	}

	.timeline-author {
		font-size: 0.7rem;
		color: #71717a;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	/* Estados de Carga y Acceso Denegado */
	.loading-state,
	.unauthorized-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 1rem;
		text-align: center;
		gap: 1rem;
	}

	.unauth-icon {
		width: 64px;
		height: 64px;
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.8rem;
	}

	.unauthorized-card h2 {
		color: #ffffff;
		margin: 0;
	}

	.unauthorized-card p {
		color: #a1a1aa;
		max-width: 420px;
		margin: 0;
		font-size: 0.9rem;
	}

	.btn-return {
		margin-top: 0.5rem;
		background: #27272a;
		color: #ffffff;
		padding: 0.65rem 1.2rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: #0cbff6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		.content-grid {
			grid-template-columns: 1fr;
		}

		.hero-actions {
			width: 100%;
		}

		.hero-btn {
			flex: 1;
			justify-content: center;
		}
	}
</style>
