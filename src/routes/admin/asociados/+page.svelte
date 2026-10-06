<!-- src/routes/admin/asociados/+page.svelte -->
<!-- Panel de Dirección General: Gestión de Red de Asociadas Comerciales - ATAIR CRM -->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		collection,
		query,
		onSnapshot,
		getDocs,
		addDoc,
		setDoc,
		updateDoc,
		doc,
		where,
		serverTimestamp,
		type Unsubscribe
	} from 'firebase/firestore';
	import { db } from '$lib/firebase/config';
	import { userStore, userProfile, isAdmin, authLoading } from '$lib/firebase/authManager';
	import { formatDisplayPhone, extractCleanPhone } from '$lib/functions/phoneUtils';
	import { notifications } from '$lib/stores/notificationStore';
	import { goto } from '$app/navigation';
	import type { UserProfile } from '$lib/types/auth';
	import type { Contact } from '$lib/types';

	let users: (UserProfile & { id: string; leadCount?: number })[] = [];
	let loadingUsers = true;
	let contacts: Contact[] = [];
	let unsubscribeUsers: Unsubscribe | null = null;

	// Filtros reactivos
	let searchTerm = '';
	let filterCity = 'all'; // 'all', 'cuu', 'del'
	let filterStatus = 'all'; // 'all', 'active', 'inactive'

	// Modal de creación / edición
	let showModal = false;
	let isEditing = false;
	let editingId: string | null = null;

	let formName = '';
	let formLastname = '';
	let formEmail = '';
	let formPhone = '';
	let formCity = 'cuu';
	let formRole: 'asociado' | 'admin' = 'asociado';
	let formCommission = 42.5;
	let formIsActive = true;
	let isSubmitting = false;

	// Guardia de seguridad: Redirigir si no es administrador
	$: if (!$authLoading && !$isAdmin && $userStore) {
		notifications.warning('Acceso exclusivo para Dirección General y Administradores.');
		goto('/');
	}

	onMount(async () => {
		setupUsersListener();
		await loadContactsCount();
	});

	function setupUsersListener() {
		loadingUsers = true;
		try {
			const usersCol = collection(db, 'users');
			unsubscribeUsers = onSnapshot(
				usersCol,
				(snapshot) => {
					let list = snapshot.docs.map((d) => {
						const data = d.data();
						return {
							id: d.id,
							uid: data.uid || d.id,
							email: data.email || '',
							name: data.name || '',
							lastname: data.lastname || '',
							displayName: data.displayName || `${data.name || ''} ${data.lastname || ''}`.trim() || data.email?.split('@')[0],
							role: data.role || 'asociado',
							city_id: (data.city_id || 'cuu').toLowerCase(),
							phone: data.phone || '',
							isActive: data.isActive !== false,
							commissionRate: data.commissionRate !== undefined ? Number(data.commissionRate) : 42.5,
							createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
						} as UserProfile & { id: string; leadCount?: number };
					});

					// Si la colección está vacía en sandbox, crear entrada de bootstrap visible
					if (list.length === 0 && $userStore) {
						list = [
							{
								id: $userStore.uid,
								uid: $userStore.uid,
								email: $userStore.email || 'marines.enrique@gmail.com',
								displayName: 'Enrique Marines',
								name: 'Enrique',
								lastname: 'Marines',
								role: 'admin',
								city_id: 'cuu',
								phone: '614 275 4512',
								isActive: true,
								commissionRate: 57.5,
								createdAt: Date.now()
							}
						];
					}

					users = list;
					recalculateLeadCounts();
					loadingUsers = false;
				},
				(err) => {
					console.warn('[AdminAsociados] Error escuchando users:', err);
					loadingUsers = false;
				}
			);
		} catch (err) {
			console.error('[AdminAsociados] Error al inicializar:', err);
			loadingUsers = false;
		}
	}

	async function loadContactsCount() {
		try {
			const snap = await getDocs(collection(db, 'contacts'));
			contacts = snap.docs.map((d) => ({
				id: d.id,
				...(d.data() as any)
			}));
			recalculateLeadCounts();
		} catch (e) {
			console.warn('[AdminAsociados] Error cargando conteo de contactos:', e);
		}
	}

	function recalculateLeadCounts() {
		if (users.length === 0 || contacts.length === 0) return;
		users = users.map((u) => {
			const count = contacts.filter((c) => 
				c.associate_id === u.uid || 
				c.associate_id === u.id || 
				(c.associate_name && u.displayName && c.associate_name.toLowerCase().includes(u.name?.toLowerCase() || ''))
			).length;
			return { ...u, leadCount: count };
		});
	}

	onDestroy(() => {
		if (unsubscribeUsers) unsubscribeUsers();
	});

	// Filtrado reactivo en pantalla
	$: filteredUsers = users.filter((u) => {
		if (filterCity !== 'all' && u.city_id !== filterCity) return false;
		if (filterStatus === 'active' && !u.isActive) return false;
		if (filterStatus === 'inactive' && u.isActive) return false;

		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase();
			const full = `${u.name || ''} ${u.lastname || ''} ${u.displayName || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
			if (!full.includes(term)) return false;
		}
		return true;
	});

	// Métricas superiores
	$: totalAssociatesCount = users.filter((u) => u.role === 'asociado').length;
	$: activeAssociatesCount = users.filter((u) => u.role === 'asociado' && u.isActive).length;
	$: cuuCount = users.filter((u) => u.city_id === 'cuu').length;
	$: delCount = users.filter((u) => u.city_id === 'del').length;
	$: totalDistributedLeads = users.reduce((acc, u) => acc + (u.leadCount || 0), 0);

	// Abrir modal de nueva asociada
	function openCreateModal() {
		isEditing = false;
		editingId = null;
		formName = '';
		formLastname = '';
		formEmail = '';
		formPhone = '';
		formCity = 'cuu';
		formRole = 'asociado';
		formCommission = 42.5;
		formIsActive = true;
		showModal = true;
	}

	// Abrir modal de edición
	function openEditModal(u: UserProfile & { id: string }) {
		isEditing = true;
		editingId = u.id || u.uid;
		formName = u.name || '';
		formLastname = u.lastname || '';
		formEmail = u.email || '';
		formPhone = u.phone || '';
		formCity = u.city_id || 'cuu';
		formRole = (u.role as any) || 'asociado';
		formCommission = u.commissionRate !== undefined ? u.commissionRate : 42.5;
		formIsActive = u.isActive !== false;
		showModal = true;
	}

	// Guardar asociada
	async function handleSubmit() {
		if (!formName.trim() || !formEmail.trim()) {
			notifications.warning('Por favor completa nombre y correo electrónico.');
			return;
		}

		isSubmitting = true;
		try {
			const cleanPhone = extractCleanPhone(formPhone);
			const displayName = `${formName.trim()} ${formLastname.trim()}`.trim();

			const payload: any = {
				name: formName.trim(),
				lastname: formLastname.trim(),
				displayName,
				email: formEmail.trim().toLowerCase(),
				phone: cleanPhone ? formatDisplayPhone(cleanPhone) : formPhone.trim(),
				city_id: formCity.toLowerCase(),
				role: formRole,
				commissionRate: Number(formCommission) || 42.5,
				isActive: formIsActive,
				updatedAt: serverTimestamp()
			};

			if (isEditing && editingId) {
				await updateDoc(doc(db, 'users', editingId), payload);
				notifications.success('Datos de la asociada actualizados.');
			} else {
				payload.createdAt = serverTimestamp();
				// Generar un ID único en users
				await addDoc(collection(db, 'users'), payload);
				notifications.success('¡Asociada registrada exitosamente en la red!');
			}

			showModal = false;
		} catch (err) {
			console.error('Error guardando asociada:', err);
			notifications.error('Ocurrió un error al guardar.');
		} finally {
			isSubmitting = false;
		}
	}

	// Toggle rápido de estado Activo/Inactivo
	async function toggleUserStatus(u: UserProfile & { id: string }) {
		const targetId = u.id || u.uid;
		const newStatus = !u.isActive;
		try {
			await updateDoc(doc(db, 'users', targetId), {
				isActive: newStatus,
				updatedAt: serverTimestamp()
			});
			notifications.success(newStatus ? 'Asociada reactivada.' : 'Asociada marcada como inactiva.');
		} catch (err) {
			console.error('Error actualizando estado:', err);
			notifications.error('No se pudo actualizar el estado.');
		}
	}
</script>

<svelte:head>
	<title>Gestión de Asociados | ATAIR CRM</title>
</svelte:head>

<div class="admin-page">
	<!-- Encabezado de Administración -->
	<header class="admin-header">
		<div class="header-main-row">
			<div class="header-title-box">
				<span class="badge-supervision">
					<i class="fa-solid fa-shield-halved"></i> Control Central de Plazas
				</span>
				<h1 class="page-title">
					<i class="fa-solid fa-users-gear title-icon"></i>
					Red de Asociadas Comerciales
				</h1>
				<p class="subtitle">
					Gobierno de plazas exclusivas, comisiones pactadas (57.5% / 42.5%) y supervisión de cartera
				</p>
			</div>

			<div class="header-actions">
				<button class="btn-new-associate" on:click={openCreateModal}>
					<i class="fa-solid fa-user-plus"></i>
					<span>Nueva Asociada</span>
				</button>
			</div>
		</div>

		<!-- KPIs de la Red de Asociados -->
		<div class="admin-kpi-grid">
			<div class="kpi-admin-card">
				<div class="kpi-icon icon-users">
					<i class="fa-solid fa-handshake"></i>
				</div>
				<div class="kpi-details">
					<span class="kpi-lbl">Asociadas Activas</span>
					<span class="kpi-val">{activeAssociatesCount} de {totalAssociatesCount}</span>
					<span class="kpi-sub">Red comercial operando</span>
				</div>
			</div>

			<div class="kpi-admin-card">
				<div class="kpi-icon icon-plazas">
					<i class="fa-solid fa-map-location-dot"></i>
				</div>
				<div class="kpi-details">
					<span class="kpi-lbl">Plazas Cubiertas</span>
					<span class="kpi-val">CUU ({cuuCount}) · DEL ({delCount})</span>
					<span class="kpi-sub">Chihuahua & Delicias</span>
				</div>
			</div>

			<div class="kpi-admin-card">
				<div class="kpi-icon icon-leads">
					<i class="fa-solid fa-users-line"></i>
				</div>
				<div class="kpi-details">
					<span class="kpi-lbl">Leads Asignados</span>
					<span class="kpi-val">{totalDistributedLeads} Prospectos</span>
					<span class="kpi-sub">En seguimiento de campo</span>
				</div>
			</div>

			<div class="kpi-admin-card">
				<div class="kpi-icon icon-split">
					<i class="fa-solid fa-scale-balanced"></i>
				</div>
				<div class="kpi-details">
					<span class="kpi-lbl">Split Oficial</span>
					<span class="kpi-val">57.5% / 42.5%</span>
					<span class="kpi-sub">Match Home / Asociada</span>
				</div>
			</div>
		</div>

		<!-- Barra de Búsqueda y Filtros Rápidos -->
		<div class="filters-bar">
			<div class="search-box">
				<i class="fa-solid fa-magnifying-glass search-ico"></i>
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Buscar por nombre, correo, teléfono..."
					class="search-input"
				/>
				{#if searchTerm}
					<button class="btn-clear-search" on:click={() => (searchTerm = '')}>
						<i class="fa-solid fa-xmark"></i>
					</button>
				{/if}
			</div>

			<div class="pills-row">
				<!-- Filtro de Plaza -->
				<div class="pill-group">
					<span class="filter-lbl">Plaza:</span>
					<button
						class="filter-pill"
						class:active={filterCity === 'all'}
						on:click={() => (filterCity = 'all')}
					>
						Todas
					</button>
					<button
						class="filter-pill"
						class:active={filterCity === 'cuu'}
						on:click={() => (filterCity = 'cuu')}
					>
						Chihuahua (CUU)
					</button>
					<button
						class="filter-pill"
						class:active={filterCity === 'del'}
						on:click={() => (filterCity = 'del')}
					>
						Delicias (DEL)
					</button>
				</div>

				<div class="divider-v"></div>

				<!-- Filtro de Estado -->
				<div class="pill-group">
					<span class="filter-lbl">Estado:</span>
					<button
						class="filter-pill"
						class:active={filterStatus === 'all'}
						on:click={() => (filterStatus = 'all')}
					>
						Todos
					</button>
					<button
						class="filter-pill"
						class:active={filterStatus === 'active'}
						on:click={() => (filterStatus = 'active')}
					>
						Activas
					</button>
					<button
						class="filter-pill"
						class:active={filterStatus === 'inactive'}
						on:click={() => (filterStatus = 'inactive')}
					>
						Inactivas
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Listado de Asociados -->
	{#if loadingUsers}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Cargando padrón de asociadas...</p>
		</div>
	{:else if filteredUsers.length === 0}
		<div class="empty-state">
			<div class="empty-icon-box">
				<i class="fa-solid fa-user-xmark"></i>
			</div>
			<h3>No se encontraron asociadas</h3>
			<p>No hay asociadas que coincidan con los filtros seleccionados.</p>
			<button class="btn-primary-action" on:click={openCreateModal}>
				+ Registrar Primera Asociada
			</button>
		</div>
	{:else}
		<main class="associates-grid">
			{#each filteredUsers as user (user.id || user.uid)}
				{@const isCuu = user.city_id === 'cuu'}
				{@const isAssociate = user.role === 'asociado'}
				<div class="associate-card" class:inactive={!user.isActive}>
					<!-- Cabecera de la Tarjeta -->
					<div class="card-head">
						<div class="avatar-circle" class:admin-avatar={!isAssociate}>
							{user.name?.charAt(0) || user.displayName?.charAt(0) || 'A'}
						</div>

						<div class="name-info">
							<div class="name-row">
								<h3 class="user-fullname">{user.displayName || user.name || 'Sin Nombre'}</h3>
								{#if !user.isActive}
									<span class="inactive-badge">Inactiva</span>
								{/if}
							</div>
							<span class="user-role-badge" class:admin-role={!isAssociate}>
								{#if isAssociate}
									<i class="fa-solid fa-handshake"></i> Asociada Comercial
								{:else}
									<i class="fa-solid fa-crown"></i> Dirección General
								{/if}
							</span>
						</div>

						<!-- Badges de Plaza y Comisión -->
						<div class="plaza-pill" class:del-pill={!isCuu}>
							<i class="fa-solid fa-location-dot"></i>
							{isCuu ? 'CUU' : 'DEL'}
						</div>
					</div>

					<!-- Datos de Contacto y Métricas -->
					<div class="card-body">
						<div class="data-row">
							<i class="fa-solid fa-envelope row-ico"></i>
							<span class="data-text" title={user.email}>{user.email}</span>
						</div>

						{#if user.phone}
							<div class="data-row">
								<i class="fa-solid fa-phone row-ico"></i>
								<span class="data-text font-mono">{formatDisplayPhone(user.phone)}</span>
								<div class="contact-quick-links">
									<a href="tel:{user.phone}" class="quick-call-btn" title="Llamar">
										<i class="fa-solid fa-phone"></i>
									</a>
									<a
										href="https://wa.me/52{extractCleanPhone(user.phone)}"
										target="_blank"
										rel="noopener noreferrer"
										class="quick-wa-btn"
										title="WhatsApp"
									>
										<i class="fa-brands fa-whatsapp"></i>
									</a>
								</div>
							</div>
						{/if}

						<div class="metrics-subrow">
							<div class="metric-pill">
								<span class="m-lbl">Comisión:</span>
								<strong class="m-val">{user.commissionRate || 42.5}%</strong>
							</div>

							<div class="metric-pill">
								<span class="m-lbl">Cartera:</span>
								<strong class="m-val">{user.leadCount || 0} Leads</strong>
							</div>
						</div>
					</div>

					<!-- Pie de Acciones de la Tarjeta -->
					<div class="card-footer">
						<button
							type="button"
							class="btn-edit-user"
							on:click={() => openEditModal(user)}
						>
							<i class="fa-solid fa-pen-to-square"></i>
							<span>Editar</span>
						</button>

						<button
							type="button"
							class="btn-toggle-status"
							class:activate-btn={!user.isActive}
							on:click={() => toggleUserStatus(user)}
						>
							<i class="fa-solid {user.isActive ? 'fa-user-slash' : 'fa-user-check'}"></i>
							<span>{user.isActive ? 'Desactivar' : 'Activar'}</span>
						</button>

						<a
							href="/contacts"
							class="btn-view-leads"
							title="Supervisar cartera en Contacts"
						>
							<i class="fa-solid fa-address-book"></i>
							<span>Cartera</span>
						</a>
					</div>
				</div>
			{/each}
		</main>
	{/if}

	<!-- Modal de Creación / Edición de Asociada -->
	{#if showModal}
		<div class="modal-backdrop" role="presentation" on:click={() => (showModal = false)}>
			<div class="modal-card" role="dialog" aria-modal="true" on:click|stopPropagation tabindex="-1">
				<div class="modal-header">
					<h3>
						<i class="fa-solid {isEditing ? 'fa-user-pen' : 'fa-user-plus'} modal-ico"></i>
						{isEditing ? 'Editar Datos de la Asociada' : 'Dar de Alta Nueva Asociada'}
					</h3>
					<button class="btn-close-modal" on:click={() => (showModal = false)}>
						<i class="fa-solid fa-xmark"></i>
					</button>
				</div>

				<form on:submit|preventDefault={handleSubmit} class="modal-form">
					<div class="form-row-2">
						<div class="form-group">
							<label for="form-name-input" class="form-label">Nombre(s): *</label>
							<input
								id="form-name-input"
								type="text"
								bind:value={formName}
								placeholder="Ej. Laura"
								class="form-input"
								required
							/>
						</div>
						<div class="form-group">
							<label for="form-lastname-input" class="form-label">Apellidos:</label>
							<input
								id="form-lastname-input"
								type="text"
								bind:value={formLastname}
								placeholder="Ej. González"
								class="form-input"
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="form-email-input" class="form-label">Correo Electrónico (Login): *</label>
						<input
							id="form-email-input"
							type="email"
							bind:value={formEmail}
							placeholder="ejemplo@matchhome.net"
							class="form-input"
							required
						/>
					</div>

					<div class="form-group">
						<label for="form-phone-input" class="form-label">Teléfono Móvil (WhatsApp):</label>
						<input
							id="form-phone-input"
							type="tel"
							bind:value={formPhone}
							placeholder="Ej. 614 275 4512"
							class="form-input"
						/>
					</div>

					<div class="form-row-2">
						<div class="form-group">
							<label for="form-city-select" class="form-label">Plaza Asignada: *</label>
							<select id="form-city-select" bind:value={formCity} class="form-select">
								<option value="cuu">Chihuahua Capital (CUU)</option>
								<option value="del">Cd. Delicias (DEL)</option>
							</select>
						</div>

						<div class="form-group">
							<label for="form-role-select" class="form-label">Rol Operativo: *</label>
							<select id="form-role-select" bind:value={formRole} class="form-select">
								<option value="asociado">Asociada Comercial</option>
								<option value="admin">Administrador (Dirección)</option>
							</select>
						</div>
					</div>

					<div class="form-row-2">
						<div class="form-group">
							<label for="form-commission-input" class="form-label">Comisión de la Asociada (%):</label>
							<input
								id="form-commission-input"
								type="number"
								step="0.5"
								bind:value={formCommission}
								placeholder="42.5"
								class="form-input"
							/>
							<span class="field-hint">Match Home retiene el 57.5% de soporte.</span>
						</div>

						<div class="form-group switch-group">
							<label class="form-label">Estado de Acceso:</label>
							<label class="toggle-switch-lbl">
								<input type="checkbox" bind:checked={formIsActive} />
								<span class="toggle-text">{formIsActive ? 'Activa con acceso' : 'Acceso suspendido'}</span>
							</label>
						</div>
					</div>

					<div class="modal-footer">
						<button
							type="button"
							class="btn-cancel-modal"
							on:click={() => (showModal = false)}
						>
							Cancelar
						</button>
						<button
							type="submit"
							class="btn-submit-modal"
							disabled={isSubmitting}
						>
							<i class="fa-solid fa-check"></i>
							<span>{isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Registrar Asociada')}</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.admin-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem 1rem;
		box-sizing: border-box;
	}

	.admin-header {
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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

	.badge-supervision {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.35);
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.65rem;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		width: fit-content;
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
		color: #c084fc;
		font-size: 1.3rem;
	}

	.subtitle {
		font-size: 0.85rem;
		color: #a1a1aa;
		margin: 0;
	}

	.btn-new-associate {
		background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 0.65rem 1.2rem;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-new-associate:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(168, 85, 247, 0.45);
	}

	/* KPI Grid */
	.admin-kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.kpi-admin-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.kpi-icon {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.icon-users {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
	}

	.icon-plazas {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}

	.icon-leads {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}

	.icon-split {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.kpi-details {
		display: flex;
		flex-direction: column;
	}

	.kpi-lbl {
		font-size: 0.72rem;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.kpi-val {
		font-size: 1.2rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0.15rem 0;
	}

	.kpi-sub {
		font-size: 0.72rem;
		color: #71717a;
	}

	/* Barra de Filtros */
	.filters-bar {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: center;
		background: #18181b;
		padding: 0.75rem 1rem;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	@media (max-width: 860px) {
		.filters-bar {
			grid-template-columns: 1fr;
		}
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-ico {
		position: absolute;
		left: 0.85rem;
		color: #71717a;
		font-size: 0.85rem;
	}

	.search-input {
		width: 100%;
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		padding: 0.55rem 2.2rem;
		color: #ffffff;
		font-size: 0.85rem;
		outline: none;
		box-sizing: border-box;
	}

	.search-input:focus {
		border-color: #a855f7;
	}

	.btn-clear-search {
		position: absolute;
		right: 0.6rem;
		background: transparent;
		border: none;
		color: #71717a;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.pills-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.pill-group {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.filter-lbl {
		font-size: 0.72rem;
		font-weight: 700;
		color: #71717a;
		text-transform: uppercase;
		margin-right: 0.2rem;
	}

	.filter-pill {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.3rem 0.65rem;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-pill:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.filter-pill.active {
		background: #a855f7;
		color: #ffffff;
		font-weight: 700;
		border-color: #a855f7;
	}

	.divider-v {
		width: 1px;
		height: 18px;
		background: rgba(255, 255, 255, 0.12);
		flex-shrink: 0;
	}

	/* Grilla de Asociados */
	.associates-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.25rem;
	}

	.associate-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.associate-card:hover {
		border-color: rgba(168, 85, 247, 0.35);
		transform: translateY(-2px);
	}

	.associate-card.inactive {
		opacity: 0.6;
		border-style: dashed;
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.avatar-circle {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: linear-gradient(135deg, #0cbff6 0%, #0284c7 100%);
		color: #000000;
		font-size: 1.15rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.avatar-circle.admin-avatar {
		background: linear-gradient(135deg, #c084fc 0%, #7e22ce 100%);
		color: #ffffff;
	}

	.name-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		flex-grow: 1;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.user-fullname {
		font-size: 1.05rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.inactive-badge {
		font-size: 0.65rem;
		font-weight: 800;
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.4);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.user-role-badge {
		font-size: 0.7rem;
		font-weight: 700;
		color: #38bdf8;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.user-role-badge.admin-role {
		color: #c084fc;
	}

	.plaza-pill {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.35);
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.55rem;
		border-radius: 6px;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.plaza-pill.del-pill {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
		border-color: rgba(245, 158, 11, 0.35);
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.data-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		color: #d4d4d8;
	}

	.row-ico {
		color: #71717a;
		font-size: 0.75rem;
		width: 14px;
	}

	.data-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.font-mono {
		font-family: monospace;
		font-weight: 600;
	}

	.contact-quick-links {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: auto;
	}

	.quick-call-btn,
	.quick-wa-btn {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		font-size: 0.72rem;
		transition: background 0.15s ease;
	}

	.quick-call-btn {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
	}

	.quick-wa-btn {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.metrics-subrow {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-top: 0.35rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.metric-pill {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.35rem 0.6rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
	}

	.m-lbl {
		color: #71717a;
	}

	.m-val {
		color: #ffffff;
		font-weight: 700;
	}

	/* Card Footer */
	.card-footer {
		margin-top: auto;
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.4rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.btn-edit-user,
	.btn-toggle-status,
	.btn-view-leads {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #e4e4e7;
		padding: 0.4rem 0.3rem;
		border-radius: 6px;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.btn-edit-user:hover {
		background: rgba(168, 85, 247, 0.2);
		border-color: #a855f7;
		color: #ffffff;
	}

	.btn-toggle-status:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: #ef4444;
		color: #f87171;
	}

	.btn-toggle-status.activate-btn {
		color: #34d399;
	}

	.btn-toggle-status.activate-btn:hover {
		background: rgba(16, 185, 129, 0.2);
		border-color: #10b981;
	}

	.btn-view-leads:hover {
		background: rgba(12, 191, 246, 0.2);
		border-color: #0cbff6;
		color: #ffffff;
	}

	/* Modal Form */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 1rem;
		box-sizing: border-box;
	}

	.modal-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		width: 100%;
		max-width: 520px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		font-size: 1.15rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-ico {
		color: #a855f7;
	}

	.btn-close-modal {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	.modal-form {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-row-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	@media (max-width: 500px) {
		.form-row-2 {
			grid-template-columns: 1fr;
		}
	}

	.form-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: #a1a1aa;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.form-input,
	.form-select {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.65rem 0.85rem;
		color: #ffffff;
		font-size: 0.88rem;
		outline: none;
		box-sizing: border-box;
	}

	.form-input:focus,
	.form-select:focus {
		border-color: #a855f7;
	}

	.field-hint {
		font-size: 0.72rem;
		color: #71717a;
	}

	.switch-group {
		justify-content: center;
	}

	.toggle-switch-lbl {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
	}

	.toggle-text {
		font-size: 0.82rem;
		color: #ffffff;
		font-weight: 600;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.btn-cancel-modal {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #a1a1aa;
		padding: 0.6rem 1.1rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-submit-modal {
		background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
		color: #ffffff;
		border: none;
		padding: 0.6rem 1.25rem;
		border-radius: 6px;
		font-size: 0.88rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.btn-submit-modal:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Estados de Carga y Vacío */
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
		border-top-color: #a855f7;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
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
		max-width: 380px;
		margin: 0 0 1.25rem 0;
	}

	.btn-primary-action {
		background: #a855f7;
		color: #ffffff;
		border: none;
		padding: 0.55rem 1.25rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}
</style>
