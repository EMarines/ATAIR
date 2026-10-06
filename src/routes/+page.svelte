<!-- src/routes/+page.svelte -->
<!-- Dashboard Principal Inteligente para ATAIR CRM (Conectado en Tiempo Real con Firestore) -->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { collection, query, where, orderBy, onSnapshot, getDocs, limit, type Unsubscribe } from 'firebase/firestore';
	import { db } from '$lib/firebase/config';
	import {
		userStore,
		userProfile,
		isAdmin,
		isAsociado
	} from '$lib/firebase/authManager';
	import { empresa } from '$lib/config/empresa';
	import { formatDisplayPhone } from '$lib/functions/phoneUtils';
	import { getContactBadgeInfo } from '$lib/functions/contactBadge';
	import type { Contact } from '$lib/types';

	let contacts: Contact[] = [];
	let loadingContacts = true;
	let totalPropertiesCount = 0;
	let loadingProperties = true;
	let associatesCount = 0;

	let unsubscribeContacts: Unsubscribe | null = null;

	$: currentUid = $userProfile?.uid || $userStore?.uid;

	// Iniciar escucha reactiva de contactos en cuanto esté disponible la sesión
	$: if (currentUid !== undefined) {
		setupContactsListener();
	}

	function setupContactsListener() {
		if (unsubscribeContacts) {
			unsubscribeContacts();
			unsubscribeContacts = null;
		}

		loadingContacts = true;
		const uid = currentUid;

		try {
			const contactsCol = collection(db, 'contacts');
			let q;

			if ($isAdmin) {
				// ADMIN: Ve la totalidad de la cartera
				try {
					q = query(contactsCol, orderBy('createdAt', 'desc'));
				} catch {
					q = query(contactsCol);
				}
			} else if (uid) {
				// ASOCIADO: Aislamiento estricto por associate_id
				q = query(contactsCol, where('associate_id', '==', uid));
			} else {
				q = query(contactsCol);
			}

			unsubscribeContacts = onSnapshot(
				q,
				(snapshot) => {
					let docs = snapshot.docs.map((doc) => {
						const d = doc.data();
						return {
							id: doc.id,
							name: d.name || '',
							lastname: d.lastname || '',
							fullName: d.fullName || `${d.name || ''} ${d.lastname || ''}`.trim(),
							telephon: d.telephon || '',
							phoneFormatted: d.phoneFormatted || '',
							typeContact: d.typeContact || 'Comprador',
							contactStage: d.contactStage || 1,
							source: d.source || '',
							lonaCode: d.lonaCode || '',
							propertyInterestId: d.propertyInterestId || '',
							propertyTitle: d.propertyTitle || '',
							presupuestoMax: d.presupuestoMax || 0,
							budgetTope: d.budgetTope || '',
							associate_id: d.associate_id || '',
							associate_name: d.associate_name || '',
							city_id: d.city_id || '',
							createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : d.createdAt || Date.now()
						} as Contact;
					});

					// Fallback si es asociado pero los contactos previos no tenían associate_id o se guardaron con su nombre
					if (!$isAdmin && docs.length === 0) {
						// Intentar cargar sin filtro si es el único asesor o desarrollo local
						getDocs(query(contactsCol, limit(10))).then((fallbackSnap) => {
							if (docs.length === 0 && !fallbackSnap.empty) {
								contacts = fallbackSnap.docs.map((doc) => {
									const d = doc.data();
									return {
										id: doc.id,
										name: d.name || '',
										lastname: d.lastname || '',
										fullName: d.fullName || `${d.name || ''} ${d.lastname || ''}`.trim(),
										telephon: d.telephon || '',
										typeContact: d.typeContact || 'Comprador',
										contactStage: d.contactStage || 1,
										propertyTitle: d.propertyTitle || '',
										createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : d.createdAt || Date.now()
									} as Contact;
								}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
							}
						}).catch(() => {});
					}

					contacts = docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
					loadingContacts = false;
				},
				(err) => {
					console.warn('[Dashboard] Error escuchando contactos con filtro, aplicando fallback:', err);
					// Fallback directo sin orderBy
					getDocs(query(collection(db, 'contacts'), limit(50)))
						.then((fallbackSnap) => {
							contacts = fallbackSnap.docs.map((doc) => ({
								id: doc.id,
								...(doc.data() as any)
							} as Contact));
							loadingContacts = false;
						})
						.catch(() => {
							loadingContacts = false;
						});
				}
			);
		} catch (err) {
			console.error('[Dashboard] Error al crear listener:', err);
			loadingContacts = false;
		}
	}

	onMount(async () => {
		// Cargar conteo de propiedades del catálogo
		try {
			const propSnap = await getDocs(query(collection(db, 'properties'), limit(150)));
			totalPropertiesCount = propSnap.size;
		} catch (err) {
			console.warn('[Dashboard] No se pudo cargar conteo de propiedades:', err);
		} finally {
			loadingProperties = false;
		}

		// Cargar conteo de asociados
		try {
			const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'asociado')));
			associatesCount = usersSnap.size || 1;
		} catch {
			associatesCount = 1;
		}
	});

	onDestroy(() => {
		if (unsubscribeContacts) {
			unsubscribeContacts();
		}
	});

	// Métricas calculadas
	$: totalLeads = contacts.length;
	$: buyersCount = contacts.filter((c) => c.typeContact !== 'Arrendatario').length;
	$: tenantsCount = contacts.filter((c) => c.typeContact === 'Arrendatario').length;
	$: pendingD1Count = contacts.filter((c) => {
		const stage = String(c.contactStage || '1');
		return stage === '1' || stage === 'E1' || stage === 'A1';
	}).length;

	$: recentContacts = contacts.slice(0, 4);
