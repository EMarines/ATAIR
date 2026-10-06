<!-- src/routes/+page.svelte -->
<!-- Dashboard Principal Inteligente para ATAIR CRM (Adaptativo: Admin vs Asociado) -->

<script lang="ts">
	import {
		userStore,
		userProfile,
		isAdmin,
		isAsociado
	} from '$lib/firebase/authManager';
	import { empresa } from '$lib/config/empresa';
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
			<h1>¡Bienvenido, {$userProfile?.name || $userProfile?.displayName || $userStore?.email?.split('@')[0] || 'Usuario'}!</h1>
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

		{#if $isAsociado}
			<div class="quick-action-hero">
				<a href="/ingesta-lead" class="action-lead-btn">
					<i class="fa-solid fa-bolt"></i>
					<span>Captar Lead Inmediato</span>
				</a>
			</div>
		{/if}
	</div>

	<!-- Tarjetas de Métricas Clave (KPIs) -->
	<section class="kpi-grid">
		{#if $isAdmin}
			<div class="kpi-card">
				<div class="kpi-icon icon-leads">
					<i class="fa-solid fa-address-book"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Leads Totales</span>
					<span class="kpi-value">Cartera Matriz</span>
					<span class="kpi-meta">Asignación central</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon icon-associates">
					<i class="fa-solid fa-users"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Red de Asociados</span>
					<span class="kpi-value">Piloto Chihuahua</span>
					<span class="kpi-meta">1 Candidata activa</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon icon-properties">
					<i class="fa-solid fa-building"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Catálogo Activo</span>
					<span class="kpi-value">Propiedades</span>
					<span class="kpi-meta">Match Home + Sinergias</span>
				</div>
			</div>

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
			<div class="kpi-card">
				<div class="kpi-icon icon-leads">
					<i class="fa-solid fa-users-line"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Mis Prospectos</span>
					<span class="kpi-value">0 Asignados</span>
					<span class="kpi-meta">Tus leads protegidos</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon icon-properties">
					<i class="fa-solid fa-house-circle-check"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">Mis Lonas & Exclusivas</span>
					<span class="kpi-value">0 Inmuebles</span>
					<span class="kpi-meta">En tu plaza asignada</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon icon-associates">
					<i class="fa-solid fa-phone-volume"></i>
				</div>
				<div class="kpi-info">
					<span class="kpi-label">SLA Llamada D1</span>
					<span class="kpi-value">&lt; 24 Horas</span>
					<span class="kpi-meta">Regla de oro de atención</span>
				</div>
			</div>

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
	}

	.kpi-label {
		font-size: 0.78rem;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.kpi-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0.2rem 0;
	}

	.kpi-meta {
		font-size: 0.72rem;
		color: #71717a;
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
