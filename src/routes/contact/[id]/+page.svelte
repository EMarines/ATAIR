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
	import { formatDisplayPhone } from '$lib/functions/phoneUtils';
	import { getProposalUrl } from '$lib/functions/urlUtils';
	import { empresa } from '$lib/config/empresa';
	import type { Contact, Binnacle } from '$lib/types';

	function formatBudget(val: any): string {
		if (!val && val !== 0) return '';
		const str = String(val).trim();
		if (!str) return '';
		if (str.includes('$') || str.toLowerCase().includes('m')) return str;
		const num = Number(str.replace(/\D/g, ''));
		if (!isNaN(num) && num > 0) {
			return `$${num.toLocaleString('es-MX')}`;
		}
		return str;
	}

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

	// Estado de Perfilamiento Total (Etapa 2)
	let isEditingProfiling = false;
	let isSavingProfiling = false;
	let editMetodoPago = '';
	let editEstatusCredito = '';
	let editMontoAutorizado = '';
	let editEngancheDisponible = '';
	let editZonasInteres = '';
	let editRecamarasMin = 3;
	let editPlantasPreferencia = 'Indiferente';
	let editCocheraMin = 2;
	let editRequierePatio = true;
	let editUrgenciaCompra = '1 a 3 meses';
	let editSituacionActual = '';
	let editTomaDecision = 'Individual';

	// Estado de Chat Embebido de WhatsApp
	let chatMessage = '';
	let isSendingChat = false;

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

				// Perfilamiento Total (Etapa 2)
				metodoPago: d.metodoPago || '',
				estatusCredito: d.estatusCredito || '',
				montoAutorizado: d.montoAutorizado || '',
				engancheDisponible: d.engancheDisponible || '',
				zonasInteres: d.zonasInteres || '',
				recamarasMin: d.recamarasMin || 3,
				plantasPreferencia: d.plantasPreferencia || 'Indiferente',
				cocheraMin: d.cocheraMin || 2,
				requierePatio: d.requierePatio ?? true,
				urgenciaCompra: d.urgenciaCompra || '1 a 3 meses',
				situacionActual: d.situacionActual || '',
				tomaDecision: d.tomaDecision || 'Individual',

				createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : d.createdAt || Date.now()
			};

			// Verificación de aislamiento estricto de cartera
			if (!$isAdmin && cData.associate_id && currentUid && cData.associate_id !== currentUid) {
				unauthorized = true;
				loading = false;
				return;
			}

			contact = cData;

			// Inicializar formulario de perfilamiento
			editMetodoPago = cData.metodoPago || '';
			editEstatusCredito = cData.estatusCredito || '';
			editMontoAutorizado = cData.montoAutorizado ? String(cData.montoAutorizado) : '';
			editEngancheDisponible = cData.engancheDisponible ? String(cData.engancheDisponible) : '';
			editZonasInteres = cData.zonasInteres || '';
			editRecamarasMin = cData.recamarasMin || 3;
			editPlantasPreferencia = cData.plantasPreferencia || 'Indiferente';
			editCocheraMin = cData.cocheraMin || 2;
			editRequierePatio = cData.requierePatio ?? true;
			editUrgenciaCompra = cData.urgenciaCompra || '1 a 3 meses';
			editSituacionActual = cData.situacionActual || '';
			editTomaDecision = cData.tomaDecision || 'Individual';

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

	async function saveProfiling() {
		if (!contact || isSavingProfiling) return;
		isSavingProfiling = true;
		try {
			const docRef = doc(db, 'contacts', contact.id);
			const payload = {
				metodoPago: editMetodoPago,
				estatusCredito: editEstatusCredito,
				montoAutorizado: editMontoAutorizado ? Number(editMontoAutorizado) : '',
				engancheDisponible: editEngancheDisponible ? Number(editEngancheDisponible) : '',
				zonasInteres: editZonasInteres.trim(),
				recamarasMin: Number(editRecamarasMin) || 3,
				plantasPreferencia: editPlantasPreferencia,
				cocheraMin: Number(editCocheraMin) || 2,
				requierePatio: Boolean(editRequierePatio),
				urgenciaCompra: editUrgenciaCompra,
				situacionActual: editSituacionActual.trim(),
				tomaDecision: editTomaDecision,
				updatedAt: serverTimestamp()
			};
			await updateDoc(docRef, payload);

			// Actualizar estado reactivo local
			Object.assign(contact, payload);

			// Registrar en bitácora el avance a Etapa 2
			const asesorName = $userProfile?.name || $userProfile?.displayName || 'Asesor';
			await addDoc(collection(db, 'binnacles'), {
				contactId: contact.id,
				tipo: 'sistema',
				descripcion: `Perfilamiento Etapa 2 guardado: Recurso: ${editMetodoPago || 'N/A'}, Crédito: ${editEstatusCredito || 'N/A'}, Urgencia: ${editUrgenciaCompra}.`,
				fecha: serverTimestamp(),
				asesor: asesorName
			});

			notifications.success('Perfilamiento Etapa 2 guardado exitosamente.');
			isEditingProfiling = false;
		} catch (err: any) {
			console.error('[ContactDetail] Error guardando perfilamiento:', err);
			notifications.error('Error al guardar perfilamiento.');
		} finally {
			isSavingProfiling = false;
		}
	}

	async function sendWhatsAppChatMessage() {
		if (!contact || !chatMessage.trim() || isSendingChat) return;
		const cleanPhone = (contact.phoneRaw || contact.telephon || '').replace(/\D/g, '').slice(-10);
		if (!cleanPhone) {
			notifications.error('El contacto no tiene un teléfono válido.');
			return;
		}

		isSendingChat = true;
		const msgToSend = chatMessage.trim();
		const asesorName = $userProfile?.name || $userProfile?.displayName || 'Asociada Match Home';
		const asesorId = currentUid || '';

		try {
			const res = await fetch('/api/whatsapp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contactId: contact.id,
					to: cleanPhone,
					message: msgToSend,
					authorName: asesorName,
					authorId: asesorId
				})
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error || 'Error al enviar por WhatsApp');
			}

			chatMessage = '';
			notifications.success('Mensaje enviado por WhatsApp');
		} catch (err: any) {
			console.error('[WhatsApp Chat] Error:', err);
			notifications.error(err.message || 'Error al enviar mensaje');
		} finally {
			isSendingChat = false;
		}
	}

	function applyQuickTemplate(num: number) {
		const fName = contact?.name || 'Cliente';
		if (num === 1) {
			chatMessage = `Hola ${fName}, te comparto la información de la propiedad que consultaste. Quedo al pendiente para agendar tu visita.`;
		} else if (num === 2) {
			chatMessage = `Hola ${fName}, ¿qué día y horario te queda mejor para coordinar la muestra del inmueble?`;
		} else if (num === 3) {
			chatMessage = `Hola ${fName}, tenemos nuevas opciones en la zona que se ajustan a tu presupuesto. ¿Deseas que te comparta los detalles?`;
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
								<i class="fa-solid fa-phone"></i> Llamar ({formatDisplayPhone(cleanTel)})
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
								<span class="info-value text-highlight">{formatDisplayPhone(contact.phoneFormatted || contact.telephon)}</span>
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
										{formatBudget(contact.budgetTope || contact.presupuestoMax)}
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

					<!-- Tarjeta de Perfilamiento Total (Etapa 2 - Calificación) -->
					<div class="section-card profiling-card">
						<div class="card-header-flex">
							<h2 class="card-title">
								<i class="fa-solid fa-bullseye text-amber"></i> Perfilamiento & Calificación (Etapa 2)
							</h2>
							<button
								type="button"
								class="btn-edit-toggle"
								on:click={() => (isEditingProfiling = !isEditingProfiling)}
							>
								<i class="fa-solid {isEditingProfiling ? 'fa-xmark' : 'fa-pen-to-square'}"></i>
								{isEditingProfiling ? 'Cerrar' : 'Calificar'}
							</button>
						</div>

						{#if !isEditingProfiling}
							<div class="profiling-chips-grid">
								<div class="p-chip">
									<span class="p-label">Método Financiero:</span>
									<span class="p-val text-highlight">{contact.metodoPago || 'Por calificar'}</span>
								</div>
								<div class="p-chip">
									<span class="p-label">Estatus Crédito:</span>
									<span class="p-val {contact.estatusCredito === 'Autorizado' ? 'text-green' : 'text-amber'}">
										{contact.estatusCredito || 'Sin precalificar'}
									</span>
								</div>
								{#if contact.montoAutorizado}
									<div class="p-chip">
										<span class="p-label">Monto Aprobado:</span>
										<span class="p-val text-budget">{formatBudget(contact.montoAutorizado)}</span>
									</div>
								{/if}
								{#if contact.engancheDisponible}
									<div class="p-chip">
										<span class="p-label">Enganche Líquido:</span>
										<span class="p-val">{formatBudget(contact.engancheDisponible)}</span>
									</div>
								{/if}
								<div class="p-chip">
									<span class="p-label">Urgencia:</span>
									<span class="p-val">{contact.urgenciaCompra || '1 a 3 meses'}</span>
								</div>
								<div class="p-chip">
									<span class="p-label">Plantas:</span>
									<span class="p-val">{contact.plantasPreferencia || 'Indiferente'}</span>
								</div>
								<div class="p-chip">
									<span class="p-label">Recámaras mín.:</span>
									<span class="p-val">{contact.recamarasMin || 3} habs</span>
								</div>
								<div class="p-chip">
									<span class="p-label">Cochera / Patio:</span>
									<span class="p-val">
										{contact.cocheraMin || 2} autos / {contact.requierePatio ? 'Con patio' : 'Indiferente'}
									</span>
								</div>
							</div>

							{#if contact.zonasInteres}
								<div class="zones-box">
									<span class="zones-label"><i class="fa-solid fa-map-pin"></i> Zonas de Interés:</span>
									<p class="zones-val">{contact.zonasInteres}</p>
								</div>
							{/if}
							{#if contact.situacionActual}
								<div class="situation-box">
									<span class="situation-label"><i class="fa-solid fa-info-circle"></i> Situación Actual:</span>
									<p class="situation-val">{contact.situacionActual}</p>
								</div>
							{/if}
						{:else}
							<!-- Formulario de Edición de Perfilamiento -->
							<form on:submit|preventDefault={saveProfiling} class="profiling-edit-form">
								<div class="form-group-field">
									<label class="field-label">Método Financiero:</label>
									<div class="chips-selector">
										{#each ['Bancario', 'Infonavit', 'Cofinavit', 'Fovissste', 'Contado'] as opt}
											<button
												type="button"
												class="selector-chip"
												class:selected={editMetodoPago === opt}
												on:click={() => (editMetodoPago = opt)}
											>
												{opt}
											</button>
										{/each}
									</div>
								</div>

								<div class="form-group-field">
									<label class="field-label">Estatus de Crédito:</label>
									<div class="chips-selector">
										{#each ['Autorizado', 'En Trámite', 'Requiere Asesoría (Beto)', 'No Aplica'] as opt}
											<button
												type="button"
												class="selector-chip"
												class:selected={editEstatusCredito === opt}
												on:click={() => (editEstatusCredito = opt)}
											>
												{opt}
											</button>
										{/each}
									</div>
								</div>

								<div class="form-row-dual">
									<div class="field-col">
										<label class="field-label">Monto Aprobado / Presupuesto ($):</label>
										<input
											type="number"
											bind:value={editMontoAutorizado}
											placeholder="Ej. 2800000"
											class="field-input"
										/>
									</div>
									<div class="field-col">
										<label class="field-label">Enganche Líquido ($):</label>
										<input
											type="number"
											bind:value={editEngancheDisponible}
											placeholder="Ej. 300000"
											class="field-input"
										/>
									</div>
								</div>

								<div class="form-group-field">
									<label class="field-label">Urgencia de Compra:</label>
									<div class="chips-selector">
										{#each ['Inmediata (<30d)', '1 a 3 meses', '3 a 6 meses', 'Curioso'] as opt}
											<button
												type="button"
												class="selector-chip"
												class:selected={editUrgenciaCompra === opt}
												on:click={() => (editUrgenciaCompra = opt)}
											>
												{opt}
											</button>
										{/each}
									</div>
								</div>

								<div class="form-group-field">
									<label class="field-label">Plantas:</label>
									<div class="chips-selector">
										{#each ['1 Planta', '2 Plantas', 'Indiferente'] as opt}
											<button
												type="button"
												class="selector-chip"
												class:selected={editPlantasPreferencia === opt}
												on:click={() => (editPlantasPreferencia = opt)}
											>
												{opt}
											</button>
										{/each}
									</div>
								</div>

								<div class="form-row-dual">
									<div class="field-col">
										<label class="field-label">Recámaras mínimas:</label>
										<input
											type="number"
											bind:value={editRecamarasMin}
											min="1"
											max="8"
											class="field-input"
										/>
									</div>
									<div class="field-col">
										<label class="field-label">Cochera (autos):</label>
										<input
											type="number"
											bind:value={editCocheraMin}
											min="0"
											max="6"
											class="field-input"
										/>
									</div>
								</div>

								<div class="form-group-field">
									<label class="field-label">Zonas / Colonias de Interés:</label>
									<input
										type="text"
										bind:value={editZonasInteres}
										placeholder="Ej. San Felipe, Canteras, Reliz, C.P. 31203..."
										class="field-input"
									/>
								</div>

								<div class="form-group-field">
									<label class="field-label">Situación Actual (¿Renta, vende casa previa?):</label>
									<input
										type="text"
										bind:value={editSituacionActual}
										placeholder="Ej. Renta vence pronto, requiere mudarse rápido..."
										class="field-input"
									/>
								</div>

								<div class="btn-actions-row">
									<button
										type="submit"
										class="btn-save-profiling"
										disabled={isSavingProfiling}
									>
										{#if isSavingProfiling}
											<i class="fa-solid fa-spinner fa-spin"></i> Guardando...
										{:else}
											<i class="fa-solid fa-check"></i> Guardar Calificación
										{/if}
									</button>
									<button
										type="button"
										class="btn-cancel-profiling"
										on:click={() => (isEditingProfiling = false)}
									>
										Cancelar
									</button>
								</div>
							</form>
						{/if}
					</div>
				</section>

				<!-- Columna 2: Chat Embebido & Bitácora de Seguimiento -->
				<section class="card-column">
					<div class="section-card">
						<div class="card-header-flex">
							<h2 class="card-title">
								<i class="fa-brands fa-whatsapp text-green"></i> Chat de WhatsApp & Bitácora
							</h2>
							<span class="live-indicator">
								<span class="dot-online"></span> En Vivo
							</span>
						</div>

						<!-- Formulario de Notas / Eventos Internos -->
						<form on:submit|preventDefault={addBinnacleEntry} class="binnacle-form">
							<div class="binnacle-type-selector">
								<label class="type-radio" class:active={newBinnType === 'llamada'}>
									<input type="radio" bind:group={newBinnType} value="llamada" />
									<i class="fa-solid fa-phone"></i> Llamada
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
									placeholder="Registrar nota interna o llamada (ej. Le encantó la casa, agendamos muestra para el sábado)..."
									class="binnacle-textarea"
									disabled={isSavingBinnacle}
								></textarea>
							</div>

							<button type="submit" class="binnacle-submit-btn" disabled={isSavingBinnacle || !newBinnDesc.trim()}>
								{#if isSavingBinnacle}
									<i class="fa-solid fa-spinner fa-spin"></i> Guardando...
								{:else}
									<i class="fa-solid fa-note-sticky"></i> Guardar Evento Interno
								{/if}
							</button>
						</form>

						<!-- Lista Cronológica de Interacciones & Chat Embebido -->
						<div class="binnacles-timeline chat-stream">
							{#if binnacles.length === 0}
								<p class="empty-timeline">No hay mensajes de WhatsApp ni registros previos.</p>
							{:else}
								{#each binnacles as binn (binn.id || binn.fecha)}
									{#if binn.tipo === 'whatsapp'}
										<!-- Burbuja de Chat WhatsApp Embebido -->
										<div class="chat-bubble-row {binn.direction === 'inbound' ? 'chat-inbound' : 'chat-outbound'}">
											<div class="chat-bubble">
												<div class="chat-bubble-header">
													<span class="chat-sender">
														<i class="fa-brands fa-whatsapp"></i>
														{binn.direction === 'inbound' ? (contact.name || 'Cliente') : (binn.author || 'Asociada')}
													</span>
													<span class="chat-time">{formatDateTime(binn.fecha)}</span>
												</div>
												<p class="chat-text">{binn.descripcion || binn.messageText || binn.comment}</p>
												<div class="chat-footer-status">
													<i class="fa-solid fa-check-double text-blue"></i>
													<span class="chat-badge-mode">{binn.status === 'simulated' ? 'ATAIR Cloud' : 'WhatsApp'}</span>
												</div>
											</div>
										</div>
									{:else}
										<!-- Evento de Bitácora Estándar -->
										<div class="timeline-item">
											<div class="timeline-icon-wrap" class:icon-call={binn.tipo === 'llamada'} class:icon-visit={binn.tipo === 'visita'}>
												{#if binn.tipo === 'llamada'}
													<i class="fa-solid fa-phone"></i>
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
												{#if binn.asesor || binn.author}
													<span class="timeline-author"><i class="fa-solid fa-user"></i> {binn.asesor || binn.author}</span>
												{/if}
											</div>
										</div>
									{/if}
								{/each}
							{/if}
						</div>

						<!-- Barra de Envío Rápido de WhatsApp Embebido en ATAIR App -->
						<div class="embedded-chat-bar">
							<div class="chat-input-row">
								<textarea
									bind:value={chatMessage}
									rows="2"
									placeholder="Escribe para responder directo a su WhatsApp desde ATAIR..."
									class="chat-input-textarea"
									disabled={isSendingChat}
									on:keydown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											sendWhatsAppChatMessage();
										}
									}}
								></textarea>
								<button
									type="button"
									class="btn-send-whatsapp-embedded"
									on:click={sendWhatsAppChatMessage}
									disabled={isSendingChat || !chatMessage.trim()}
								>
									{#if isSendingChat}
										<i class="fa-solid fa-spinner fa-spin"></i>
									{:else}
										<i class="fa-solid fa-paper-plane"></i>
									{/if}
									<span>Enviar</span>
								</button>
							</div>

							<!-- Chips de Respuestas Rápidas -->
							<div class="quick-chips-wrapper">
								<span class="chips-helper">Plantillas rápidas:</span>
								<button type="button" class="quick-chip-btn" on:click={() => applyQuickTemplate(1)}>
									"Te comparto la info..."
								</button>
								<button type="button" class="quick-chip-btn" on:click={() => applyQuickTemplate(2)}>
									"¿Qué día visitas?"
								</button>
								<button type="button" class="quick-chip-btn" on:click={() => applyQuickTemplate(3)}>
									"Nuevas opciones..."
								</button>
							</div>
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

	/* --- Perfilamiento Total (Etapa 2) --- */
	.profiling-card {
		margin-top: 1.25rem;
		border-left: 3px solid #f59e0b;
	}

	.card-header-flex {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.btn-edit-toggle {
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.4);
		color: #fbbf24;
		font-size: 0.78rem;
		font-weight: 700;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.15s ease;
	}

	.btn-edit-toggle:hover {
		background: rgba(245, 158, 11, 0.25);
	}

	.profiling-chips-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.65rem;
	}

	.p-chip {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.5rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.p-label {
		font-size: 0.68rem;
		color: #71717a;
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.03em;
	}

	.p-val {
		font-size: 0.82rem;
		font-weight: 700;
		color: #e4e4e7;
	}

	.text-green { color: #10b981; }
	.text-amber { color: #f59e0b; }

	.zones-box, .situation-box {
		margin-top: 0.85rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px dashed rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
	}

	.zones-label, .situation-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #a1a1aa;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.zones-val, .situation-val {
		margin: 0.3rem 0 0 0;
		font-size: 0.82rem;
		color: #ffffff;
		line-height: 1.35;
	}

	/* Formulario de Edición Perfilamiento */
	.profiling-edit-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.form-group-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #a1a1aa;
	}

	.chips-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.selector-chip {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #d4d4d8;
		font-size: 0.76rem;
		padding: 0.35rem 0.7rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.selector-chip:hover {
		background: #3f3f46;
	}

	.selector-chip.selected {
		background: rgba(245, 158, 11, 0.2);
		border-color: #f59e0b;
		color: #fbbf24;
		font-weight: 700;
	}

	.form-row-dual {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.field-col {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.field-input {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		font-size: 0.82rem;
		padding: 0.5rem 0.65rem;
		border-radius: 6px;
		outline: none;
	}

	.field-input:focus {
		border-color: #0cbff6;
	}

	.btn-actions-row {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.btn-save-profiling {
		flex: 1;
		background: #f59e0b;
		color: #000000;
		font-weight: 800;
		font-size: 0.82rem;
		padding: 0.65rem 1rem;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition: background 0.15s ease;
	}

	.btn-save-profiling:hover:not(:disabled) {
		background: #d97706;
	}

	.btn-cancel-profiling {
		background: #27272a;
		color: #a1a1aa;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.65rem 1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		cursor: pointer;
	}

	/* --- Chat Embebido de WhatsApp & Timeline --- */
	.live-indicator {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #10b981;
	}

	.dot-online {
		width: 8px;
		height: 8px;
		background: #10b981;
		border-radius: 50%;
		box-shadow: 0 0 8px #10b981;
		animation: pulse-dot 1.5s infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.chat-stream {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 480px;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.chat-bubble-row {
		display: flex;
		width: 100%;
	}

	.chat-inbound {
		justify-content: flex-start;
	}

	.chat-outbound {
		justify-content: flex-end;
	}

	.chat-bubble {
		max-width: 82%;
		border-radius: 12px;
		padding: 0.65rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	}

	.chat-inbound .chat-bubble {
		background: #27272a;
		border-bottom-left-radius: 2px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.chat-outbound .chat-bubble {
		background: #005c4b;
		color: #ffffff;
		border-bottom-right-radius: 2px;
	}

	.chat-bubble-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.68rem;
		opacity: 0.85;
	}

	.chat-sender {
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.chat-text {
		margin: 0;
		font-size: 0.83rem;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.chat-footer-status {
		align-self: flex-end;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.68rem;
		opacity: 0.8;
	}

	.text-blue { color: #38bdf8; }

	.chat-badge-mode {
		font-size: 0.62rem;
		background: rgba(0, 0, 0, 0.3);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

	/* Barra de Chat Embebido */
	.embedded-chat-bar {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chat-input-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.chat-input-textarea {
		flex: 1;
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		font-size: 0.82rem;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		outline: none;
		resize: none;
		line-height: 1.35;
	}

	.chat-input-textarea:focus {
		border-color: #25d366;
	}

	.btn-send-whatsapp-embedded {
		background: #25d366;
		color: #000000;
		font-weight: 800;
		font-size: 0.8rem;
		padding: 0.65rem 0.95rem;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		height: 48px;
		transition: all 0.15s ease;
	}

	.btn-send-whatsapp-embedded:hover:not(:disabled) {
		background: #20ba59;
	}

	.btn-send-whatsapp-embedded:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.quick-chips-wrapper {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.chips-helper {
		font-size: 0.68rem;
		color: #71717a;
		font-weight: 600;
	}

	.quick-chip-btn {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.7rem;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.quick-chip-btn:hover {
		background: rgba(37, 211, 102, 0.15);
		color: #25d366;
		border-color: rgba(37, 211, 102, 0.3);
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