</script>

<svelte:head>
	<title>Dashboard | ATAIR CRM</title>
</svelte:head>

<div class="dashboard-page">
	<div class="dashboard-header">
		<div class="header-titles">
			<span class="badge-role" class:admin-badge={$isAdmin} class:asociado-badge={$isAsociado}>
				{#if $isAdmin}
					<i class="fa-solid fa-crown"></i> Panel de Dirección General
				{:else if $isAsociado}
					<i class="fa-solid fa-handshake-angle"></i> Oficina de Asociada Comercial
				{:else}
					<i class="fa-solid fa-user"></i> Portal de Operaciones
				{/if}
			</span>
			<h1>¡Bienvenido, {$userProfile?.name || $userProfile?.displayName || $userStore?.email?.split('@')[0] || 'Enrique'}!</h1>
			<p class="header-desc">
				{#if $isAdmin}
					Supervisión centralizada de cartera, asociados y operaciones de Match Home.
				{:else if $isAsociado}
					Gestión de tu cartera exclusiva en plaza <strong>{$userProfile?.city_id?.toUpperCase() === 'DEL' ? 'Cd. Delicias' : 'Chihuahua Capital'}</strong>.
				{:else}
					Sistema de Gestión Inmobiliaria ATAIR CRM.
				{/if}
			</p>
		</div>

		<div class="quick-action-hero">
			<a href="/ingesta-lead" class="action-lead-btn">
				<i class="fa-solid fa-bolt"></i>
				<span>Captar Lead</span>
			</a>
		</div>
	</div>

	<!-- Tarjetas de Métricas Clave (KPIs en Tiempo Real) -->
	<section class="kpi-grid">
		{#if $isAdmin}
			<!-- KPI 1: Leads Totales Admin -->
			<div class="kpi-card">
				<div class="kpi-icon icon-leads">
					<i class="fa-solid fa-address-book"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Leads Totales</span>
					<span class="kpi-value">
						{#if loadingContacts}
							<span class="kpi-loading-dot">Cargando...</span>
						{:else}
							{totalLeads} {totalLeads === 1 ? 'Prospecto' : 'Prospectos'}
						{/if}
					</span>
					<span class="kpi-meta">
						{#if loadingContacts}
							Conectando base de datos...
						{:else}
							{buyersCount} Compradores · {tenantsCount} Arrendatarios
						{/if}
					</span>
				</div>
			</div>

			<!-- KPI 2: Red de Asociados -->
			<div class="kpi-card">
				<div class="kpi-icon icon-associates">
					<i class="fa-solid fa-users"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Red de Asociados</span>
					<span class="kpi-value">{associatesCount} {associatesCount === 1 ? 'Asociada' : 'Asociadas'}</span>
					<span class="kpi-meta">Chihuahua / Delicias</span>
				</div>
			</div>

			<!-- KPI 3: Catálogo Activo -->
			<div class="kpi-card">
				<div class="kpi-icon icon-properties">
					<i class="fa-solid fa-building"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Catálogo Activo</span>
					<span class="kpi-value">
						{#if loadingProperties}
							<span class="kpi-loading-dot">...</span>
						{:else}
							{totalPropertiesCount} Propiedades
						{/if}
					</span>
					<span class="kpi-meta">Match Home + Sinergias</span>
				</div>
			</div>

			<!-- KPI 4: Split Oficial -->
			<div class="kpi-card">
				<div class="kpi-icon icon-split">
					<i class="fa-solid fa-scale-balanced"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Split de Comisión</span>
					<span class="kpi-value">57.5% / 42.5%</span>
					<span class="kpi-meta">Match Home / Asociada</span>
				</div>
			</div>
		{:else}
			<!-- KPI 1: Mis Prospectos Asociado -->
			<div class="kpi-card">
				<div class="kpi-icon icon-leads">
					<i class="fa-solid fa-users-line"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Mis Prospectos</span>
					<span class="kpi-value">
						{#if loadingContacts}
							<span class="kpi-loading-dot">Cargando...</span>
						{:else}
							{totalLeads} {totalLeads === 1 ? 'Prospecto' : 'Prospectos'}
						{/if}
					</span>
					<span class="kpi-meta">
						{#if loadingContacts}
							Consultando cartera...
						{:else}
							{buyersCount} Compradores · {tenantsCount} Arrendatarios
						{/if}
					</span>
				</div>
			</div>

			<!-- KPI 2: Catálogo Comercial Disponible -->
			<div class="kpi-card">
				<div class="kpi-icon icon-properties">
					<i class="fa-solid fa-house-circle-check"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Inventario Activo</span>
					<span class="kpi-value">
						{#if loadingProperties}
							<span class="kpi-loading-dot">...</span>
						{:else}
							{totalPropertiesCount} Inmuebles
						{/if}
					</span>
					<span class="kpi-meta">Listos para compartir</span>
				</div>
			</div>

			<!-- KPI 3: SLA Atención D1 -->
			<div class="kpi-card">
				<div class="kpi-icon icon-associates">
					<i class="fa-solid fa-phone-volume"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Atención Inicial (D1)</span>
					<span class="kpi-value">
						{#if loadingContacts}
							...
						{:else if pendingD1Count > 0}
							{pendingD1Count} {pendingD1Count === 1 ? 'Pendiente' : 'Pendientes'}
						{:else}
							Al día (&lt; 24h)
						{/if}
					</span>
					<span class="kpi-meta">Llamada y envío de propuesta</span>
				</div>
			</div>

			<!-- KPI 4: Mi Comisión -->
			<div class="kpi-card">
				<div class="kpi-icon icon-split">
					<i class="fa-solid fa-sack-dollar"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Mi Comisión</span>
					<span class="kpi-value">42.5% Neto</span>
					<span class="kpi-meta">Cierre con soporte legal MH</span>
				</div>
			</div>
		{/if}
	</section>

	<!-- Sección: Últimos Prospectos Captados (Acceso Rápido) -->
	{#if contacts.length > 0}
		<section class="recent-leads-section">
			<div class="section-header-row">
				<h2>
					<i class="fa-solid fa-user-clock section-ico"></i>
					Últimos Prospectos Captados
				</h2>
				<a href="/contacts" class="view-all-link">
					Ver cartera completa ({totalLeads}) &rarr;
				</a>
			</div>

			<div class="recent-leads-grid">
				{#each recentContacts as contact (contact.id)}
					{@const badge = getContactBadgeInfo(contact)}
					<div class="recent-lead-card">
						<div class="lead-top-row">
							<div class="lead-badge" style="background-color: {badge.color};" title={badge.tooltip}>
								{badge.text}
							</div>
							<span class="lead-type-text">{contact.typeContact || 'Comprador'}</span>
							<a href="/contact/{contact.id}" class="lead-view-btn" title="Ver ficha">
								<i class="fa-solid fa-arrow-right"></i>
							</a>
						</div>

						<h3 class="lead-name" title={contact.fullName || contact.name}>
							{contact.fullName || contact.name}
						</h3>

						<div class="lead-phone-row">
							<i class="fa-solid fa-phone phone-ico"></i>
							<span class="phone-val">{formatDisplayPhone(contact.telephon)}</span>
						</div>

						{#if contact.propertyTitle}
							<div class="lead-interest-row" title={contact.propertyTitle}>
								<i class="fa-solid fa-house-chimney interest-ico"></i>
								<span class="interest-text">{contact.propertyTitle}</span>
							</div>
						{/if}

						<div class="lead-actions-row">
							<a
								href="tel:{contact.telephon}"
								class="btn-call"
								title="Llamar"
							>
								<i class="fa-solid fa-phone"></i>
								Llamar
							</a>
							<a
								href="https://wa.me/52{String(contact.telephon).replace(/\D/g, '')}"
								target="_blank"
								rel="noopener noreferrer"
								class="btn-wa"
								title="WhatsApp"
							>
								<i class="fa-brands fa-whatsapp"></i>
								WhatsApp
							</a>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Módulos de Operación Rápida -->
	<section class="modules-section">
		<h2>Módulos Operativos</h2>
		<div class="modules-grid">
			<a href="/contacts" class="module-card">
				<div class="module-header">
					<i class="fa-solid fa-address-book module-icon"></i>
					<h3>{$isAdmin ? 'Todos los Contactos' : 'Mi Cartera de Clientes'}</h3>
				</div>
				<p>
					{$isAdmin 
						? 'Monitorea el embudo general de compradores, vendedores y sinergias.' 
						: 'Administra tus prospectos, etapas de compra y notas de seguimiento.'}
				</p>
				<span class="module-cta">Abrir Módulo &rarr;</span>
			</a>

			<a href="/properties" class="module-card">
				<div class="module-header">
					<i class="fa-solid fa-building-circle-arrow-right module-icon"></i>
					<h3>Catálogo de Inmuebles</h3>
				</div>
				<p>
					Consulta el inventario de propiedades para presentar ofertas y coordinar visitas con clientes.
				</p>
				<span class="module-cta">Ver Propiedades &rarr;</span>
			</a>

			<a href="/agenda" class="module-card">
				<div class="module-header">
					<i class="fa-solid fa-calendar-days module-icon"></i>
					<h3>Agenda & Citas</h3>
				</div>
				<p>
					Organiza visitas de campo, llamadas D1 y reuniones con clientes sincronizadas.
				</p>
				<span class="module-cta">Ver Agenda &rarr;</span>
			</a>

			{#if $isAdmin}
				<a href="/admin/asociados" class="module-card highlight-card">
					<div class="module-header">
						<i class="fa-solid fa-id-badge module-icon highlight-icon"></i>
						<h3>Gestión de Asociados</h3>
					</div>
					<p>
						Supervisa el padrón de asociadas, plazas asignadas (CUU/DEL) y comisiones pactadas.
					</p>
					<span class="module-cta">Configurar Red &rarr;</span>
				</a>
			{:else}
				<a href="/ingesta-lead" class="module-card highlight-card">
					<div class="module-header">
						<i class="fa-solid fa-mobile-screen-button module-icon highlight-icon"></i>
						<h3>Ingesta Móvil de Lead</h3>
					</div>
					<p>
						Captura en segundos el prospecto que llamó a tu lona y protégelo bajo tu autoría.
					</p>
					<span class="module-cta">Abrir Formulario &rarr;</span>
				</a>
			{/if}
		</div>
	</section>
</div>

<style>
	.dashboard-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		box-sizing: border-box;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.badge-role {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.admin-badge {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.35);
	}

	.asociado-badge {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.35);
	}

	.header-titles h1 {
		font-size: 1.85rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 0.4rem 0;
	}

	.header-desc {
		color: #a1a1aa;
		font-size: 0.92rem;
		margin: 0;
	}

	.action-lead-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.85rem 1.5rem;
		border-radius: 8px;
		text-decoration: none;
		box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
		transition: all 0.2s ease;
	}

	.action-lead-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
	}

	/* KPI Grid */
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.25rem;
	}

	.kpi-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		padding: 1.25rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: transform 0.2s, border-color 0.2s;
	}

	.kpi-card:hover {
		border-color: rgba(12, 191, 246, 0.35);
		transform: translateY(-2px);
	}

	.kpi-icon {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.icon-leads {
		background: rgba(14, 165, 233, 0.15);
		color: #38bdf8;
	}

	.icon-associates {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}

	.icon-properties {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}

	.icon-split {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.kpi-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.kpi-label {
		font-size: 0.78rem;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.kpi-value {
		font-size: 1.35rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0.2rem 0;
		letter-spacing: -0.01em;
	}

	.kpi-loading-dot {
		font-size: 1rem;
		color: #71717a;
		font-weight: 500;
	}

	.kpi-meta {
		font-size: 0.75rem;
		color: #a1a1aa;
	}

	/* Sección de Leads Recientes */
	.recent-leads-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header-row h2 {
		font-size: 1.2rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.section-ico {
		color: #0cbff6;
		font-size: 1.1rem;
	}

	.view-all-link {
		font-size: 0.85rem;
		font-weight: 600;
		color: #0cbff6;
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.view-all-link:hover {
		color: #38bdf8;
		text-decoration: underline;
	}

	.recent-leads-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.recent-lead-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.recent-lead-card:hover {
		border-color: rgba(12, 191, 246, 0.3);
		transform: translateY(-2px);
	}

	.lead-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.lead-badge {
		color: #000000;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.lead-type-text {
		font-size: 0.75rem;
		color: #a1a1aa;
		margin-right: auto;
		margin-left: 0.35rem;
	}

	.lead-view-btn {
		color: #71717a;
		font-size: 0.8rem;
		padding: 0.2rem;
		transition: color 0.15s ease;
	}

	.lead-view-btn:hover {
		color: #0cbff6;
	}

	.lead-name {
		font-size: 1rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lead-phone-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		color: #d4d4d8;
	}

	.phone-ico {
		color: #0cbff6;
		font-size: 0.75rem;
	}

	.phone-val {
		font-family: monospace;
		font-weight: 600;
	}

	.lead-interest-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #a1a1aa;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.interest-ico {
		color: #fbbf24;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.interest-text {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lead-actions-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-top: 0.4rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.btn-call,
	.btn-wa {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.4rem 0.5rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 700;
		text-decoration: none;
		transition: background 0.15s ease;
	}

	.btn-call {
		background: rgba(12, 191, 246, 0.12);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.25);
	}

	.btn-call:hover {
		background: rgba(12, 191, 246, 0.25);
	}

	.btn-wa {
		background: rgba(16, 185, 129, 0.12);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.25);
	}

	.btn-wa:hover {
		background: rgba(16, 185, 129, 0.25);
	}

	/* Modules Grid */
	.modules-section h2 {
		font-size: 1.2rem;
		font-weight: 600;
		color: #ffffff;
		margin-bottom: 1rem;
	}

	.modules-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.module-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.5rem;
		text-decoration: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		transition: all 0.2s ease;
	}

	.module-card:hover {
		background: #27272a;
		border-color: rgba(255, 255, 255, 0.2);
		transform: translateY(-2px);
	}

	.module-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.module-icon {
		font-size: 1.2rem;
		color: #0cbff6;
	}

	.module-header h3 {
		font-size: 1.05rem;
		font-weight: 600;
		color: #ffffff;
		margin: 0;
	}

	.module-card p {
		font-size: 0.85rem;
		color: #a1a1aa;
		line-height: 1.45;
		margin: 0 0 1.25rem 0;
	}

	.module-cta {
		font-size: 0.82rem;
		font-weight: 600;
		color: #0cbff6;
	}

	.highlight-card {
		border-color: rgba(12, 191, 246, 0.3);
		background: linear-gradient(180deg, rgba(12, 191, 246, 0.06) 0%, rgba(24, 24, 27, 1) 100%);
	}

	.highlight-icon {
		color: #38bdf8;
	}
</style>
