<!-- src/routes/ingesta-lead/+page.svelte -->
<!-- PWA Ligera Mobile-First v2: Ingesta Inmediata con Búsqueda predictiva (3+ letras), Teléfono flexible y Tope presupuestal -->

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
	let leadFullName = '';
	let leadPhone = '';
	let interestType: 'Comprador' | 'Arrendatario' = 'Comprador';
	let propertySearch = '';
	let selectedPropertyId = '';
	let selectedPropertyTitle = '';
	let maxBudget = '';
	let notes = '';

	// Estado UI
	let isSubmitting = false;
	let savedSuccess = false;
	let createdLeadId = '';
	let whatsappUrl = '';
	let showDropdown = false;

	// Catálogo de propiedades en memoria para filtrado instantáneo
	interface PropItem {
		id: string;
		title: string;
		code: string;
		colonia: string;
		price?: number;
		operation?: string;
	}
	let allProperties: PropItem[] = [];
	let filteredProperties: PropItem[] = [];

	onMount(async () => {
		try {
			const propsQuery = query(collection(db, 'properties'), limit(80));
			const snapshot = await getDocs(propsQuery);
			allProperties = snapshot.docs.map((doc) => {
				const d = doc.data();
				return {
					id: doc.id,
					title: d.titulo || d.title || 'Propiedad sin título',
					code: d.clavePropiedad || d.easybroker_id || doc.id.substring(0, 6),
					colonia: d.colonia || '',
					price: d.precio || d.price || 0,
					operation: d.tipoOperacion || d.operation_type || ''
				};
			});
		} catch (err) {
			console.warn('[IngestaLead] No se pudieron precargar propiedades:', err);
		}
	});

	// Filtrado reactivo al teclear a partir de la 3era letra (solo cuando se está buscando activamente)
	$: if (!selectedPropertyId && propertySearch.trim().length >= 3) {
		const term = propertySearch.toLowerCase().trim();
		filteredProperties = allProperties.filter((p) =>
			p.title.toLowerCase().includes(term) ||
			p.code.toLowerCase().includes(term) ||
			p.colonia.toLowerCase().includes(term)
		).slice(0, 6);
		showDropdown = true;
	} else if (!selectedPropertyId) {
		filteredProperties = [];
		showDropdown = false;
	}

	function selectProperty(prop: PropItem) {
		selectedPropertyId = prop.id;
		selectedPropertyTitle = `${prop.code} - ${prop.title} ${prop.colonia ? `(${prop.colonia})` : ''}`;
		propertySearch = selectedPropertyTitle;
		filteredProperties = [];
		showDropdown = false;
	}

	function clearPropertySelection() {
		propertySearch = '';
		selectedPropertyId = '';
		selectedPropertyTitle = '';
		filteredProperties = [];
		showDropdown = false;
	}

	// Limpieza profunda del teléfono (admite guiones, espacios y paréntesis)
	function extractCleanPhone(raw: string): string {
		const digits = raw.replace(/\D/g, '');
		if (digits.length === 12 && digits.startsWith('52')) {
			return digits.substring(2);
		}
		return digits.slice(-10);
	}

	// Separación inteligente de Nombre y Apellidos
	function splitFullName(raw: string): { name: string; lastname: string } {
		const clean = raw.trim().replace(/\s+/g, ' ');
		if (!clean) return { name: '', lastname: '' };
		const parts = clean.split(' ');
		if (parts.length === 1) {
			return { name: parts[0], lastname: '' };
		}
		// Si son 2 palabras: Primera = Nombre, Segunda = Apellido
		// Si son 3 o más palabras: Primera = Nombre, Resto = Apellidos
		const name = parts[0];
		const lastname = parts.slice(1).join(' ');
		return { name, lastname };
	}

	// Formatear valor numérico de presupuesto a moneda legible
	function setBudgetPreset(val: string) {
		maxBudget = val;
	}

	async function handleSubmit() {
		const cleanPhone = extractCleanPhone(leadPhone);
		if (!leadFullName.trim()) {
			notifications.warning('Por favor escribe el nombre del cliente.');
			return;
		}
		if (cleanPhone.length < 10) {
			notifications.warning('El teléfono debe contener al menos 10 dígitos.');
			return;
		}

		try {
			isSubmitting = true;

			const asesorUid = $userProfile?.uid || $userStore?.uid || 'anonimo';
			const asesorName = $userProfile?.name || $userProfile?.displayName || empresa.agentName;
			const cityId = $userProfile?.city_id || 'cuu';

			const { name: fName, lastname: lName } = splitFullName(leadFullName);

			// Inmueble de interés: el seleccionado o el texto manual escrito
			const finalPropertyText = selectedPropertyTitle || propertySearch.trim() || 'LONA-GENERAL';

			// 1. Guardar contacto en Firestore
			const contactPayload = {
				name: fName,
				lastname: lName,
				fullName: leadFullName.trim(),
				telephon: `+52${cleanPhone}`,
				phoneRaw: cleanPhone,
				phoneFormatted: leadPhone.trim(),
				typeContact: interestType,
				contactStage: 1, // E1 - Primer Contacto
				source: 'lona_llamada',
				lonaCode: finalPropertyText,
				propertyInterestId: selectedPropertyId || '',
				propertyTitle: finalPropertyText,
				presupuestoMax: maxBudget ? Number(maxBudget.replace(/\D/g, '')) || maxBudget : 0,
				budgetTope: maxBudget,
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
				descripcion: `Llamada entrante por lona: ${finalPropertyText}. Tope: ${maxBudget || 'No especificado'}. Atendido por ${asesorName}.`,
				fecha: serverTimestamp(),
				asesor: asesorName
			});

			// 3. Generar enlace de WhatsApp con saludo cordial pre-redactado
			const greeting = `Hola ${fName}, mucho gusto. Te saluda ${asesorName} de ${empresa.companyName}. Recibí tu llamada sobre ${finalPropertyText ? 'la propiedad ' + finalPropertyText : 'la propiedad en lona'}. Con gusto te comparto los detalles y fotos. ¿A qué hora te quedaría bien que lo platiquemos?`;
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
		leadFullName = '';
		leadPhone = '';
		propertySearch = '';
		selectedPropertyId = '';
		selectedPropertyTitle = '';
		maxBudget = '';
		notes = '';
		savedSuccess = false;
		createdLeadId = '';
		whatsappUrl = '';
		showDropdown = false;
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
				<!-- Nombre Completo (1 solo campo con separación automática por código) -->
				<div class="field-card">
					<label for="leadFullName">
						<i class="fa-solid fa-user input-icon"></i> Nombre Completo del Cliente *
					</label>
					<input
						id="leadFullName"
						type="text"
						bind:value={leadFullName}
						placeholder="Ej. Roberto Garza Méndez"
						required
						autocomplete="name"
						disabled={isSubmitting}
					/>
					<span class="hint-text">El sistema separa automáticamente nombre y apellidos.</span>
				</div>

				<!-- Teléfono Móvil (Permite espacios, guiones y paréntesis) -->
				<div class="field-card">
					<label for="leadPhone">
						<i class="fa-brands fa-whatsapp input-icon wa-color"></i> WhatsApp / Teléfono *
					</label>
					<div class="phone-input-row">
						<span class="phone-prefix">+52</span>
						<input
							id="leadPhone"
							type="text"
							bind:value={leadPhone}
							placeholder="614 123 4567 o 614-123-4567"
							required
							inputmode="tel"
							disabled={isSubmitting}
						/>
					</div>
					<span class="hint-text">Puedes escribir espacios o guiones libremente; se limpian al guardar.</span>
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

				<!-- Inmueble / Lona con Filtro Dinámico (3+ letras) -->
				<div class="field-card relative-card">
					<div class="label-with-clear">
						<label for="propertySearch">
							<i class="fa-solid fa-sign-hanging input-icon"></i> Inmueble o Código de Lona
						</label>
						{#if propertySearch}
							<button type="button" class="clear-btn" on:click={clearPropertySelection}>
								Limpiar
							</button>
						{/if}
					</div>

					<input
						id="propertySearch"
						type="text"
						bind:value={propertySearch}
						placeholder="Escribe 3 letras para filtrar catálogo o código de lona manual..."
						autocomplete="off"
						disabled={isSubmitting}
					/>

					{#if selectedPropertyId}
						<div class="selected-badge">
							<i class="fa-solid fa-circle-check"></i>
							<span>Inmueble vinculado con éxito</span>
						</div>
					{:else if showDropdown && filteredProperties.length > 0}
						<div class="predictive-dropdown">
							<div class="dropdown-header">Inmuebles coincidentes (toca para vincular):</div>
							{#each filteredProperties as prop}
								<button
									type="button"
									class="dropdown-item"
									on:click={() => selectProperty(prop)}
								>
									<div class="item-title">{prop.title}</div>
									<div class="item-meta">
										<span class="prop-code">{prop.code}</span>
										{#if prop.colonia}
											<span class="prop-colonia">📍 {prop.colonia}</span>
										{/if}
										{#if prop.price}
											<span class="prop-price">${Number(prop.price).toLocaleString('es-MX')}</span>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{:else if propertySearch.trim().length >= 3 && filteredProperties.length === 0}
						<div class="predictive-hint">
							<span>No hay inmueble en catálogo. Se guardará como código de lona libre: <strong>"{propertySearch}"</strong></span>
						</div>
					{/if}
				</div>

				<!-- Tope de Presupuesto (Solo el valor máximo) -->
				<div class="field-card">
					<label for="maxBudget">
						<i class="fa-solid fa-hand-holding-dollar input-icon"></i> Presupuesto Tope (Máximo)
					</label>
					<input
						id="maxBudget"
						type="text"
						bind:value={maxBudget}
						placeholder="Ej. $3,500,000 o 3500000"
						inputmode="numeric"
						disabled={isSubmitting}
					/>
					<!-- Botones Rápidos de Topes Frecuentes -->
					<div class="budget-chips">
						{#each ['$1,500,000', '$2,500,000', '$3,500,000', '$5,000,000', '$8,000,000+'] as b}
							<button
								type="button"
								class="chip-btn"
								class:selected={maxBudget === b}
								on:click={() => setBudgetPreset(b)}
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
					<strong>{leadFullName}</strong> (+52 {extractCleanPhone(leadPhone)}) ha quedado indexado a tu nombre.
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

	.relative-card {
		position: relative;
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

	.label-with-clear {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.clear-btn {
		background: none;
		border: none;
		color: #ef4444;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.input-icon {
		font-size: 0.85rem;
		color: #0cbff6;
	}

	.wa-color {
		color: #22c55e !important;
	}

	input[type="text"],
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

	/* Dropdown predictivo de inmuebles */
	.predictive-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #27272a;
		border: 1px solid rgba(12, 191, 246, 0.4);
		border-radius: 8px;
		z-index: 50;
		margin-top: 0.25rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
		overflow: hidden;
	}

	.dropdown-header {
		padding: 0.4rem 0.75rem;
		font-size: 0.7rem;
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #18181b;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.dropdown-item {
		width: 100%;
		padding: 0.7rem 0.85rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		text-align: left;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		transition: background 0.15s;
	}

	.dropdown-item:hover,
	.dropdown-item:active {
		background: rgba(12, 191, 246, 0.15);
	}

	.item-title {
		font-size: 0.84rem;
		font-weight: 600;
		color: #ffffff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		display: flex;
		gap: 0.5rem;
		font-size: 0.72rem;
		align-items: center;
	}

	.prop-code {
		background: rgba(255, 255, 255, 0.1);
		color: #38bdf8;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-weight: 700;
	}

	.prop-colonia {
		color: #a1a1aa;
	}

	.prop-price {
		color: #34d399;
		font-weight: 600;
		margin-left: auto;
	}

	.predictive-hint {
		font-size: 0.72rem;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.04);
		padding: 0.4rem 0.6rem;
		border-radius: 6px;
		border: 1px dashed rgba(255, 255, 255, 0.12);
	}

	.predictive-hint strong {
		color: #38bdf8;
	}

	.selected-badge {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* Chips de presupuesto tope */
	.budget-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.25rem;
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
