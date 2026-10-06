<!-- src/routes/agenda/+page.svelte -->
<!-- Agenda Móvil & Compromisos en Tiempo Real - ATAIR CRM -->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		collection,
		query,
		where,
		orderBy,
		onSnapshot,
		getDocs,
		addDoc,
		updateDoc,
		deleteDoc,
		doc,
		serverTimestamp,
		type Unsubscribe
	} from 'firebase/firestore';
	import { db } from '$lib/firebase/config';
	import { userStore, userProfile, isAdmin, isAsociado } from '$lib/firebase/authManager';
	import { formatDisplayPhone } from '$lib/functions/phoneUtils';
	import { notifications } from '$lib/stores/notificationStore';
	import type { Todo, Contact } from '$lib/types';

	let todos: Todo[] = [];
	let loadingTodos = true;
	let contacts: Contact[] = [];
	let loadingContacts = true;

	let unsubscribeTodos: Unsubscribe | null = null;

	// Filtros reactivos
	let selectedTypeFilter: 'ALL' | 'Llamada' | 'Visita' | 'Cita' | 'Trámite' = 'ALL';
	let hideCompleted = false;
	let selectedAdvisor = 'all';

	// Estado del modal de crear / editar
	let showModal = false;
	let isEditing = false;
	let editingId: string | null = null;

	let formTitle = '';
	let formType: 'Llamada' | 'Visita' | 'Cita' | 'Trámite' | 'General' = 'Llamada';
	let formDate = ''; // YYYY-MM-DD
	let formTime = ''; // HH:MM
	let formNotes = '';
	let formContactId = '';
	let formContactName = '';
	let formContactPhone = '';
	let isSubmitting = false;

	// Inicializar fecha por defecto en hoy
	function getTodayDateString(): string {
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const d = String(now.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function getTomorrowDateString(): string {
		const tom = new Date();
		tom.setDate(tom.getDate() + 1);
		const y = tom.getFullYear();
		const m = String(tom.getMonth() + 1).padStart(2, '0');
		const d = String(tom.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	$: currentUid = $userProfile?.uid || $userStore?.uid;

	// Iniciar listener reactivo cuando haya sesión
	$: if (currentUid !== undefined) {
		setupTodosListener();
		loadContacts();
	}

	function setupTodosListener() {
		if (unsubscribeTodos) {
			unsubscribeTodos();
			unsubscribeTodos = null;
		}

		loadingTodos = true;
		const uid = currentUid;

		try {
			const todosCol = collection(db, 'todos');
			let q;

			if ($isAdmin) {
				try {
					q = query(todosCol, orderBy('endTask', 'asc'));
				} catch {
					q = query(todosCol);
				}
			} else if (uid) {
				q = query(todosCol, where('associate_id', '==', uid));
			} else {
				q = query(todosCol);
			}

			unsubscribeTodos = onSnapshot(
				q,
				(snapshot) => {
					let list = snapshot.docs.map((d) => {
						const data = d.data();
						return {
							id: d.id,
							task: data.task || data.title || 'Compromiso sin título',
							endTask: Number(data.endTask || data.dueDate || Date.now()),
							timeString: data.timeString || data.timeTask || '',
							notes: data.notes || data.description || '',
							isCompleted: Boolean(data.isCompleted || data.completed),
							createdAt: Number(data.createdAt || Date.now()),
							type: data.type || 'Llamada',
							user: data.user || '',
							associate_id: data.associate_id || '',
							associate_name: data.associate_name || '',
							contactId: data.contactId || '',
							contactName: data.contactName || '',
							contactPhone: data.contactPhone || '',
							source: data.source || 'crm'
						} as Todo;
					});

					// Fallback si la consulta de asociado devuelve 0 por datos previos sin associate_id
					if (!$isAdmin && list.length === 0) {
						getDocs(query(todosCol)).then((fbSnap) => {
							if (list.length === 0 && !fbSnap.empty) {
								todos = fbSnap.docs.map((d) => {
									const data = d.data();
									return {
										id: d.id,
										task: data.task || data.title || 'Compromiso',
										endTask: Number(data.endTask || Date.now()),
										timeString: data.timeString || '',
										notes: data.notes || '',
										isCompleted: Boolean(data.isCompleted),
										createdAt: Number(data.createdAt || Date.now()),
										type: data.type || 'Llamada'
									} as Todo;
								}).sort((a, b) => a.endTask - b.endTask);
							}
						}).catch(() => {});
					}

					todos = list.sort((a, b) => a.endTask - b.endTask);
					loadingTodos = false;
				},
				(err) => {
					console.warn('[Agenda] Error en listener, aplicando fallback:', err);
					getDocs(query(collection(db, 'todos')))
						.then((fb) => {
							todos = fb.docs.map((d) => ({
								id: d.id,
								...(d.data() as any)
							} as Todo)).sort((a, b) => (Number(a.endTask) || 0) - (Number(b.endTask) || 0));
							loadingTodos = false;
						})
						.catch(() => {
							loadingTodos = false;
						});
				}
			);
		} catch (err) {
			console.error('[Agenda] Error configurando listener:', err);
			loadingTodos = false;
		}
	}

	async function loadContacts() {
		loadingContacts = true;
		try {
			const uid = currentUid;
			let q;
			if ($isAdmin) {
				q = query(collection(db, 'contacts'));
			} else if (uid) {
				q = query(collection(db, 'contacts'), where('associate_id', '==', uid));
			} else {
				q = query(collection(db, 'contacts'));
			}
			const snap = await getDocs(q);
			contacts = snap.docs.map((d) => ({
				id: d.id,
				...(d.data() as any)
			}));
		} catch (err) {
			console.warn('[Agenda] Error cargando contactos para formulario:', err);
		} finally {
			loadingContacts = false;
		}
	}

	onDestroy(() => {
		if (unsubscribeTodos) unsubscribeTodos();
	});

	// Asesores únicos para filtro admin
	$: advisorsList = Array.from(
		new Set(todos.map((t) => t.associate_name || t.user).filter(Boolean))
	);

	// Tareas filtradas por tipo, asesor y estado
	$: filteredTodos = todos.filter((t) => {
		if (hideCompleted && t.isCompleted) return false;
		if (selectedTypeFilter !== 'ALL' && t.type !== selectedTypeFilter) return false;
		if ($isAdmin && selectedAdvisor !== 'all') {
			if ((t.associate_name || t.user) !== selectedAdvisor) return false;
		}
		return true;
	});

	// Fechas de referencia local
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const endOfToday = startOfToday + 86400000 - 1;
	const endOfTomorrow = endOfToday + 86400000;

	// Agrupación cronológica inteligente
	$: overdueTodos = filteredTodos.filter((t) => !t.isCompleted && t.endTask < startOfToday);
	$: todayTodos = filteredTodos.filter((t) => t.endTask >= startOfToday && t.endTask <= endOfToday);
	$: tomorrowTodos = filteredTodos.filter((t) => t.endTask > endOfToday && t.endTask <= endOfTomorrow);
	$: upcomingTodos = filteredTodos.filter((t) => t.endTask > endOfTomorrow);

	// Conteos rápidos
	$: totalPendingCount = todos.filter((t) => !t.isCompleted).length;
	$: todayPendingCount = todos.filter((t) => !t.isCompleted && t.endTask >= startOfToday && t.endTask <= endOfToday).length;

	// Marcar tarea completada en 1 toque
	async function toggleTodo(todoItem: Todo) {
		const newStatus = !todoItem.isCompleted;
		try {
			await updateDoc(doc(db, 'todos', todoItem.id), {
				isCompleted: newStatus,
				completedAt: newStatus ? Date.now() : null
			});
			if (newStatus) {
				notifications.success('¡Compromiso completado!');
			}
		} catch (err) {
			console.error('Error al actualizar tarea:', err);
			notifications.error('No se pudo actualizar el compromiso.');
		}
	}

	// Eliminar tarea
	async function deleteTodo(id: string) {
		if (!confirm('¿Deseas eliminar este compromiso de la agenda?')) return;
		try {
			await deleteDoc(doc(db, 'todos', id));
			notifications.success('Compromiso eliminado.');
		} catch (err) {
			console.error('Error al eliminar tarea:', err);
			notifications.error('No se pudo eliminar el compromiso.');
		}
	}

	// Abrir modal de creación
	function openCreateModal(defaultDate?: string) {
		isEditing = false;
		editingId = null;
		formTitle = '';
		formType = 'Llamada';
		formDate = defaultDate || getTodayDateString();
		formTime = '10:00';
		formNotes = '';
		formContactId = '';
		formContactName = '';
		formContactPhone = '';
		showModal = true;
	}

	// Abrir modal de edición
	function openEditModal(t: Todo) {
		isEditing = true;
		editingId = t.id;
		formTitle = t.task;
		formType = (t.type as any) || 'Llamada';
		
		const d = new Date(t.endTask);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		formDate = `${y}-${m}-${day}`;
		
		formTime = t.timeString || '';
		formNotes = t.notes || '';
		formContactId = t.contactId || '';
		formContactName = t.contactName || '';
		formContactPhone = t.contactPhone || '';
		showModal = true;
	}

	function handleContactSelect(e: Event) {
		const id = (e.target as HTMLSelectElement).value;
		formContactId = id;
		const found = contacts.find((c) => c.id === id);
		if (found) {
			formContactName = `${found.name || ''} ${found.lastname || ''}`.trim() || found.fullName || '';
			formContactPhone = found.telephon || '';
			if (!formTitle.trim()) {
				formTitle = `${formType}: ${formContactName}`;
			}
		} else {
			formContactName = '';
			formContactPhone = '';
		}
	}

	// Guardar tarea
	async function handleSubmit() {
		if (!formTitle.trim()) {
			notifications.warning('Por favor escribe el título del compromiso.');
			return;
		}
		if (!formDate) {
			notifications.warning('Por favor selecciona la fecha.');
			return;
		}

		isSubmitting = true;

		try {
			// Calcular timestamp Unix
			const [y, m, d] = formDate.split('-').map(Number);
			let h = 12;
			let min = 0;
			if (formTime) {
				const [hStr, mStr] = formTime.split(':').map(Number);
				if (!isNaN(hStr)) h = hStr;
				if (!isNaN(mStr)) min = mStr;
			}
			const targetDate = new Date(y, m - 1, d, h, min, 0, 0);
			const endTaskTimestamp = targetDate.getTime();

			const payload: any = {
				task: formTitle.trim(),
				type: formType,
				endTask: endTaskTimestamp,
				timeString: formTime || '',
				notes: formNotes.trim(),
				associate_id: currentUid || '',
				associate_name: $userProfile?.name || $userProfile?.displayName || 'Asesor',
				user: $userProfile?.displayName || $userStore?.email || 'Asesor',
				contactId: formContactId || '',
				contactName: formContactName || '',
				contactPhone: formContactPhone || '',
				updatedAt: serverTimestamp()
			};

			if (isEditing && editingId) {
				await updateDoc(doc(db, 'todos', editingId), payload);
				notifications.success('Compromiso actualizado con éxito.');
			} else {
				payload.isCompleted = false;
				payload.createdAt = Date.now();
				payload.source = 'crm';
				const docRef = await addDoc(collection(db, 'todos'), payload);

				// Si está vinculado a un contacto, registrar en su bitácora
				if (formContactId) {
					try {
						await addDoc(collection(db, 'binnacles'), {
							contactId: formContactId,
							tipo: formType.toLowerCase(),
							descripcion: `Agendado compromiso: ${formTitle} para el ${formDate} ${formTime ? `a las ${formTime}` : ''}`,
							fecha: new Date(),
							date: Date.now(),
							author: payload.user,
							action: 'Agenda de cita/llamada'
						});
					} catch (e) {
						console.warn('Bitácora vinculada no pudo guardarse:', e);
					}
				}

				notifications.success('¡Compromiso agendado con éxito!');
			}

			showModal = false;
		} catch (err) {
			console.error('Error al guardar compromiso:', err);
			notifications.error('Ocurrió un error al guardar.');
		} finally {
			isSubmitting = false;
		}
	}

	function formatTimeFriendly(timeStr?: string): string {
		if (!timeStr) return 'Todo el día';
		const [hStr, mStr] = timeStr.split(':');
		let h = parseInt(hStr, 10);
		const m = parseInt(mStr, 10);
		if (isNaN(h) || isNaN(m)) return timeStr;
		const period = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${String(m).padStart(2, '0')} ${period}`;
	}

	function formatDateFriendly(timestamp: number): string {
		const d = new Date(timestamp);
		const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
		return d.toLocaleDateString('es-MX', options);
	}
</script>

<svelte:head>
	<title>Agenda & Citas | ATAIR CRM</title>
</svelte:head>

<div class="agenda-page">
	<!-- Encabezado de Agenda -->
	<header class="agenda-header">
		<div class="header-main-row">
			<div class="header-title-box">
				<h1 class="page-title">
					<i class="fa-solid fa-calendar-check title-icon"></i>
					Agenda & Citas
				</h1>
				<p class="subtitle">
					Seguimiento diario de llamadas D1, visitas de inmuebles y compromisos comerciales
				</p>
			</div>

			<div class="header-actions">
				<button class="btn-new-todo" on:click={() => openCreateModal()}>
					<i class="fa-solid fa-plus"></i>
					<span>Nuevo Compromiso</span>
				</button>
			</div>
		</div>

		<!-- Resumen de Métricas de la Agenda -->
		<div class="agenda-kpi-bar">
			<div class="kpi-mini-card">
				<span class="kpi-mini-val">{todayPendingCount}</span>
				<span class="kpi-mini-lbl">Pendientes Hoy</span>
			</div>
			<div class="kpi-mini-card">
				<span class="kpi-mini-val">{totalPendingCount}</span>
				<span class="kpi-mini-lbl">Total por Atender</span>
			</div>
			{#if overdueTodos.length > 0}
				<div class="kpi-mini-card alert-card">
					<span class="kpi-mini-val">{overdueTodos.length}</span>
					<span class="kpi-mini-lbl">Vencidas / Urgentes</span>
				</div>
			{/if}
		</div>

		<!-- Filtros Rápidos Tipo Píldora -->
		<div class="filters-pills-row">
			<div class="pills-group">
				<button
					class="filter-pill"
					class:active={selectedTypeFilter === 'ALL'}
					on:click={() => (selectedTypeFilter = 'ALL')}
				>
					Todos
				</button>
				<button
					class="filter-pill"
					class:active={selectedTypeFilter === 'Llamada'}
					on:click={() => (selectedTypeFilter = 'Llamada')}
				>
					<i class="fa-solid fa-phone"></i> Llamadas
				</button>
				<button
					class="filter-pill"
					class:active={selectedTypeFilter === 'Visita'}
					on:click={() => (selectedTypeFilter = 'Visita')}
				>
					<i class="fa-solid fa-house"></i> Visitas
				</button>
				<button
					class="filter-pill"
					class:active={selectedTypeFilter === 'Cita'}
					on:click={() => (selectedTypeFilter = 'Cita')}
				>
					<i class="fa-solid fa-handshake"></i> Citas
				</button>
				<button
					class="filter-pill"
					class:active={selectedTypeFilter === 'Trámite'}
					on:click={() => (selectedTypeFilter = 'Trámite')}
				>
					<i class="fa-solid fa-file-signature"></i> Trámites
				</button>
			</div>

			<div class="filters-right-group">
				{#if $isAdmin && advisorsList.length > 0}
					<select bind:value={selectedAdvisor} class="advisor-filter-select">
						<option value="all">Todas las Asociadas ({advisorsList.length})</option>
						{#each advisorsList as adv}
							<option value={adv}>{adv}</option>
						{/each}
					</select>
				{/if}

				<label class="hide-completed-toggle">
					<input type="checkbox" bind:checked={hideCompleted} />
					<span>Ocultar completadas</span>
				</label>
			</div>
		</div>
	</header>

	<!-- Contenido Principal -->
	{#if loadingTodos}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Cargando tu agenda de compromisos...</p>
		</div>
	{:else if filteredTodos.length === 0}
		<div class="empty-state">
			<div class="empty-icon-box">
				<i class="fa-solid fa-calendar-plus"></i>
			</div>
			<h3>Sin compromisos en este criterio</h3>
			<p>¡Excelente! Tu agenda está al día. Puedes registrar una nueva visita o llamada de seguimiento.</p>
			<button class="btn-empty-action" on:click={() => openCreateModal()}>
				+ Agendar Compromiso
			</button>
		</div>
	{:else}
		<main class="timeline-container">
			<!-- 🚨 Sección: Vencidas / Urgentes -->
			{#if overdueTodos.length > 0}
				<section class="time-block overdue-block">
					<div class="block-header">
						<h2 class="block-title overdue-title">
							<i class="fa-solid fa-triangle-exclamation"></i>
							Compromisos Vencidos / Rezagados ({overdueTodos.length})
						</h2>
						<span class="block-sub">Requieren atención inmediata</span>
					</div>

					<div class="todos-cards-grid">
						{#each overdueTodos as todoItem (todoItem.id)}
							<div class="todo-card overdue-card" class:completed={todoItem.isCompleted}>
								<div class="card-left-col">
									<button
										type="button"
										class="check-btn"
										class:checked={todoItem.isCompleted}
										on:click={() => toggleTodo(todoItem)}
										title="Marcar completado"
									>
										{#if todoItem.isCompleted}
											<i class="fa-solid fa-check"></i>
										{/if}
									</button>
								</div>

								<div class="card-main-col">
									<div class="card-top-meta">
										<span class="type-badge badge-{todoItem.type?.toLowerCase() || 'llamada'}">
											{todoItem.type || 'Compromiso'}
										</span>
										<span class="date-badge overdue-date">
											<i class="fa-solid fa-clock"></i>
											{formatDateFriendly(todoItem.endTask)} {formatTimeFriendly(todoItem.timeString)}
										</span>
									</div>

									<h3 class="todo-title">{todoItem.task}</h3>

									{#if todoItem.notes}
										<p class="todo-notes">{todoItem.notes}</p>
									{/if}

									{#if todoItem.contactName || todoItem.contactPhone}
										<div class="todo-contact-box">
											<div class="contact-info-sub">
												<i class="fa-solid fa-user-tag"></i>
												<strong>{todoItem.contactName || 'Cliente'}</strong>
												{#if todoItem.contactPhone}
													<span>({formatDisplayPhone(todoItem.contactPhone)})</span>
												{/if}
											</div>
											{#if todoItem.contactPhone}
												<div class="contact-actions-sub">
													<a href="tel:{todoItem.contactPhone}" class="sub-btn-call" title="Llamar">
														<i class="fa-solid fa-phone"></i>
													</a>
													<a
														href="https://wa.me/52{String(todoItem.contactPhone).replace(/\D/g, '')}"
														target="_blank"
														rel="noopener noreferrer"
														class="sub-btn-wa"
														title="WhatsApp"
													>
														<i class="fa-brands fa-whatsapp"></i>
													</a>
												</div>
											{/if}
										</div>
									{/if}
								</div>

								<div class="card-actions-col">
									<button type="button" class="btn-card-edit" on:click={() => openEditModal(todoItem)} title="Editar">
										<i class="fa-solid fa-pen-to-square"></i>
									</button>
									<button type="button" class="btn-card-del" on:click={() => deleteTodo(todoItem.id)} title="Eliminar">
										<i class="fa-solid fa-trash-can"></i>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 🟢 Sección: Hoy -->
			{#if todayTodos.length > 0}
				<section class="time-block today-block">
					<div class="block-header">
						<h2 class="block-title today-title">
							<i class="fa-solid fa-calendar-day"></i>
							Compromisos para Hoy ({todayTodos.length})
						</h2>
						<span class="block-sub">Ruta de trabajo de la jornada</span>
					</div>

					<div class="todos-cards-grid">
						{#each todayTodos as todoItem (todoItem.id)}
							<div class="todo-card" class:completed={todoItem.isCompleted}>
								<div class="card-left-col">
									<button
										type="button"
										class="check-btn"
										class:checked={todoItem.isCompleted}
										on:click={() => toggleTodo(todoItem)}
										title="Marcar completado"
									>
										{#if todoItem.isCompleted}
											<i class="fa-solid fa-check"></i>
										{/if}
									</button>
								</div>

								<div class="card-main-col">
									<div class="card-top-meta">
										<span class="type-badge badge-{todoItem.type?.toLowerCase() || 'llamada'}">
											{todoItem.type || 'Compromiso'}
										</span>
										<span class="date-badge">
											<i class="fa-solid fa-clock"></i>
											{formatTimeFriendly(todoItem.timeString)}
										</span>
										{#if todoItem.associate_name && $isAdmin}
											<span class="advisor-badge">
												<i class="fa-solid fa-user-check"></i> {todoItem.associate_name}
											</span>
										{/if}
									</div>

									<h3 class="todo-title">{todoItem.task}</h3>

									{#if todoItem.notes}
										<p class="todo-notes">{todoItem.notes}</p>
									{/if}

									{#if todoItem.contactName || todoItem.contactPhone}
										<div class="todo-contact-box">
											<div class="contact-info-sub">
												<i class="fa-solid fa-user-tag"></i>
												<strong>{todoItem.contactName || 'Cliente'}</strong>
												{#if todoItem.contactPhone}
													<span>({formatDisplayPhone(todoItem.contactPhone)})</span>
												{/if}
											</div>
											{#if todoItem.contactPhone}
												<div class="contact-actions-sub">
													<a href="tel:{todoItem.contactPhone}" class="sub-btn-call" title="Llamar">
														<i class="fa-solid fa-phone"></i>
													</a>
													<a
														href="https://wa.me/52{String(todoItem.contactPhone).replace(/\D/g, '')}"
														target="_blank"
														rel="noopener noreferrer"
														class="sub-btn-wa"
														title="WhatsApp"
													>
														<i class="fa-brands fa-whatsapp"></i>
													</a>
												</div>
											{/if}
										</div>
									{/if}
								</div>

								<div class="card-actions-col">
									<button type="button" class="btn-card-edit" on:click={() => openEditModal(todoItem)} title="Editar">
										<i class="fa-solid fa-pen-to-square"></i>
									</button>
									<button type="button" class="btn-card-del" on:click={() => deleteTodo(todoItem.id)} title="Eliminar">
										<i class="fa-solid fa-trash-can"></i>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 🔵 Sección: Mañana -->
			{#if tomorrowTodos.length > 0}
				<section class="time-block tomorrow-block">
					<div class="block-header">
						<h2 class="block-title">
							<i class="fa-solid fa-sun"></i>
							Mañana ({tomorrowTodos.length})
						</h2>
						<span class="block-sub">Preparar visitas y expedientes</span>
					</div>

					<div class="todos-cards-grid">
						{#each tomorrowTodos as todoItem (todoItem.id)}
							<div class="todo-card" class:completed={todoItem.isCompleted}>
								<div class="card-left-col">
									<button
										type="button"
										class="check-btn"
										class:checked={todoItem.isCompleted}
										on:click={() => toggleTodo(todoItem)}
										title="Marcar completado"
									>
										{#if todoItem.isCompleted}
											<i class="fa-solid fa-check"></i>
										{/if}
									</button>
								</div>

								<div class="card-main-col">
									<div class="card-top-meta">
										<span class="type-badge badge-{todoItem.type?.toLowerCase() || 'llamada'}">
											{todoItem.type || 'Compromiso'}
										</span>
										<span class="date-badge">
											<i class="fa-solid fa-clock"></i>
											{formatTimeFriendly(todoItem.timeString)}
										</span>
									</div>

									<h3 class="todo-title">{todoItem.task}</h3>

									{#if todoItem.notes}
										<p class="todo-notes">{todoItem.notes}</p>
									{/if}

									{#if todoItem.contactName || todoItem.contactPhone}
										<div class="todo-contact-box">
											<div class="contact-info-sub">
												<i class="fa-solid fa-user-tag"></i>
												<strong>{todoItem.contactName || 'Cliente'}</strong>
												{#if todoItem.contactPhone}
													<span>({formatDisplayPhone(todoItem.contactPhone)})</span>
												{/if}
											</div>
											{#if todoItem.contactPhone}
												<div class="contact-actions-sub">
													<a href="tel:{todoItem.contactPhone}" class="sub-btn-call" title="Llamar">
														<i class="fa-solid fa-phone"></i>
													</a>
													<a
														href="https://wa.me/52{String(todoItem.contactPhone).replace(/\D/g, '')}"
														target="_blank"
														rel="noopener noreferrer"
														class="sub-btn-wa"
														title="WhatsApp"
													>
														<i class="fa-brands fa-whatsapp"></i>
													</a>
												</div>
											{/if}
										</div>
									{/if}
								</div>

								<div class="card-actions-col">
									<button type="button" class="btn-card-edit" on:click={() => openEditModal(todoItem)} title="Editar">
										<i class="fa-solid fa-pen-to-square"></i>
									</button>
									<button type="button" class="btn-card-del" on:click={() => deleteTodo(todoItem.id)} title="Eliminar">
										<i class="fa-solid fa-trash-can"></i>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- ⚪ Sección: Próximos / Esta Semana -->
			{#if upcomingTodos.length > 0}
				<section class="time-block upcoming-block">
					<div class="block-header">
						<h2 class="block-title">
							<i class="fa-solid fa-calendar-days"></i>
							Próximos Compromisos ({upcomingTodos.length})
						</h2>
						<span class="block-sub">Citas y trámites a futuro</span>
					</div>

					<div class="todos-cards-grid">
						{#each upcomingTodos as todoItem (todoItem.id)}
							<div class="todo-card" class:completed={todoItem.isCompleted}>
								<div class="card-left-col">
									<button
										type="button"
										class="check-btn"
										class:checked={todoItem.isCompleted}
										on:click={() => toggleTodo(todoItem)}
										title="Marcar completado"
									>
										{#if todoItem.isCompleted}
											<i class="fa-solid fa-check"></i>
										{/if}
									</button>
								</div>

								<div class="card-main-col">
									<div class="card-top-meta">
										<span class="type-badge badge-{todoItem.type?.toLowerCase() || 'llamada'}">
											{todoItem.type || 'Compromiso'}
										</span>
										<span class="date-badge">
											<i class="fa-solid fa-calendar"></i>
											{formatDateFriendly(todoItem.endTask)} {formatTimeFriendly(todoItem.timeString)}
										</span>
									</div>

									<h3 class="todo-title">{todoItem.task}</h3>

									{#if todoItem.notes}
										<p class="todo-notes">{todoItem.notes}</p>
									{/if}

									{#if todoItem.contactName || todoItem.contactPhone}
										<div class="todo-contact-box">
											<div class="contact-info-sub">
												<i class="fa-solid fa-user-tag"></i>
												<strong>{todoItem.contactName || 'Cliente'}</strong>
												{#if todoItem.contactPhone}
													<span>({formatDisplayPhone(todoItem.contactPhone)})</span>
												{/if}
											</div>
											{#if todoItem.contactPhone}
												<div class="contact-actions-sub">
													<a href="tel:{todoItem.contactPhone}" class="sub-btn-call" title="Llamar">
														<i class="fa-solid fa-phone"></i>
													</a>
													<a
														href="https://wa.me/52{String(todoItem.contactPhone).replace(/\D/g, '')}"
														target="_blank"
														rel="noopener noreferrer"
														class="sub-btn-wa"
														title="WhatsApp"
													>
														<i class="fa-brands fa-whatsapp"></i>
													</a>
												</div>
											{/if}
										</div>
									{/if}
								</div>

								<div class="card-actions-col">
									<button type="button" class="btn-card-edit" on:click={() => openEditModal(todoItem)} title="Editar">
										<i class="fa-solid fa-pen-to-square"></i>
									</button>
									<button type="button" class="btn-card-del" on:click={() => deleteTodo(todoItem.id)} title="Eliminar">
										<i class="fa-solid fa-trash-can"></i>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</main>
	{/if}

	<!-- Modal de Creación / Edición de Compromiso -->
	{#if showModal}
		<div class="modal-backdrop" role="presentation" on:click={() => (showModal = false)}>
			<div class="modal-card" role="dialog" aria-modal="true" on:click|stopPropagation tabindex="-1">
				<div class="modal-header">
					<h3>
						<i class="fa-solid {isEditing ? 'fa-pen-to-square' : 'fa-calendar-plus'} modal-ico"></i>
						{isEditing ? 'Editar Compromiso' : 'Agendar Nuevo Compromiso'}
					</h3>
					<button class="btn-close-modal" on:click={() => (showModal = false)}>
						<i class="fa-solid fa-xmark"></i>
					</button>
				</div>

				<form on:submit|preventDefault={handleSubmit} class="modal-form">
					<!-- Título del compromiso -->
					<div class="form-group">
						<label for="form-title-input" class="form-label">¿Qué vas a realizar? *</label>
						<input
							id="form-title-input"
							type="text"
							bind:value={formTitle}
							placeholder="Ej. Llamada de seguimiento lona Lomas..."
							class="form-input"
							required
						/>
					</div>

					<!-- Tipo de Compromiso -->
					<div class="form-group">
						<label class="form-label">Tipo de Compromiso:</label>
						<div class="type-selector-pills">
							<button
								type="button"
								class="type-pill-btn"
								class:selected={formType === 'Llamada'}
								on:click={() => (formType = 'Llamada')}
							>
								<i class="fa-solid fa-phone"></i> Llamada D1
							</button>
							<button
								type="button"
								class="type-pill-btn"
								class:selected={formType === 'Visita'}
								on:click={() => (formType = 'Visita')}
							>
								<i class="fa-solid fa-house"></i> Visita Inmueble
							</button>
							<button
								type="button"
								class="type-pill-btn"
								class:selected={formType === 'Cita'}
								on:click={() => (formType = 'Cita')}
							>
								<i class="fa-solid fa-handshake"></i> Cita Oficina
							</button>
							<button
								type="button"
								class="type-pill-btn"
								class:selected={formType === 'Trámite'}
								on:click={() => (formType = 'Trámite')}
							>
								<i class="fa-solid fa-file-signature"></i> Trámite
							</button>
						</div>
					</div>

					<!-- Fecha y Hora -->
					<div class="form-row-2">
						<div class="form-group">
							<label for="form-date-input" class="form-label">Fecha: *</label>
							<div class="date-quick-presets">
								<button
									type="button"
									class="btn-date-preset"
									class:active={formDate === getTodayDateString()}
									on:click={() => (formDate = getTodayDateString())}
								>
									Hoy
								</button>
								<button
									type="button"
									class="btn-date-preset"
									class:active={formDate === getTomorrowDateString()}
									on:click={() => (formDate = getTomorrowDateString())}
								>
									Mañana
								</button>
							</div>
							<input
								id="form-date-input"
								type="date"
								bind:value={formDate}
								class="form-input"
								required
							/>
						</div>

						<div class="form-group">
							<label for="form-time-input" class="form-label">Hora:</label>
							<div class="date-quick-presets">
								<button type="button" class="btn-date-preset" on:click={() => (formTime = '10:00')}>
									10:00 AM
								</button>
								<button type="button" class="btn-date-preset" on:click={() => (formTime = '16:30')}>
									04:30 PM
								</button>
							</div>
							<input
								id="form-time-input"
								type="time"
								bind:value={formTime}
								class="form-input"
							/>
						</div>
					</div>

					<!-- Vincular a Contacto de Cartera (Opcional) -->
					{#if contacts.length > 0}
						<div class="form-group">
							<label for="contact-picker-select" class="form-label">Vincular a cliente de mi cartera (opcional):</label>
							<select
								id="contact-picker-select"
								value={formContactId}
								on:change={handleContactSelect}
								class="form-select"
							>
								<option value="">-- Ninguno / Tarea interna --</option>
								{#each contacts as c}
									<option value={c.id}>
										{c.name || ''} {c.lastname || ''} ({c.typeContact || 'Comprador'}) {c.telephon ? `· ${formatDisplayPhone(c.telephon)}` : ''}
									</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Notas Adicionales -->
					<div class="form-group">
						<label for="form-notes-input" class="form-label">Notas / Ubicación / Dirección:</label>
						<textarea
							id="form-notes-input"
							bind:value={formNotes}
							placeholder="Detalles de la cita, temas a tratar o dirección exacta..."
							rows="3"
							class="form-textarea"
						></textarea>
					</div>

					<!-- Botones del Modal -->
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
							<span>{isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Agendar Compromiso')}</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.agenda-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem 1rem;
		box-sizing: border-box;
	}

	.agenda-header {
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

	.btn-new-todo {
		background: linear-gradient(135deg, #0cbff6 0%, #0284c7 100%);
		color: #000000;
		border: none;
		border-radius: 8px;
		padding: 0.65rem 1.15rem;
		font-size: 0.9rem;
		font-weight: 800;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		box-shadow: 0 4px 14px rgba(12, 191, 246, 0.3);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-new-todo:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(12, 191, 246, 0.4);
	}

	/* Barra KPI de la Agenda */
	.agenda-kpi-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.kpi-mini-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 0.5rem 0.85rem;
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
	}

	.kpi-mini-card.alert-card {
		background: rgba(239, 68, 68, 0.12);
		border-color: rgba(239, 68, 68, 0.3);
	}

	.kpi-mini-card.alert-card .kpi-mini-val {
		color: #f87171;
	}

	.kpi-mini-val {
		font-size: 1.15rem;
		font-weight: 800;
		color: #0cbff6;
	}

	.kpi-mini-lbl {
		font-size: 0.75rem;
		color: #a1a1aa;
		font-weight: 600;
	}

	/* Filtros */
	.filters-pills-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.pills-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.filter-pill {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.filter-pill:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
	}

	.filter-pill.active {
		background: #0cbff6;
		color: #000000;
		font-weight: 800;
		border-color: #0cbff6;
	}

	.filters-right-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.advisor-filter-select {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
		font-size: 0.78rem;
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		outline: none;
		cursor: pointer;
	}

	.hide-completed-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #a1a1aa;
		cursor: pointer;
		user-select: none;
	}

	/* Bloques Cronológicos */
	.timeline-container {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.time-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.block-header {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.block-title {
		font-size: 1.1rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.overdue-title {
		color: #f87171;
	}

	.today-title {
		color: #4ade80;
	}

	.block-sub {
		font-size: 0.75rem;
		color: #71717a;
	}

	/* Grilla y Tarjetas de Tareas */
	.todos-cards-grid {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.todo-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.9rem 1rem;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.85rem;
		align-items: flex-start;
		transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
	}

	.todo-card:hover {
		border-color: rgba(12, 191, 246, 0.3);
	}

	.todo-card.overdue-card {
		border-left: 3px solid #ef4444;
	}

	.todo-card.completed {
		opacity: 0.55;
		background: rgba(24, 24, 27, 0.6);
	}

	.todo-card.completed .todo-title {
		text-decoration: line-through;
		color: #71717a;
	}

	/* Checkbox circular táctil */
	.check-btn {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.25);
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #000000;
		font-size: 0.75rem;
		transition: all 0.15s ease;
		padding: 0;
		margin-top: 0.15rem;
	}

	.check-btn:hover {
		border-color: #10b981;
	}

	.check-btn.checked {
		background: #10b981;
		border-color: #10b981;
		color: #ffffff;
	}

	.card-main-col {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.card-top-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.type-badge {
		font-size: 0.68rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge-llamada {
		background: rgba(14, 165, 233, 0.18);
		color: #38bdf8;
		border: 1px solid rgba(14, 165, 233, 0.35);
	}

	.badge-visita {
		background: rgba(16, 185, 129, 0.18);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.35);
	}

	.badge-cita {
		background: rgba(245, 158, 11, 0.18);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.35);
	}

	.badge-trámite {
		background: rgba(168, 85, 247, 0.18);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.35);
	}

	.date-badge {
		font-size: 0.72rem;
		color: #a1a1aa;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 600;
	}

	.date-badge.overdue-date {
		color: #f87171;
		font-weight: 700;
	}

	.advisor-badge {
		font-size: 0.7rem;
		color: #71717a;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.todo-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		line-height: 1.35;
		word-break: break-word;
	}

	.todo-notes {
		font-size: 0.82rem;
		color: #a1a1aa;
		margin: 0;
		line-height: 1.4;
		white-space: pre-wrap;
	}

	.todo-contact-box {
		margin-top: 0.25rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.35rem 0.6rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.contact-info-sub {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #e4e4e7;
	}

	.contact-info-sub i {
		color: #0cbff6;
	}

	.contact-actions-sub {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.sub-btn-call,
	.sub-btn-wa {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		font-size: 0.8rem;
		transition: background 0.15s ease;
	}

	.sub-btn-call {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
	}

	.sub-btn-call:hover {
		background: rgba(12, 191, 246, 0.3);
	}

	.sub-btn-wa {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.sub-btn-wa:hover {
		background: rgba(16, 185, 129, 0.3);
	}

	/* Acciones derecha de la tarjeta */
	.card-actions-col {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.btn-card-edit,
	.btn-card-del {
		background: transparent;
		border: none;
		color: #71717a;
		font-size: 0.85rem;
		padding: 0.3rem;
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.15s ease;
	}

	.btn-card-edit:hover {
		color: #0cbff6;
	}

	.btn-card-del:hover {
		color: #f87171;
	}

	/* Modal de Creación / Edición */
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
		color: #0cbff6;
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
		gap: 1.1rem;
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
	.form-select,
	.form-textarea {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.65rem 0.85rem;
		color: #ffffff;
		font-size: 0.9rem;
		outline: none;
		box-sizing: border-box;
		font-family: inherit;
	}

	.form-input:focus,
	.form-select:focus,
	.form-textarea:focus {
		border-color: #0cbff6;
	}

	.type-selector-pills {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.4rem;
	}

	.type-pill-btn {
		background: #27272a;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.5rem 0.65rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition: all 0.15s ease;
	}

	.type-pill-btn.selected {
		background: rgba(12, 191, 246, 0.2);
		border-color: #0cbff6;
		color: #ffffff;
	}

	.date-quick-presets {
		display: flex;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
	}

	.btn-date-preset {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #a1a1aa;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-date-preset.active {
		background: #0cbff6;
		color: #000000;
		border-color: #0cbff6;
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
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
		border-top-color: #0cbff6;
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

	.btn-empty-action {
		background: #0cbff6;
		color: #000000;
		border: none;
		padding: 0.55rem 1.25rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 800;
		cursor: pointer;
	}
</style>
