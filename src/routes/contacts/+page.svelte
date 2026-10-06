<!-- src/routes/contacts/+page.svelte -->
<!-- Cartera de Clientes con Aislamiento Estricto por Asociado (Paso 2) -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { db } from '$lib/firebase/config';
	import { collection, query, where, orderBy, onSnapshot, type Unsubscribe } from 'firebase/firestore';
	import { userProfile, userStore, isAdmin, isAsociado } from '$lib/firebase/authManager';
	import CardContact from '$lib/components/CardContact.svelte';
	import type { Contact } from '$lib/types';

	let contacts: Contact[] = [];
	let loading = true;
	let unsubscribe: Unsubscribe | null = null;

	// Filtros de búsqueda
	let searchTerm = '';
	let selectedCity = 'all';
	let selectedType = 'all';
	let selectedStage = 'all';
	let selectedAdvisor = 'all';

	// Cargar y escuchar contactos en tiempo real según el rol del usuario
	$: if ($userStore || $userProfile) {
		setupContactsListener();
	}

	function setupContactsListener() {
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = null;
		}

		loading = true;
		const uid = $userProfile?.uid || $userStore?.uid;

		try {
			const contactsCol = collection(db, 'contacts');
			let q;

			if ($isAdmin) {
				// ADMIN: Ve la cartera global de todas las plazas y asesores
				q = query(contactsCol, orderBy('createdAt', 'desc'));
			} else if (uid) {
				// ASOCIADO: Aislamiento estricto por associate_id
				q = query(contactsCol, where('associate_id', '==', uid));
			} else {
				contacts = [];
				loading = false;
				return;
			}

			unsubscribe = onSnapshot(
				q,
				(snapshot) => {
					contacts = snapshot.docs.map((doc) => {
						const d = doc.data();
						return {
							id: doc.id,
							name: d.name || '',
							lastname: d.lastname || '',
							fullName: d.fullName || `${d.name || ''} ${d.lastname || ''}`.trim(),
							telephon: d.telephon || '',
							phoneRaw: d.phoneRaw || '',
							phoneFormatted: d.phoneFormatted || '',
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
						} as Contact;
					});

					// Si la consulta del asociado no trajo orderBy por índices compuestos, ordenamos en memoria
					if (!$isAdmin) {
						contacts = contacts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
					}

					loading = false;
				},
				(err) => {
					console.error('[Contacts] Error escuchando contactos:', err);
					loading = false;
				}
			);
		} catch (err) {
			console.error('[Contacts] Error inicializando listener:', err);
			loading = false;
		}
	}

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	// Lista de asesores únicos para filtro admin
	$: advisorList = Array.from(
		new Set(contacts.map((c) => c.associate_name).filter((name): name is string => Boolean(name && name.trim())))
	);

	// Filtrado reactivo en memoria
	$: filteredContacts = contacts.filter((c) => {
		// Filtro de texto (nombre, apellido, teléfono, lona/inmueble)
		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase().trim();
			const matchName = (c.fullName || '').toLowerCase().includes(term);
			const matchPhone = (c.telephon || '').includes(term) || (c.phoneRaw || '').includes(term);
			const matchProp = (c.propertyTitle || c.lonaCode || '').toLowerCase().includes(term);
			if (!matchName && !matchPhone && !matchProp) return false;
		}

		// Filtro de Plaza (Admin)
		if ($isAdmin && selectedCity !== 'all') {
			if ((c.city_id || '').toLowerCase() !== selectedCity.toLowerCase()) return false;
		}

		// Filtro de Asesor (Admin)
		if ($isAdmin && selectedAdvisor !== 'all') {
			if (c.associate_name !== selectedAdvisor) return false;
		}

		// Filtro de Tipo
		if (selectedType !== 'all') {
			if (c.typeContact !== selectedType) return false;
		}

		// Filtro de Etapa
		if (selectedStage !== 'all') {
			const stageStr = String(c.contactStage || '').toUpperCase();
			if (selectedStage === 'E1' && stageStr !== '1' && !stageStr.includes('E1')) return false;
			if (selectedStage === 'E2' && stageStr !== '2' && !stageStr.includes('E2')) return false;
			if (selectedStage === 'E3' && stageStr !== '3' && !stageStr.includes('E3')) return false;
			if (selectedStage === 'E4' && stageStr !== '4' && !stageStr.includes('E4')) return false;
			if (selectedStage === 'E5' && stageStr !== '5' && !stageStr.includes('E5')) return false;
			if (selectedStage === 'A1' && !stageStr.includes('A1')) return false;
			if (selectedStage === 'A2' && !stageStr.includes('A2')) return false;
		}

		return true;
	});

	// Métricas del pipeline
	$: totalLeads = contacts.length;
	$: e1Count = contacts.filter((c) => String(c.contactStage) === '1' || String(c.contactStage).includes('E1')).length;
	$: e2e3Count = contacts.filter((c) => ['2', '3', 'E2', 'E3'].includes(String(c.contactStage))).length;
	$: e4e5Count = contacts.filter((c) => ['4', '5', 'E4', 'E5'].includes(String(c.contactStage))).length;
