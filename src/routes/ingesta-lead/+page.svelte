<!-- src/routes/ingesta-lead/+page.svelte -->
<!-- PWA Ligera Mobile-First: Ingesta Inmediata de Leads por Llamadas de Lonas -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore, userProfile } from '$lib/firebase/authManager';
	import { db } from '$lib/firebase/config';
	import {
		collection,
		addDoc,
		getDocs,
		query,
		limit,
		serverTimestamp
	} from 'firebase/firestore';
	import { notifications } from '$lib/stores/notificationStore';
	import { empresa } from '$lib/config/empresa';

	// Estado del formulario
	let leadName = '';
	let leadPhone = '';
	let interestType: 'Comprador' | 'Arrendatario' = 'Comprador';
	let selectedProperty = '';
	let lonaCustomCode = '';
	let notes = '';
	let budgetRange = '';

	// Estado UI
	let isSubmitting = false;
	let savedSuccess = false;
	let createdLeadId = '';
	let whatsappUrl = '';

	// Lista de propiedades para selector rápido
	interface PropItem {
		id: string;
		title: string;
		code: string;
		colonia: string;
	}
	let propertiesList: PropItem[] = [];
	let loadingProps = true;

	onMount(async () => {
		try {
			const propsQuery = query(collection(db, 'properties'), limit(40));
			const snapshot = await getDocs(propsQuery);
			propertiesList = snapshot.docs.map((doc) => {
				const d = doc.data();
				return {
					id: doc.id,
					title: d.titulo || d.title || 'Propiedad sin título',
					code: d.clavePropiedad || d.easybroker_id || doc.id.substring(0, 6),
					colonia: d.colonia || ''
				};
			});
		} catch (err) {
			console.warn('[IngestaLead] No se pudieron cargar propiedades previas:', err);
		} finally {
			loadingProps = false;
		}
	});

	// Formatear teléfono a 10 dígitos limpios
	function cleanPhoneNumber(raw: string): string {
		const digits = raw.replace(/\D/g, '');
		// Si incluye 52 al inicio y tiene 12 dígitos, extraer los 10
		if (digits.length === 12 && digits.startsWith('52')) {
			return digits.substring(2);
		}
		return digits.slice(-10);
	}

	async function handleSubmit() {
		const cleanPhone = cleanPhoneNumber(leadPhone);
		if (!leadName.trim()) {
			notifications.warning('Por favor escribe el nombre del prospecto.');
			return;
		}
		if (cleanPhone.length < 10) {
			notifications.warning('El teléfono debe tener al menos 10 dígitos.');
			return;
		}

		try {
			isSubmitting = true;

			const asesorUid = $userProfile?.uid || $userStore?.uid || 'anonimo';
			const asesorName = $userProfile?.name || $userProfile?.displayName || empresa.agentName;
			const cityId = $userProfile?.city_id || 'cuu';

			// Título del inmueble de interés
			let finalPropertyInterest = lonaCustomCode.trim();
			let selectedPropertyObj: PropItem | undefined;
			if (selectedProperty) {
				selectedPropertyObj = propertiesList.find((p) => p.id === selectedProperty);
				if (selectedPropertyObj) {
					finalPropertyInterest = `${selectedPropertyObj.title} (${selectedPropertyObj.code})`;
				}
			}

			// 1. Guardar contacto en Firestore
			const contactPayload = {
				name: leadName.trim(),
				lastname: '',
				telephon: `+52${cleanPhone}`,
				phoneRaw: cleanPhone,
				typeContact: interestType,
				contactStage: 1, // E1 - Primer Contacto
				source: 'lona_llamada',
				lonaCode: lonaCustomCode.trim() || selectedPropertyObj?.code || 'LONA-GENERAL',
				propertyInterestId: selectedProperty || '',
				propertyTitle: finalPropertyInterest,
				budgetRange: budgetRange,
				comContact: notes.trim(),
				associate_id: asesorUid,
				associate_name: asesorName,
				city_id: cityId,
				isActive: true,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp()
			};

			const contactRef = await addDoc(collection(db, 'contacts'), contactPayload);
			createdLeadId = contactRef.id;

			// 2. Registrar en bitácora de seguimiento
			await addDoc(collection(db, 'binnacles'), {
				contactId: contactRef.id,
				tipo: 'llamada',
				descripcion: `Llamada entrante por lona: ${finalPropertyInterest || 'Interés general'}. Captada por ${asesorName}.`,
				fecha: serverTimestamp(),
				asesor: asesorName
			});

			// 3. Generar enlace de WhatsApp con saludo cordial pre-redactado
			const greeting = `Hola ${leadName.trim()}, mucho gusto. Te saluda ${asesorName} de ${empresa.companyName}. Recibí tu llamada sobre ${finalPropertyInterest ? 'la propiedad ' + finalPropertyInterest : 'la propiedad en lona'}. Con gusto te comparto los detalles y fotos. ¿A qué hora te quedaría bien que lo platiquemos?`;
			whatsappUrl = `https://wa.me/52${cleanPhone}?text=${encodeURIComponent(greeting)}`;

			savedSuccess = true;
			notifications.success('¡Lead registrado y protegido bajo tu autoría!');
		} catch (err: any) {
			console.error('Error al registrar lead:', err);
			notifications.error(`Error guardando lead: ${err.message || 'Intenta de nuevo'}`);
		} finally {
			isSubmitting = false;
		}
	}

	function resetForNextLead() {
		leadName = '';
		leadPhone = '';
		notes = '';
		lonaCustomCode = '';
		selectedProperty = '';
		budgetRange = '';
		savedSuccess = false;
		createdLeadId = '';
		whatsappUrl = '';
	}
