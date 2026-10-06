<!-- src/routes/properties/+page.svelte -->
<!-- Catálogo Móvil Ultra-Rápido de Propiedades - ATAIR CRM -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
	import { db } from '$lib/firebase/config';
	import { userStore, userProfile } from '$lib/firebase/authManager';
	import { goto } from '$app/navigation';
	import CardProperty from '$lib/components/CardProperty.svelte';
	import { normalizeProperty } from '$lib/functions/normalizeProperty';
	import type { Property } from '$lib/types';

	let properties: Property[] = [];
	let loading = true;
	let errorMsg = '';

	// Filtros reactivos
	let searchTerm = '';
	let filterOperation: 'all' | 'sale' | 'rental' = 'all';
	let filterType: string = 'all';
	let filterSource: 'all' | 'easybroker' | 'direct' | 'synergy' = 'all';
	let sortBy: 'recent' | 'price_asc' | 'price_desc' = 'recent';

	// Redirigir si no hay sesión activa
	$: if ($userStore === null && $userProfile === null && !loading) {
		// Esperar montado antes de redireccionar
	}

	onMount(async () => {
		await loadProperties();
	});

	async function loadProperties() {
		loading = true;
		errorMsg = '';
		try {
			// Intentamos traer propiedades recientes
			let q;
			try {
				q = query(collection(db, 'properties'), orderBy('created_at', 'desc'), limit(150));
			} catch {
				q = query(collection(db, 'properties'), limit(150));
			}
			const snap = await getDocs(q);

			properties = snap.docs.map((d) => normalizeProperty(d.data(), d.id));
		} catch (err: any) {
			console.error('❌ Error cargando propiedades:', err);
			// Fallback simple sin orderBy
			try {
				const fallbackSnap = await getDocs(query(collection(db, 'properties'), limit(150)));
				properties = fallbackSnap.docs.map((d) => normalizeProperty(d.data(), d.id));
			} catch (fallbackErr: any) {
				errorMsg = fallbackErr.message || 'No se pudieron cargar las propiedades.';
			}
		} finally {
			loading = false;
		}
	}

	// Tipos únicos encontrados en el inventario para el selector dinámico
	$: availableTypes = Array.from(
		new Set(
			properties
				.map((p) => p.property_type || p.tipoPropiedad)
				.filter(Boolean)
		)
	).sort();

	// Filtrado y ordenamiento reactivo
	$: filteredProperties = properties
		.filter((p) => {
			// 1. Filtro Operación
			if (filterOperation === 'sale') {
				const op = String(p.tipoOperacion || p.operation_type || p.selecTO).toLowerCase();
				if (op.includes('rent')) return false;
			} else if (filterOperation === 'rental') {
				const op = String(p.tipoOperacion || p.operation_type || p.selecTO).toLowerCase();
				if (!op.includes('rent')) return false;
			}

			// 2. Filtro Tipo de Inmueble
			if (filterType !== 'all') {
				const type = String(p.property_type || p.tipoPropiedad || '').toLowerCase();
				if (!type.includes(filterType.toLowerCase())) return false;
			}

			// 3. Filtro Origen
			if (filterSource === 'easybroker') {
				if (p.source !== 'easybroker' && !p.public_id?.startsWith('EB-')) return false;
			} else if (filterSource === 'direct') {
				if (p.source !== 'direct') return false;
			} else if (filterSource === 'synergy') {
				if (p.source !== 'synergy') return false;
			}

			// 4. Búsqueda por texto (clave, título, colonia/zona)
			if (searchTerm.trim()) {
				const term = searchTerm
					.toLowerCase()
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '');

				const combined = `${p.public_id || ''} ${p.title || ''} ${p.colonia || ''} ${p.location || ''} ${p.zona || ''}`
					.toLowerCase()
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '');

				if (!combined.includes(term)) return false;
			}

			return true;
		})
		.sort((a, b) => {
			if (sortBy === 'price_asc') {
				return (Number(a.price) || 0) - (Number(b.price) || 0);
			} else if (sortBy === 'price_desc') {
				return (Number(b.price) || 0) - (Number(a.price) || 0);
			}
			// 'recent'
			return (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
		});

	function clearFilters() {
		searchTerm = '';
		filterOperation = 'all';
		filterType = 'all';
		filterSource = 'all';
		sortBy = 'recent';
	}
</script>

<svelte:head>
	<title>Propiedades | ATAIR CRM</title>
</svelte:head>

<div class="properties-container">
	<!-- Encabezado de Catálogo -->
	<header class="catalog-header">
		<div class="header-main-row">
			<div class="header-title-box">
				<h1 class="page-title">
					<i class="fa-solid fa-building title-icon"></i>
					Catálogo de Propiedades
				</h1>
				<p class="subtitle">
					Inventario comercial activo para compartir y generar propuestas
				</p>
			</div>

			<div class="header-actions">
				<button class="btn-refresh" on:click={loadProperties} title="Recargar inventario">
					<i class="fa-solid fa-rotate-right" class:spin={loading}></i>
				</button>
				<a href="/ingesta-lead" class="btn-new-lead" title="Captar nuevo lead con lona">
					<i class="fa-solid fa-bolt"></i>
					<span>Captar Lead</span>
				</a>
			</div>
		</div>

		<!-- Buscador Principal -->
		<div class="search-bar-wrap">
			<div class="search-input-box">
				<i class="fa-solid fa-magnifying-glass search-icon"></i>
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Buscar por clave (ej. EB-RR8135), colonia, título..."
					class="search-input"
				/>
				{#if searchTerm}
					<button class="clear-search-btn" on:click={() => (searchTerm = '')}>
						<i class="fa-solid fa-xmark"></i>
					</button>
				{/if}
			</div>

			<!-- Ordenamiento rápido -->
			<div class="sort-select-box">
				<i class="fa-solid fa-arrow-down-short-wide sort-icon"></i>
				<select bind:value={sortBy} class="sort-select">
					<option value="recent">Más recientes</option>
					<option value="price_asc">Precio: Menor a Mayor</option>
					<option value="price_desc">Precio: Mayor a Menor</option>
				</select>
			</div>
		</div>

		<!-- Filtros Tipo Píldora (Horizontal Scroll en Móvil) -->
		<div class="pills-scroll-container">
			<!-- Píldoras Operación -->
			<div class="pills-group">
				<span class="group-label">Operación:</span>
				<button
					class="filter-pill"
					class:active={filterOperation === 'all'}
					on:click={() => (filterOperation = 'all')}
				>
					Todas
				</button>
				<button
					class="filter-pill"
					class:active={filterOperation === 'sale'}
					on:click={() => (filterOperation = 'sale')}
				>
					Venta
				</button>
				<button
					class="filter-pill"
					class:active={filterOperation === 'rental'}
					on:click={() => (filterOperation = 'rental')}
				>
					Renta
				</button>
			</div>

			<div class="divider-v"></div>

			<!-- Píldoras Origen -->
			<div class="pills-group">
				<span class="group-label">Fuente:</span>
				<button
					class="filter-pill"
					class:active={filterSource === 'all'}
					on:click={() => (filterSource = 'all')}
				>
					Todas
				</button>
				<button
					class="filter-pill"
					class:active={filterSource === 'easybroker'}
					on:click={() => (filterSource = 'easybroker')}
				>
					MatchHome (EB)
				</button>
				<button
					class="filter-pill"
					class:active={filterSource === 'direct'}
					on:click={() => (filterSource = 'direct')}
				>
					Directas
				</button>
				<button
					class="filter-pill"
					class:active={filterSource === 'synergy'}
					on:click={() => (filterSource = 'synergy')}
				>
					Sinergias
				</button>
			</div>

			<!-- Selector de Tipo de Inmueble si hay tipos disponibles -->
			{#if availableTypes.length > 0}
				<div class="divider-v"></div>
				<div class="pills-group">
					<span class="group-label">Tipo:</span>
					<select bind:value={filterType} class="type-dropdown-pill">
						<option value="all">Todos los tipos ({availableTypes.length})</option>
						{#each availableTypes as t}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if searchTerm || filterOperation !== 'all' || filterType !== 'all' || filterSource !== 'all' || sortBy !== 'recent'}
				<button class="clear-all-pill" on:click={clearFilters}>
					<i class="fa-solid fa-filter-circle-xmark"></i>
					Limpiar
				</button>
			{/if}
		</div>

		<!-- Barra de conteo de resultados -->
		<div class="results-count-bar">
			<span class="count-text">
				Mostrando <strong>{filteredProperties.length}</strong> de {properties.length} propiedades
			</span>
		</div>
	</header>

	<!-- Estado de Carga -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Cargando catálogo comercial...</p>
		</div>
	{:else if errorMsg}
		<div class="error-banner">
			<i class="fa-solid fa-triangle-exclamation"></i>
			<span>{errorMsg}</span>
			<button class="btn-retry" on:click={loadProperties}>Reintentar</button>
		</div>
	{:else if filteredProperties.length === 0}
		<!-- Estado Vacío -->
		<div class="empty-state">
			<div class="empty-icon-box">
				<i class="fa-solid fa-house-chimney-crack"></i>
			</div>
			<h3>No se encontraron propiedades</h3>
			<p>Intenta ajustar el término de búsqueda o limpia los filtros activos.</p>
			<button class="btn-reset-filters" on:click={clearFilters}>
				Restablecer Filtros
			</button>
		</div>
	{:else}
		<!-- Grilla de Propiedades -->
		<main class="properties-grid">
			{#each filteredProperties as property (property.id || property.public_id)}
				<CardProperty {property} />
			{/each}
		</main>
	{/if}
</div>

<style>
	.properties-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem 1rem;
		min-height: calc(100vh - 70px);
		box-sizing: border-box;
	}

	.catalog-header {
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.header-main-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header-title-box {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		letter-spacing: -0.02em;
	}

	.title-icon {
		color: #0cbff6;
		font-size: 1.3rem;
	}

	.subtitle {
		font-size: 0.85rem;
		color: #a1a1aa;
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.btn-refresh {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 1rem;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.btn-refresh:hover {
		background: rgba(12, 191, 246, 0.15);
		border-color: #0cbff6;
		color: #ffffff;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}

	.btn-new-lead {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 0 1rem;
		height: 40px;
		font-size: 0.88rem;
		font-weight: 700;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-new-lead:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
	}

	.search-bar-wrap {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem;
	}

	@media (max-width: 640px) {
		.search-bar-wrap {
			grid-template-columns: 1fr;
		}
	}

	.search-input-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		color: #71717a;
		font-size: 0.95rem;
	}

	.search-input {
		width: 100%;
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.75rem 2.6rem 0.75rem 2.6rem;
		color: #ffffff;
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
	}

	.search-input:focus {
		border-color: #0cbff6;
		box-shadow: 0 0 0 3px rgba(12, 191, 246, 0.2);
	}

	.clear-search-btn {
		position: absolute;
		right: 0.75rem;
		background: transparent;
		border: none;
		color: #71717a;
		cursor: pointer;
		font-size: 0.95rem;
		padding: 0.25rem;
	}

	.clear-search-btn:hover {
		color: #ffffff;
	}

	.sort-select-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.sort-icon {
		position: absolute;
		left: 0.85rem;
		color: #71717a;
		font-size: 0.85rem;
		pointer-events: none;
	}

	.sort-select {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.75rem 1rem 0.75rem 2.4rem;
		color: #e4e4e7;
		font-size: 0.85rem;
		outline: none;
		cursor: pointer;
		height: 100%;
		box-sizing: border-box;
	}

	.sort-select:focus {
		border-color: #0cbff6;
	}

	/* Contenedor de Píldoras con Scroll Horizontal Suave */
	.pills-scroll-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		overflow-x: auto;
		padding-bottom: 0.35rem;
		scrollbar-width: thin;
	}

	.pills-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.group-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.25rem;
	}

	.filter-pill {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #a1a1aa;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.filter-pill:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.filter-pill.active {
		background: #0cbff6;
		color: #000000;
		font-weight: 700;
		border-color: #0cbff6;
	}

	.divider-v {
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.12);
		flex-shrink: 0;
	}

	.type-dropdown-pill {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 9999px;
		color: #e4e4e7;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.35rem 0.75rem;
		outline: none;
		cursor: pointer;
	}

	.type-dropdown-pill:focus {
		border-color: #0cbff6;
	}

	.clear-all-pill {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #f87171;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.clear-all-pill:hover {
		background: rgba(239, 68, 68, 0.25);
		color: #ffffff;
	}

	.results-count-bar {
		display: flex;
		align-items: center;
		font-size: 0.8rem;
		color: #71717a;
	}

	.results-count-bar strong {
		color: #0cbff6;
	}

	/* Grilla Responsiva */
	.properties-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 1.25rem;
	}

	@media (max-width: 640px) {
		.properties-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Estados de Carga y Error */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 1rem;
		gap: 1rem;
		color: #a1a1aa;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: #0cbff6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #fca5a5;
		padding: 1rem 1.25rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.btn-retry {
		margin-left: auto;
		background: #ef4444;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 1rem;
		text-align: center;
		background: #18181b;
		border: 1px dashed rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		margin-top: 1rem;
	}

	.empty-icon-box {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.04);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.75rem;
		color: #71717a;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		font-size: 1.15rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 0.5rem 0;
	}

	.empty-state p {
		font-size: 0.85rem;
		color: #a1a1aa;
		max-width: 360px;
		margin: 0 0 1.25rem 0;
	}

	.btn-reset-filters {
		background: #0cbff6;
		color: #000000;
		border: none;
		padding: 0.5rem 1.25rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-reset-filters:hover {
		background: #38bdf8;
	}
</style>