</script>

<svelte:head>
	<title>Cartera de Contactos | ATAIR CRM</title>
</svelte:head>

<div class="contacts-page">
	<div class="container">
		<!-- Encabezado y Acción Primaria -->
		<header class="page-header">
			<div class="header-left">
				<h1 class="page-title">
					<i class="fa-solid fa-address-book text-brand"></i>
					{#if $isAdmin}
						Cartera General
					{:else}
						Mi Cartera de Prospectos
					{/if}
				</h1>
				<p class="page-subtitle">
					{#if $isAdmin}
						Supervisión global de leads, asignaciones por asesor y plazas activas.
					{:else}
						Tus prospectos capturados desde lonas y llamadas directas.
					{/if}
				</p>
			</div>

			<div class="header-actions">
				<a href="/ingesta-lead" class="btn-primary-capture">
					<i class="fa-solid fa-bolt"></i>
					<span>Captar Lead</span>
				</a>
			</div>
		</header>

		<!-- Métricas Resumen -->
		<section class="stats-grid">
			<div class="stat-card">
				<span class="stat-number">{totalLeads}</span>
				<span class="stat-label">Total Leads</span>
			</div>
			<div class="stat-card border-e1">
				<span class="stat-number text-e1">{e1Count}</span>
				<span class="stat-label">E1 - Primer Contacto</span>
			</div>
			<div class="stat-card border-e2">
				<span class="stat-number text-e2">{e2e3Count}</span>
				<span class="stat-label">E2 / E3 - En Seguimiento</span>
			</div>
			<div class="stat-card border-e4">
				<span class="stat-number text-e4">{e4e5Count}</span>
				<span class="stat-label">E4 / E5 - Cierre / Trámite</span>
			</div>
		</section>

		<!-- Barra de Búsqueda y Filtros -->
		<section class="filters-card">
			<div class="search-input-wrap">
				<i class="fa-solid fa-magnifying-glass search-icon"></i>
				<input
					type="search"
					placeholder="Buscar por nombre, teléfono o lona de interés..."
					bind:value={searchTerm}
					class="search-input"
				/>
				{#if searchTerm}
					<button class="clear-btn" on:click={() => (searchTerm = '')} title="Limpiar búsqueda">
						<i class="fa-solid fa-xmark"></i>
					</button>
				{/if}
			</div>

			<div class="filter-controls">
				<!-- Filtro por Plaza (Solo Admin) -->
				{#if $isAdmin}
					<div class="select-group">
						<label for="city-filter"><i class="fa-solid fa-city"></i> Plaza:</label>
						<select id="city-filter" bind:value={selectedCity}>
							<option value="all">Todas las Plazas</option>
							<option value="cuu">Chihuahua (CUU)</option>
							<option value="del">Delicias (DEL)</option>
						</select>
					</div>

					<!-- Filtro por Asesor (Solo Admin) -->
					{#if advisorList.length > 0}
						<div class="select-group">
							<label for="advisor-filter"><i class="fa-solid fa-user-tie"></i> Asesor:</label>
							<select id="advisor-filter" bind:value={selectedAdvisor}>
								<option value="all">Todos los Asesores</option>
								{#each advisorList as adv}
									<option value={adv}>{adv}</option>
								{/each}
							</select>
						</div>
					{/if}
				{/if}

				<!-- Filtro por Tipo de Contacto -->
				<div class="select-group">
					<label for="type-filter"><i class="fa-solid fa-tag"></i> Tipo:</label>
					<select id="type-filter" bind:value={selectedType}>
						<option value="all">Todos los Tipos</option>
						<option value="Comprador">Comprador</option>
						<option value="Arrendatario">Arrendatario</option>
						<option value="Agente">Agente / Sinergia</option>
					</select>
				</div>

				<!-- Filtro por Etapa -->
				<div class="select-group">
					<label for="stage-filter"><i class="fa-solid fa-layer-group"></i> Etapa:</label>
					<select id="stage-filter" bind:value={selectedStage}>
						<option value="all">Todas las Etapas</option>
						<option value="E1">E1 - Primer Contacto</option>
						<option value="E2">E2 - Calificación</option>
						<option value="E3">E3 - Muestra Inmueble</option>
						<option value="E4">E4 - Negociación</option>
						<option value="E5">E5 - Concluido</option>
						<option value="A1">A1 - Renta Inicial</option>
						<option value="A2">A2 - Renta Sinergia</option>
					</select>
				</div>
			</div>
		</section>

		<!-- Listado de Tarjetas -->
		<section class="cards-section">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Cargando cartera de contactos...</p>
				</div>
			{:else if filteredContacts.length === 0}
				<div class="empty-state">
					<div class="empty-icon-wrap">
						<i class="fa-solid fa-folder-open"></i>
					</div>
					<h3>No se encontraron prospectos</h3>
					<p>
						{#if searchTerm || selectedStage !== 'all' || selectedType !== 'all'}
							Intenta modificar o limpiar los filtros seleccionados.
						{:else}
							Aún no tienes prospectos registrados. Utiliza el captador rápido para agregar tu primer lead.
						{/if}
					</p>
					<a href="/ingesta-lead" class="btn-empty-action">
						<i class="fa-solid fa-plus"></i> Capturar Nuevo Lead
					</a>
				</div>
			{:else}
				<div class="contacts-grid">
					{#each filteredContacts as cont (cont.id)}
						<CardContact contact={cont} showAdvisor={$isAdmin} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.contacts-page {
		min-height: calc(100vh - 120px);
		background-color: #09090b;
		padding: 1.5rem 1rem 3rem 1rem;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding-bottom: 1.2rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.page-title {
		font-size: 1.6rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.text-brand {
		color: #0cbff6;
	}

	.page-subtitle {
		font-size: 0.88rem;
		color: #a1a1aa;
		margin: 0;
	}

	.btn-primary-capture {
		background: #0cbff6;
		color: #000000;
		padding: 0.75rem 1.25rem;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.9rem;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		box-shadow: 0 4px 14px rgba(12, 191, 246, 0.35);
		transition: transform 0.15s ease, background 0.15s ease;
	}

	.btn-primary-capture:hover {
		transform: translateY(-2px);
		background: #38bdf8;
	}

	/* Métricas */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.85rem;
	}

	.stat-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-align: center;
	}

	.stat-card.border-e1 {
		border-left: 3px solid #ef4444;
	}

	.stat-card.border-e2 {
		border-left: 3px solid #f97316;
	}

	.stat-card.border-e4 {
		border-left: 3px solid #22c55e;
	}

	.stat-number {
		font-size: 1.6rem;
		font-weight: 800;
		color: #ffffff;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-weight: 600;
	}

	.text-e1 {
		color: #ef4444;
	}

	.text-e2 {
		color: #f97316;
	}

	.text-e4 {
		color: #22c55e;
	}

	/* Barra de Búsqueda y Filtros */
	.filters-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.search-input-wrap {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		color: #71717a;
		font-size: 0.9rem;
	}

	.search-input {
		width: 100%;
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.75rem 2.5rem 0.75rem 2.6rem;
		color: #ffffff;
		font-size: 0.9rem;
		box-sizing: border-box;
	}

	.search-input:focus {
		outline: none;
		border-color: #0cbff6;
		box-shadow: 0 0 0 2px rgba(12, 191, 246, 0.2);
	}

	.clear-btn {
		position: absolute;
		right: 0.75rem;
		background: transparent;
		border: none;
		color: #71717a;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0.3rem;
	}

	.filter-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.select-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		color: #a1a1aa;
	}

	.select-group select {
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #ffffff;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.82rem;
		cursor: pointer;
	}

	.select-group select:focus {
		outline: none;
		border-color: #0cbff6;
	}

	/* Cuadrícula de Contactos */
	.contacts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		text-align: center;
		color: #a1a1aa;
		gap: 0.75rem;
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

	.empty-icon-wrap {
		width: 64px;
		height: 64px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.8rem;
		color: #71717a;
	}

	.empty-state h3 {
		color: #ffffff;
		font-size: 1.1rem;
		margin: 0;
	}

	.empty-state p {
		max-width: 400px;
		font-size: 0.85rem;
		margin: 0;
	}

	.btn-empty-action {
		margin-top: 0.5rem;
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		padding: 0.65rem 1.1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.btn-empty-action:hover {
		background: #3f3f46;
	}

	@media (max-width: 640px) {
		.contacts-grid {
			grid-template-columns: 1fr;
		}

		.header-actions {
			width: 100%;
		}

		.btn-primary-capture {
			width: 100%;
			justify-content: center;
		}
	}
</style>