</script>

<svelte:head>
	<title>⚡ Captar Lead Móvil | ATAIR CRM</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
</svelte:head>

<div class="mobile-ingesta-wrapper">
	<div class="mobile-container">
		<!-- Cabecera Compacta -->
		<header class="mobile-header">
			<div class="header-top">
				<a href="/" class="back-link">
					<i class="fa-solid fa-arrow-left"></i>
				</a>
				<div class="brand-pill">
					<i class="fa-solid fa-bolt"></i> INGESTA RÁPIDA
				</div>
				<span class="user-chip">
					{$userProfile?.displayName || $userProfile?.name || 'Asociada'}
				</span>
			</div>
			<h1>Captura de Llamada de Lona</h1>
			<p class="header-sub">
				Registra el prospecto en 15 segundos para asegurar tu autoría comercial (SLA &lt;24h).
			</p>
		</header>

		{#if !savedSuccess}
			<!-- FORMULARIO DE INGESTA RÁPIDA -->
			<form on:submit|preventDefault={handleSubmit} class="ingesta-form">
				<!-- Nombre del Prospecto -->
				<div class="field-card">
					<label for="leadName">
						<i class="fa-solid fa-user input-icon"></i> Nombre del Cliente *
					</label>
					<input
						id="leadName"
						type="text"
						bind:value={leadName}
						placeholder="Ej. Roberto Garza"
						required
						autocomplete="off"
						disabled={isSubmitting}
					/>
				</div>

				<!-- Teléfono Móvil -->
				<div class="field-card">
					<label for="leadPhone">
						<i class="fa-brands fa-whatsapp input-icon wa-color"></i> WhatsApp / Teléfono *
					</label>
					<div class="phone-input-row">
						<span class="phone-prefix">+52</span>
						<input
							id="leadPhone"
							type="tel"
							bind:value={leadPhone}
							placeholder="614 123 4567"
							required
							inputmode="numeric"
							disabled={isSubmitting}
						/>
					</div>
					<span class="hint-text">10 dígitos sin espacios ni guiones</span>
				</div>

				<!-- Tipo de Interés (Toggle Comprar / Rentar) -->
				<div class="field-card">
					<span class="field-label">Interés del Cliente</span>
					<div class="toggle-pills">
						<button
							type="button"
							class="pill-btn"
							class:active={interestType === 'Comprador'}
							on:click={() => (interestType = 'Comprador')}
						>
							<i class="fa-solid fa-house"></i> Comprar
						</button>
						<button
							type="button"
							class="pill-btn"
							class:active={interestType === 'Arrendatario'}
							on:click={() => (interestType = 'Arrendatario')}
						>
							<i class="fa-solid fa-key"></i> Rentar
						</button>
					</div>
				</div>

				<!-- Propiedad o Lona de Interés -->
				<div class="field-card">
					<label for="propertySelect">
						<i class="fa-solid fa-sign-hanging input-icon"></i> Inmueble / Lona
					</label>
					<select id="propertySelect" bind:value={selectedProperty} disabled={isSubmitting}>
						<option value="">-- Seleccionar de catálogo o ingresar manual --</option>
						{#each propertiesList as prop}
							<option value={prop.id}>
								{prop.code} - {prop.title} {prop.colonia ? `(${prop.colonia})` : ''}
							</option>
						{/each}
					</select>

					<div class="custom-lona-row">
						<input
							type="text"
							bind:value={lonaCustomCode}
							placeholder="O escribe lona/dirección manual (ej. LONA-04 Canteras)"
							disabled={isSubmitting}
						/>
					</div>
				</div>

				<!-- Rango Presupuestal Rápido (Chips) -->
				<div class="field-card">
					<span class="field-label">Presupuesto Aproximado (Opcional)</span>
					<div class="budget-chips">
						{#each ['< $2M', '$2M - $3.5M', '$3.5M - $5M', '> $5M'] as b}
							<button
								type="button"
								class="chip-btn"
								class:selected={budgetRange === b}
								on:click={() => (budgetRange = budgetRange === b ? '' : b)}
							>
								{b}
							</button>
						{/each}
					</div>
				</div>

				<!-- Notas Rápidas -->
				<div class="field-card">
					<label for="notes">
						<i class="fa-solid fa-note-sticky input-icon"></i> Notas Clave de la Llamada
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows="2"
						placeholder="Ej. Busca 3 recámaras, crédito bancario listo, puede verla el fin de semana."
						disabled={isSubmitting}
					></textarea>
				</div>

				<!-- Botón Gigante de Guardado -->
				<button type="submit" class="submit-giant-btn" disabled={isSubmitting}>
					{#if isSubmitting}
						<div class="spinner-small"></div>
						<span>Guardando Lead...</span>
					{:else}
						<i class="fa-solid fa-shield-check"></i>
						<span>⚡ Guardar y Proteger Lead</span>
					{/if}
				</button>
			</form>
		{:else}
			<!-- PANTALLA DE ÉXITO Y DISPARO DE WHATSAPP -->
			<div class="success-card">
				<div class="success-icon-wrap">
					<i class="fa-solid fa-circle-check"></i>
				</div>
				<h2>¡Lead Blindado con Éxito!</h2>
				<p class="lead-summary">
					<strong>{leadName}</strong> (+52 {cleanPhoneNumber(leadPhone)}) ha quedado indexado a tu nombre.
				</p>

				<!-- Botón Primario: WhatsApp Inmediato -->
				<a
					href={whatsappUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="whatsapp-giant-btn"
				>
					<i class="fa-brands fa-whatsapp"></i>
					<span>💬 Enviar WhatsApp al Cliente</span>
				</a>
				<p class="wa-helper-text">
					Abre WhatsApp con el mensaje de presentación de Match Home precargado listo para enviar.
				</p>

				<!-- Acciones Secundarias -->
				<div class="success-actions">
					<button type="button" class="action-btn-secondary" on:click={resetForNextLead}>
						<i class="fa-solid fa-plus"></i> Capturar Otra Llamada
					</button>
					<a href="/contacts" class="action-btn-outline">
						<i class="fa-solid fa-address-book"></i> Ver en Cartera
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.mobile-ingesta-wrapper {
		min-height: calc(100vh - 120px);
		background-color: #09090b;
		padding: 1rem 0.75rem 3rem 0.75rem;
		display: flex;
		justify-content: center;
	}

	.mobile-container {
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Cabecera */
	.mobile-header {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.back-link {
		color: #a1a1aa;
		font-size: 1.1rem;
		padding: 0.35rem 0.6rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		text-decoration: none;
	}

	.brand-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.35);
		padding: 0.2rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.user-chip {
		font-size: 0.75rem;
		color: #71717a;
		background: #18181b;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.mobile-header h1 {
		font-size: 1.45rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
	}

	.header-sub {
		font-size: 0.8rem;
		color: #a1a1aa;
		margin: 0;
		line-height: 1.35;
	}

	/* Formulario */
	.ingesta-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.field-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	label,
	.field-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: #e4e4e7;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.input-icon {
		font-size: 0.85rem;
		color: #0cbff6;
	}

	.wa-color {
		color: #22c55e !important;
	}

	input[type="text"],
	input[type="tel"],
	select,
	textarea {
		width: 100%;
		padding: 0.8rem 0.9rem;
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 8px;
		color: #ffffff;
		font-size: 16px; /* Previene auto-zoom en iOS Safari */
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		box-sizing: border-box;
	}

	input:focus,
	select:focus,
	textarea:focus {
		border-color: #0cbff6;
		box-shadow: 0 0 0 2px rgba(12, 191, 246, 0.25);
	}

	.phone-input-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.phone-prefix {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: #a1a1aa;
		padding: 0.8rem 0.75rem;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.hint-text {
		font-size: 0.7rem;
		color: #71717a;
	}

	/* Toggle Pills (Comprar vs Rentar) */
	.toggle-pills {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.pill-btn {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #a1a1aa;
		padding: 0.65rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition: all 0.2s;
	}

	.pill-btn.active {
		background: rgba(12, 191, 246, 0.2);
		border-color: #0cbff6;
		color: #38bdf8;
	}

	.custom-lona-row {
		margin-top: 0.35rem;
	}

	/* Chips de presupuesto */
	.budget-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip-btn {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.75rem;
		padding: 0.35rem 0.65rem;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.chip-btn.selected {
		background: rgba(16, 185, 129, 0.2);
		border-color: #10b981;
		color: #34d399;
		font-weight: 600;
	}

	textarea {
		resize: none;
	}

	/* Botón Gigante de Envío */
	.submit-giant-btn {
		margin-top: 0.5rem;
		width: 100%;
		padding: 1rem;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: 1px solid rgba(52, 211, 153, 0.4);
		border-radius: 10px;
		color: #ffffff;
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.submit-giant-btn:active {
		transform: scale(0.98);
	}

	.submit-giant-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner-small {
		width: 20px;
		height: 20px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-left-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Pantalla de Éxito */
	.success-card {
		background: #18181b;
		border: 1px solid rgba(16, 185, 129, 0.35);
		border-radius: 12px;
		padding: 2rem 1.25rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
	}

	.success-icon-wrap {
		font-size: 3.5rem;
		color: #10b981;
	}

	.success-card h2 {
		font-size: 1.5rem;
		color: #ffffff;
		margin: 0;
	}

	.lead-summary {
		font-size: 0.9rem;
		color: #d4d4d8;
		margin: 0;
	}

	.whatsapp-giant-btn {
		width: 100%;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
		border: 1px solid rgba(34, 197, 94, 0.5);
		border-radius: 10px;
		color: white;
		font-size: 1.05rem;
		font-weight: 700;
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
		transition: transform 0.15s;
		box-sizing: border-box;
	}

	.whatsapp-giant-btn:active {
		transform: scale(0.98);
	}

	.wa-helper-text {
		font-size: 0.75rem;
		color: #a1a1aa;
		margin: -0.5rem 0 0.5rem 0;
		line-height: 1.35;
	}

	.success-actions {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.action-btn-secondary {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		padding: 0.75rem;
		border-radius: 8px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}

	.action-btn-outline {
		background: transparent;
		border: 1px solid rgba(12, 191, 246, 0.4);
		color: #38bdf8;
		padding: 0.75rem;
		border-radius: 8px;
		font-size: 0.82rem;
		font-weight: 600;
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}
</style>
