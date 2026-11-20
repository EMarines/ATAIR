<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import '../../styles/main.css';
	import { userProfile, userStore } from '$lib/firebase/authManager';
	import ConfiguradorParametrico from '$lib/components/tramites/ConfiguradorParametrico.svelte';
	import ChecklistControlado from '$lib/components/tramites/ChecklistControlado.svelte';
	import NuevoTramiteModal from '$lib/components/tramites/NuevoTramiteModal.svelte';
	import {
		CONFIG_DEFAULT_VENTA,
		evaluarRequisitosTramite,
		inferirConfiguracionDesdeExpediente,
		LABELS_ESTADO_CIVIL
	} from '$lib/tramites/motorRequisitos';
	import {
		createNewTramite,
		deleteTramite,
		describeModalidad,
		loadPilotExpediente,
		saveCapturedDatum,
		saveTramiteConfig,
		subscribeTramites,
		syncPilotToFirestore,
		updateChecklistControlState,
		type CrearTramitePayload
	} from '$lib/tramites/tramiteService';
	import type {
		ConfiguracionTramite,
		EstadoControlSistema,
		TramiteExpediente
	} from '$lib/tramites/tramiteTypes';

	let tramites: TramiteExpediente[] = [];
	let selectedId: string | null = null;
	let activeTab: 'checklist' | 'configurador' | 'general' | 'financiero' | 'documentos' =
		'checklist';
	let searchQuery = '';
	let notificationMsg = '';
	let firestoreStatus: 'conectado' | 'cargando' | 'solo_local' = 'cargando';
	let firestoreWarning = '';

	let modalNuevoOpen = false;
	let creatingTramite = false;
	let pilotLocalCache: TramiteExpediente | null = null;
	let unsubscribeTramites: (() => void) | null = null;

	const formatCurrency = (val: number | undefined) => {
		const num = Number(val || 0);
		if (isNaN(num)) return '$0.00';
		return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
	};

	function showToast(msg: string) {
		notificationMsg = msg;
		setTimeout(() => {
			if (notificationMsg === msg) notificationMsg = '';
		}, 3200);
	}

	async function inicializarExpedientes() {
		firestoreStatus = 'cargando';
		pilotLocalCache = await loadPilotExpediente();

		if (unsubscribeTramites) unsubscribeTramites();

		let pilotSyncAttempted = false;

		unsubscribeTramites = subscribeTramites(
			async (cloudList) => {
				firestoreStatus = 'conectado';
				firestoreWarning = '';

				const pilotoCloud = cloudList.find((t) => t.id === 'TRAMITE-2026-001');
				const tienePiloto = Boolean(pilotoCloud);
				const eqLocal = pilotLocalCache?.inmueble?.equipamientoIncluido || [];
				const eqCloud = pilotoCloud?.inmueble?.equipamientoIncluido || [];

				if (!pilotSyncAttempted && pilotLocalCache && (!pilotoCloud || eqLocal.length > eqCloud.length)) {
					pilotSyncAttempted = true;
					const patchOrFull = !pilotoCloud
						? pilotLocalCache
						: ({
								id: pilotLocalCache.id,
								inmueble: { equipamientoIncluido: eqLocal },
								contratoUrl: pilotLocalCache.contratoUrl,
								contratoNombre: pilotLocalCache.contratoNombre,
								documentos: pilotLocalCache.documentos
							} as TramiteExpediente);
					const synced = await syncPilotToFirestore(patchOrFull);
					if (synced) return; // onSnapshot volverá a disparar con el piloto ya actualizado
				}

				const combined = tienePiloto
					? cloudList
					: pilotLocalCache
						? [pilotLocalCache, ...cloudList]
						: cloudList;

				tramites = combined;
				if (!selectedId && combined.length > 0) {
					selectedId = combined[0].id;
				} else if (selectedId && !combined.some((t) => t.id === selectedId) && combined.length > 0) {
					selectedId = combined[0].id;
				}
			},
			(err: unknown) => {
				console.warn('[Tramites] Fallback local activado:', err);
				firestoreStatus = 'solo_local';
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.toLowerCase().includes('permission')) {
					firestoreWarning =
						'Modo Local Temporal: falta permiso de escritura en la colección tramites de Firestore.';
				}
				if (pilotLocalCache && !tramites.some((t) => t.id === pilotLocalCache?.id)) {
					tramites = [pilotLocalCache, ...tramites];
				}
				if (!selectedId && tramites.length > 0) {
					selectedId = tramites[0].id;
				}
			}
		);
	}

	onMount(() => {
		inicializarExpedientes();
	});

	onDestroy(() => {
		if (unsubscribeTramites) unsubscribeTramites();
	});

	$: filteredTramites = tramites.filter((t) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			(t.folderName || '').toLowerCase().includes(q) ||
			(t.partes?.vendedora?.nombre || '').toLowerCase().includes(q) ||
			(t.partes?.compradorTitular?.nombre || '').toLowerCase().includes(q) ||
			(t.inmueble?.calle || '').toLowerCase().includes(q) ||
			(t.modalidadCredito || '').toLowerCase().includes(q)
		);
	});

	$: selectedTramite = tramites.find((t) => t.id === selectedId) || null;

	$: configActual = selectedTramite
		? inferirConfiguracionDesdeExpediente(selectedTramite)
		: CONFIG_DEFAULT_VENTA;

	$: evaluacionActual = selectedTramite
		? evaluarRequisitosTramite(configActual, selectedTramite)
		: null;

	$: currentUserLabel =
		$userProfile?.displayName ||
		$userStore?.displayName ||
		$userProfile?.email ||
		'Enrique Marines (Admin)';

	function patchLocalTramite(tramiteId: string, updater: (t: TramiteExpediente) => TramiteExpediente) {
		tramites = tramites.map((t) => (t.id === tramiteId ? updater(t) : t));
	}

	async function handleConfigChange(e: CustomEvent<{ config: ConfiguracionTramite }>) {
		if (!selectedTramite) return;
		const tId = selectedTramite.id;
		const nextConfig = e.detail.config;
		const desc = describeModalidad(nextConfig);
		const prevEval = evaluarRequisitosTramite(nextConfig, selectedTramite);

		// Actualización reactiva instantánea
		patchLocalTramite(tId, (t) => ({
			...t,
			configuracion: nextConfig,
			tipoOperacion: desc.tipoOperacion,
			modalidadCredito: desc.modalidadCredito,
			updatedAt: Date.now()
		}));

		showToast(
			`Filtros actualizados: ${prevEval.resumen.totalDocs} documentos y ${prevEval.resumen.totalDatos} datos requeridos`
		);

		if (firestoreStatus === 'conectado') {
			const res = await saveTramiteConfig(tId, nextConfig);
			if (!res.success) {
				console.warn('Error guardando config en Firestore:', res.error);
			}
		}
	}

	async function handleToggleDoc(
		e: CustomEvent<{ reqId: string; nuevoEstado: EstadoControlSistema; validadoPor: string }>
	) {
		if (!selectedTramite) return;
		const tId = selectedTramite.id;
		const { reqId, nuevoEstado, validadoPor } = e.detail;
		const registro = {
			estado: nuevoEstado,
			validadoPor,
			actualizadoEn: new Date().toISOString().slice(0, 10)
		};

		patchLocalTramite(tId, (t) => ({
			...t,
			controlChecklist: {
				...(t.controlChecklist || {}),
				[reqId]: registro
			},
			updatedAt: Date.now()
		}));

		showToast('Estado de requisito actualizado en el sistema');

		if (firestoreStatus === 'conectado') {
			await updateChecklistControlState(tId, reqId, registro);
		}
	}

	async function handleSaveDato(e: CustomEvent<{ campoClave: string; valor: string }>) {
		if (!selectedTramite) return;
		const tId = selectedTramite.id;
		const { campoClave, valor } = e.detail;

		patchLocalTramite(tId, (t) => {
			const updatedDatos = {
				...(t.datosCapturados || {}),
				[campoClave]: valor.trim()
			};
			const updatedPartes = { ...(t.partes || {}) };
			if (campoClave === 'compradorTelefono') {
				updatedPartes.compradorTitular = {
					...(updatedPartes.compradorTitular || { nombre: '' }),
					telefono: valor.trim()
				};
			} else if (campoClave === 'compradorNombre') {
				updatedPartes.compradorTitular = {
					...(updatedPartes.compradorTitular || { nombre: '' }),
					nombre: valor.trim()
				};
			} else if (campoClave === 'compradorCurp') {
				updatedPartes.compradorTitular = {
					...(updatedPartes.compradorTitular || { nombre: '' }),
					curp: valor.trim()
				};
			} else if (campoClave === 'compradorRfc') {
				updatedPartes.compradorTitular = {
					...(updatedPartes.compradorTitular || { nombre: '' }),
					rfc: valor.trim()
				};
			} else if (campoClave === 'vendedorClabe') {
				updatedPartes.vendedora = {
					...(updatedPartes.vendedora || { nombre: '' }),
					clabeBancaria: valor.trim()
				};
			}
			return {
				...t,
				datosCapturados: updatedDatos,
				partes: updatedPartes,
				updatedAt: Date.now()
			};
		});

		showToast('Dato guardado y validado automáticamente');

		if (firestoreStatus === 'conectado') {
			await saveCapturedDatum(tId, campoClave, valor, configActual);
		}
	}

	async function handleCreateTramite(e: CustomEvent<CrearTramitePayload>) {
		creatingTramite = true;
		const res = await createNewTramite(e.detail);
		creatingTramite = false;

		if (res.success && res.tramite) {
			modalNuevoOpen = false;
			if (!tramites.some((t) => t.id === res.tramite?.id)) {
				tramites = [res.tramite, ...tramites];
			}
			selectedId = res.tramite.id;
			activeTab = 'checklist';
			showToast(`Expediente "${res.tramite.folderName}" guardado en Firestore`);
		} else {
			// Fallback local si Firestore tuviera bloqueo de permisos
			const now = Date.now();
			const fallbackTramite: TramiteExpediente = {
				id: `LOCAL-${now}`,
				folderName: e.detail.folderName,
				tipoOperacion: describeModalidad(e.detail.configuracion).tipoOperacion,
				modalidadCredito: describeModalidad(e.detail.configuracion).modalidadCredito,
				estadoTramite: 'Expediente Local (Simulador)',
				fechaApertura: new Date().toISOString().slice(0, 10),
				configuracion: e.detail.configuracion,
				datosCapturados: {
					compradorNombre: e.detail.compradorNombre,
					compradorTelefono: e.detail.compradorTelefono,
					vendedorNombre: e.detail.vendedorNombre,
					precioORentaPactado: e.detail.precioORenta ? String(e.detail.precioORenta) : ''
				},
				controlChecklist: {},
				inmueble: {
					calle: e.detail.calle || 'Por definir',
					numeroEscritura: '',
					numeroOficial: e.detail.numeroOficial || '',
					colonia: e.detail.colonia || 'Chihuahua',
					codigoPostal: '',
					ciudad: e.detail.ciudad || 'Chihuahua',
					estado: 'Chihuahua',
					claveCatastral: '',
					folioReal: '',
					superficieTerrenoM2: 0,
					superficieConstruccionM2: 0,
					antecedentePropiedad: {
						tipoActo: e.detail.configuracion.origenInmueble,
						numeroEscritura: '',
						volumen: '',
						fecha: '',
						notario: '',
						numeroNotaria: '',
						distrito: 'Morelos',
						rppInscripcion: '',
						rppFolio: '',
						rppLibro: '',
						rppSeccion: 'Primera',
						rppFecha: ''
					}
				},
				partes: {
					vendedora: {
						nombre: e.detail.vendedorNombre,
						telefono: e.detail.vendedorTelefono
					},
					compradorTitular: {
						nombre: e.detail.compradorNombre,
						telefono: e.detail.compradorTelefono
					}
				},
				financiero: {
					precioPactado:
						e.detail.configuracion.tipoOperacion === 'compraventa' ? e.detail.precioORenta : 0,
					rentaMensual:
						e.detail.configuracion.tipoOperacion === 'arrendamiento' ? e.detail.precioORenta : 0,
					apartadoEfectivo: 0,
					fechaApartado: new Date().toISOString().slice(0, 10),
					saldoRestante: e.detail.precioORenta,
					montoNetoInfonavit: 0,
					gapRecursosPropios: 0,
					comisionInmobiliariaPactada: 0
				},
				documentos: []
			};
			tramites = [fallbackTramite, ...tramites];
			selectedId = fallbackTramite.id;
			modalNuevoOpen = false;
			activeTab = 'checklist';
			showToast('Expediente creado en modo local (revisar reglas Firestore)');
		}
	}

	async function handleDeleteCurrent() {
		if (!selectedTramite || selectedTramite.id === 'TRAMITE-2026-001') return;
		const confirmDelete = window.confirm(
			`¿Eliminar permanentemente el expediente "${selectedTramite.folderName}"?`
		);
		if (!confirmDelete) return;
		const idToDelete = selectedTramite.id;
		await deleteTramite(idToDelete);
		tramites = tramites.filter((t) => t.id !== idToDelete);
		selectedId = tramites[0]?.id || null;
		showToast('Expediente eliminado');
	}
</script>

<svelte:head>
	<title>Trámites Paramétricos | ATAIR SGI</title>
</svelte:head>

<div class="page-container">
	{#if notificationMsg}
		<div class="toast" transition:fade>{notificationMsg}</div>
	{/if}

	<!-- HEADER PRINCIPAL -->
	<header class="module-header">
		<div class="header-content">
			<div class="badge-row">
				<span class="badge-tag">Módulo Oficial ATAIR SGI • COMPASS</span>
				<span class="sync-badge {firestoreStatus}">
					{#if firestoreStatus === 'conectado'}
						● Firestore Sincronizado
					{:else if firestoreStatus === 'cargando'}
						○ Conectando Firestore...
					{:else}
						▲ Modo Local
					{/if}
				</span>
			</div>
			<h1>Gestor Paramétrico de Trámites & Expedientes</h1>
			<p class="subtitle">
				Motor de reglas en cascada por tipo de operación, financiamiento, estado civil y situación jurídica. Checkboxes controlados automáticamente por el sistema.
			</p>
			{#if firestoreWarning}
				<div class="warning-strip">⚠️ {firestoreWarning}</div>
			{/if}
		</div>

		<div class="header-actions">
			<button class="btn-refresh" on:click={inicializarExpedientes}>
				🔄 Sincronizar
			</button>
			<button class="btn-primary" on:click={() => (modalNuevoOpen = true)}>
				➕ Nuevo Trámite
			</button>
		</div>
	</header>

	<!-- BARRA DE BÚSQUEDA Y MÉTRICAS -->
	<div class="controls-bar">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				placeholder="Buscar por apellidos, comprador, vendedor o calle..."
				bind:value={searchQuery}
			/>
		</div>
		<div class="stats-pills">
			<div class="stat-pill">
				<span class="stat-num">{tramites.length}</span>
				<span class="stat-lbl">Expedientes</span>
			</div>
			{#if evaluacionActual}
				<div class="stat-pill active">
					<span class="stat-num">{evaluacionActual.resumen.porcentaje}%</span>
					<span class="stat-lbl">Integrado Actual</span>
				</div>
				<div class="stat-pill">
					<span class="stat-num">{evaluacionActual.alertas.length}</span>
					<span class="stat-lbl">Alertas Legales</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- CONTENIDO DUAL -->
	<div class="layout-grid">
		<!-- SIDEBAR -->
		<aside class="sidebar-tramites">
			<div class="sidebar-header">
				<h2>Expedientes Activos</h2>
				<span class="badge-count">{filteredTramites.length}</span>
			</div>

			<div class="cards-list">
				{#each filteredTramites as t (t.id)}
					{@const evalCard = evaluarRequisitosTramite(inferirConfiguracionDesdeExpediente(t), t)}
					<button
						type="button"
						class="tramite-card"
						class:active={selectedTramite?.id === t.id}
						on:click={() => (selectedId = t.id)}
					>
						<div class="card-top">
							<span class="folder-name">📁 {t.folderName}</span>
							<span class="badge-credit">{t.modalidadCredito}</span>
						</div>
						<div class="property-line">
							📍 {t.inmueble?.calle || 'Domicilio por definir'}
							{#if t.inmueble?.numeroOficial} #{t.inmueble.numeroOficial}{/if},
							{t.inmueble?.colonia || 'Chihuahua'}
						</div>
						<div class="parties-line">
							<span>Vend: {(t.partes?.vendedora?.nombre || 'N/A').split(' ').slice(0, 2).join(' ')}</span>
							<span>•</span>
							<span>Comp: {(t.partes?.compradorTitular?.nombre || 'N/A').split(' ')[0]}</span>
						</div>
						<div class="card-bottom">
							<div class="price-tag">
								{formatCurrency(t.financiero?.precioPactado || t.financiero?.rentaMensual)}
							</div>
							<span class="status-indicator">
								{evalCard.resumen.completados}/{evalCard.resumen.total} ({evalCard.resumen.porcentaje}%)
							</span>
						</div>
					</button>
				{:else}
					<div class="empty-state">No se encontraron expedientes con ese filtro.</div>
				{/each}
			</div>
		</aside>

		<!-- EXPEDIENTE PRINCIPAL -->
		{#if selectedTramite && evaluacionActual}
			<main class="main-expediente" transition:fade={{ duration: 150 }}>
				<!-- BANNER -->
				<div class="expediente-banner">
					<div class="banner-title-area">
						<div class="path-bread">📁 /tramites/{selectedTramite.folderName} • ID: {selectedTramite.id}</div>
						<h2>{selectedTramite.folderName}</h2>
						<p class="summary-text">
							<strong>{selectedTramite.tipoOperacion}</strong> •
							<strong>{selectedTramite.modalidadCredito}</strong> en
							{selectedTramite.inmueble?.colonia || 'Chihuahua'}, {selectedTramite.inmueble?.ciudad || 'Chihuahua'}.
						</p>
					</div>

					<div class="banner-actions-right">
						{#if selectedTramite.contratoUrl}
							<div class="download-action">
								<a
									href={selectedTramite.contratoUrl}
									download={selectedTramite.contratoNombre || 'contrato.docx'}
									class="btn-download-contract"
								>
									📄 Descargar Contrato Word (.docx)
								</a>
								<span class="sub-download">Formato limpio • Comisión 4% • 50/50 penalización</span>
							</div>
						{:else}
							<div class="action-buttons-row">
								<button
									class="btn-secondary-sm"
									on:click={() => (activeTab = 'configurador')}
								>
									⚙️ Ajustar Variables
								</button>
								<button class="btn-danger-sm" on:click={handleDeleteCurrent}>
									🗑️ Eliminar
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- TABS -->
				<nav class="tabs-nav">
					<button
						class="tab-btn"
						class:active={activeTab === 'checklist'}
						on:click={() => (activeTab = 'checklist')}
					>
						📋 Checklist Controlado
						<span class="badge-alert">
							{evaluacionActual.resumen.total - evaluacionActual.resumen.completados}
						</span>
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'configurador'}
						on:click={() => (activeTab = 'configurador')}
					>
						⚙️ Configurador de Variables
						{#if evaluacionActual.alertas.length > 0}
							<span class="badge-info-tab">{evaluacionActual.alertas.length}</span>
						{/if}
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'general'}
						on:click={() => (activeTab = 'general')}
					>
						👥 Generales
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'financiero'}
						on:click={() => (activeTab = 'financiero')}
					>
						💰 Financiero
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'documentos'}
						on:click={() => (activeTab = 'documentos')}
					>
						📂 Bóveda ({selectedTramite.documentos?.length || 0})
					</button>
				</nav>

				<!-- CONTENIDO -->
				<div class="tab-body">
					{#if activeTab === 'checklist'}
						<!-- RESUMEN ACTIVO DE VARIABLES DEL FILTRO -->
						<div class="active-rules-banner">
							<div class="rules-summary-text">
								<strong>Reglas Aplicadas:</strong>
								{selectedTramite.tipoOperacion} • {selectedTramite.modalidadCredito} •
								Comprador: {configActual.comprador.tipoPersona === 'moral'
									? 'Persona Moral'
									: configActual.comprador.estadoCivil === 'casado'
										? `Casado (${configActual.comprador.regimenConyugal === 'separacion_bienes' ? 'Sep. Bienes' : 'Soc. Conyugal'})`
										: LABELS_ESTADO_CIVIL[configActual.comprador.estadoCivil]}
								• Vendedor: {configActual.vendedor.tipoPersona === 'moral'
									? 'Persona Moral'
									: configActual.vendedor.estadoCivil === 'casado'
										? `Casado (${configActual.vendedor.regimenConyugal === 'separacion_bienes' ? 'Sep. Bienes' : 'Soc. Conyugal'})`
										: LABELS_ESTADO_CIVIL[configActual.vendedor.estadoCivil]}
							</div>
							<button class="btn-link-cfg" on:click={() => (activeTab = 'configurador')}>
								⚙️ Cambiar filtros / variables
							</button>
						</div>

						<ChecklistControlado
							expediente={selectedTramite}
							evaluacion={evaluacionActual}
							currentUserName={currentUserLabel}
							on:toggleDoc={handleToggleDoc}
							on:saveDato={handleSaveDato}
						/>
					{/if}

					{#if activeTab === 'configurador'}
						<div transition:fade={{ duration: 150 }}>
							<div class="cfg-intro-bar">
								<div>
									<h3>Motor Dinámico de Requisitos (Filtros en Cascada)</h3>
									<p>
										Al modificar cualquier variable del trato, las listas de documentos, datos requeridos y alertas notariales se recalcularán al instante y se guardarán en Firestore.
									</p>
								</div>
								<button class="btn-primary-sm" on:click={() => (activeTab = 'checklist')}>
									Ver Checklist Filtrado ({evaluacionActual.resumen.total} reqs) →
								</button>
							</div>

							<ConfiguradorParametrico
								config={configActual}
								alertas={evaluacionActual.alertas}
								on:change={handleConfigChange}
							/>
						</div>
					{/if}

					{#if activeTab === 'general'}
						<div class="grid-2-cols" transition:fade={{ duration: 150 }}>
							<!-- VENDEDORA -->
							<div class="detail-card">
								<div class="card-title">
									<span>Parte Propietaria / Enajenante</span>
									<span class="badge-status-green">
										{selectedTramite.partes.vendedora?.estadoCivil || configActual.vendedor.estadoCivil}
									</span>
								</div>
								<div class="field-row">
									<span class="field-lbl">Nombre:</span>
									<span>{selectedTramite.partes.vendedora?.nombre || 'Por definir'}</span>
								</div>
								{#if selectedTramite.partes.vendedora?.nombreEnEscritura}
									<div class="field-row">
										<span class="field-lbl">En Escritura:</span>
										<span class="text-dim">{selectedTramite.partes.vendedora.nombreEnEscritura}</span>
									</div>
								{/if}
								<div class="field-row">
									<span class="field-lbl">CURP:</span>
									<span class="code-span">{selectedTramite.partes.vendedora?.curp || 'Por capturar'}</span>
								</div>
								<div class="field-row">
									<span class="field-lbl">RFC SAT:</span>
									<span class="code-span">{selectedTramite.datosCapturados?.vendedorRfc || selectedTramite.partes.vendedora?.rfc || 'Pendiente'}</span>
								</div>
								<div class="field-row">
									<span class="field-lbl">Teléfono:</span>
									<span>{selectedTramite.partes.vendedora?.telefono || 'Sin registrar'}</span>
								</div>
								<div class="field-row">
									<span class="field-lbl">Domicilio:</span>
									<span>{selectedTramite.partes.vendedora?.domicilio || 'Por definir'}</span>
								</div>
							</div>

							<!-- COMPRADOR -->
							<div class="detail-card">
								<div class="card-title">
									<span>Parte Adquirente / Arrendatario</span>
									<span class="badge-status-blue">{selectedTramite.modalidadCredito}</span>
								</div>
								<div class="sub-party">
									<div class="sub-party-title">
										Titular: {selectedTramite.partes.compradorTitular?.nombre || 'Por definir'}
									</div>
									<div class="field-row">
										<span class="field-lbl">CURP:</span>
										<span class="code-span">
											{selectedTramite.datosCapturados?.compradorCurp || selectedTramite.partes.compradorTitular?.curp || 'Pendiente'}
										</span>
									</div>
									<div class="field-row">
										<span class="field-lbl">NSS / Teléfono:</span>
										<span class="code-span highlight">
											{selectedTramite.datosCapturados?.compradorNss || selectedTramite.partes.compradorTitular?.nss || selectedTramite.partes.compradorTitular?.telefono || 'Pendiente'}
										</span>
									</div>
									{#if selectedTramite.partes.compradorTitular?.infonavit}
										<div class="field-row">
											<span class="field-lbl">Crédito / Subcuenta:</span>
											<span>
												{formatCurrency(selectedTramite.partes.compradorTitular.infonavit.montoCredito)} + {formatCurrency(selectedTramite.partes.compradorTitular.infonavit.saldoSubcuentaVivienda)} SSV
											</span>
										</div>
									{/if}
								</div>

								{#if selectedTramite.partes.compradoraConyuge || (configActual.comprador.estadoCivil === 'casado' && configActual.comprador.regimenConyugal === 'sociedad_conyugal')}
									<div class="sub-party mt-2">
										<div class="sub-party-title">
											Cónyuge: {selectedTramite.datosCapturados?.compradorConyugeNombre || selectedTramite.partes.compradoraConyuge?.nombre || 'Por capturar'}
										</div>
										<div class="field-row">
											<span class="field-lbl">CURP:</span>
											<span class="code-span">
												{selectedTramite.datosCapturados?.compradorConyugeCurp || selectedTramite.partes.compradoraConyuge?.curp || 'Pendiente'}
											</span>
										</div>
										<div class="field-row">
											<span class="field-lbl">NSS:</span>
											<span class="code-span highlight">
												{selectedTramite.datosCapturados?.compradorConyugeNss || selectedTramite.partes.compradoraConyuge?.nss || 'N/A'}
											</span>
										</div>
									</div>
								{/if}
							</div>

							<!-- INMUEBLE -->
							<div class="detail-card full-width">
								<div class="card-title">
									<span>Inmueble y Datos Registrales</span>
									<span class="badge-status-purple">
										{selectedTramite.inmueble?.antecedentePropiedad?.numeroEscritura
											? `Escritura ${selectedTramite.inmueble.antecedentePropiedad.numeroEscritura}`
											: configActual.origenInmueble}
									</span>
								</div>
								<div class="grid-3-cols">
									<div class="field-col">
										<span class="field-lbl">Ubicación:</span>
										<span>
											{selectedTramite.inmueble?.calle || 'N/A'} #{selectedTramite.inmueble?.numeroOficial || 'S/N'}
											{#if selectedTramite.inmueble?.numeroEscritura}
												(en escritura: {selectedTramite.inmueble.numeroEscritura})
											{/if}
										</span>
									</div>
									<div class="field-col">
										<span class="field-lbl">Clave Catastral / Folio Real:</span>
										<span class="code-span">
											{selectedTramite.datosCapturados?.claveCatastral || selectedTramite.inmueble?.claveCatastral || 'Pendiente'}
											•
											{selectedTramite.datosCapturados?.folioReal || selectedTramite.inmueble?.folioReal || 'Pendiente'}
										</span>
									</div>
									<div class="field-col">
										<span class="field-lbl">Superficies:</span>
										<span>
											Terreno: {selectedTramite.inmueble?.superficieTerrenoM2 || 0} m² • Constr: {selectedTramite.inmueble?.superficieConstruccionM2 || 0} m²
										</span>
									</div>
								</div>

								{#if selectedTramite.inmueble?.equipamientoIncluido && selectedTramite.inmueble.equipamientoIncluido.length > 0}
									<div class="equipment-box">
										<div class="equipment-title">🍳 Equipamiento que se queda funcionando:</div>
										<div class="equipment-tags">
											{#each selectedTramite.inmueble.equipamientoIncluido as eq}
												<span class="eq-tag">✓ {eq}</span>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					{#if activeTab === 'financiero'}
						<div class="financial-container" transition:fade={{ duration: 150 }}>
							{#if configActual.tipoOperacion === 'arrendamiento'}
								<div class="financial-cards-row">
									<div class="fin-stat-card">
										<div class="fin-lbl">Renta Mensual Pactada</div>
										<div class="fin-val">{formatCurrency(selectedTramite.financiero?.rentaMensual || selectedTramite.financiero?.precioPactado)}</div>
										<div class="fin-sub">Canon Mensual</div>
									</div>
									<div class="fin-stat-card green">
										<div class="fin-lbl">Depósito en Garantía</div>
										<div class="fin-val">{formatCurrency(selectedTramite.financiero?.depositoGarantia || selectedTramite.financiero?.rentaMensual)}</div>
										<div class="fin-sub">Resguardo</div>
									</div>
								</div>
							{:else}
								<div class="financial-cards-row">
									<div class="fin-stat-card">
										<div class="fin-lbl">Precio Pactado</div>
										<div class="fin-val">{formatCurrency(selectedTramite.financiero?.precioPactado)}</div>
										<div class="fin-sub">Operación Total</div>
									</div>
									<div class="fin-stat-card green">
										<div class="fin-lbl">Apartado en Garantía</div>
										<div class="fin-val">{formatCurrency(selectedTramite.financiero?.apartadoEfectivo)}</div>
										<div class="fin-sub">{selectedTramite.financiero?.fechaApartado || ''}</div>
									</div>
									<div class="fin-stat-card blue">
										<div class="fin-lbl">Neto Crédito</div>
										<div class="fin-val">{formatCurrency(selectedTramite.financiero?.montoNetoInfonavit)}</div>
										<div class="fin-sub">{selectedTramite.modalidadCredito}</div>
									</div>
									<div class="fin-stat-card orange">
										<div class="fin-lbl">Recursos Propios (Gap)</div>
										<div class="fin-val">{formatCurrency(selectedTramite.financiero?.gapRecursosPropios)}</div>
										<div class="fin-sub">A pagar en Notaría</div>
									</div>
								</div>

								<div class="detail-card mt-3">
									<div class="card-title">
										<span>Condiciones Comerciales Match Home</span>
										<span class="badge-status-green">
											Pacto {selectedTramite.financiero?.porcentajeComisionInmobiliaria || 4}% • 50/50
										</span>
									</div>
									<div class="grid-2-cols">
										<div class="commission-box">
											<div class="box-head">
												Comisión Inmobiliaria ({selectedTramite.financiero?.porcentajeComisionInmobiliaria || 4}%)
											</div>
											<div class="box-number">
												{formatCurrency(selectedTramite.financiero?.comisionInmobiliariaPactada)}
											</div>
											<p class="box-desc">Honorarios sobre precio total al momento de la escritura.</p>
										</div>
										<div class="commission-box">
											<div class="box-head">Pena Convencional</div>
											<div class="box-number">50% Afectado / 50% Inmobiliaria</div>
											<p class="box-desc">Reparto equitativo de pena ante revocación injustificada.</p>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/if}

					{#if activeTab === 'documentos'}
						<div class="vault-container" transition:fade={{ duration: 150 }}>
							<div class="vault-header">
								<h3>Archivos en Bóveda ({selectedTramite.folderName})</h3>
								<span class="vault-count">{selectedTramite.documentos?.length || 0} archivos indexados</span>
							</div>

							<div class="stage2-roadmap-box">
								<span>🚀 Etapa 2 Programada:</span>
								Subida directa de PDFs/fotos desde cada casilla hacia Firebase Storage con auditoría automática mediante Gemini IA y marcado automático del checklist.
							</div>

							{#if selectedTramite.documentos && selectedTramite.documentos.length > 0}
								<div class="vault-grid">
									{#each selectedTramite.documentos as docItem}
										<div class="doc-card">
											<div class="doc-icon">
												{#if docItem.nombre.endsWith('.docx')}📝{:else if docItem.nombre.endsWith('.pdf')}📕{:else if docItem.nombre.endsWith('.xlsx')}📊{:else}🖼️{/if}
											</div>
											<div class="doc-info">
												<div class="doc-name" title={docItem.nombre}>{docItem.nombre}</div>
												<div class="doc-type">{docItem.tipo} • <span class="doc-ok">✓ {docItem.estatus}</span></div>
											</div>
											<div class="doc-actions">
												<a
													href={docItem.url || `/tramites/${encodeURIComponent(selectedTramite.folderName)}/${encodeURIComponent(docItem.nombre)}`}
													download={docItem.nombre}
													class="btn-download-sm"
													target="_blank"
												>
													⬇️ Descargar
												</a>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-vault">
									Aún no hay archivos cargados en este expediente. Usa la pestaña <strong>Checklist Controlado</strong> para gestionar los requisitos por WhatsApp.
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</main>
		{/if}
	</div>
</div>

<NuevoTramiteModal
	open={modalNuevoOpen}
	saving={creatingTramite}
	on:close={() => (modalNuevoOpen = false)}
	on:submit={handleCreateTramite}
/>

<style>
	.page-container {
		width: 100%;
		max-width: 1380px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		min-height: 85vh;
	}

	.toast {
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: #10b981;
		color: #ffffff;
		padding: 0.75rem 1.25rem;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.88rem;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
		z-index: 9999;
	}

	.module-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.4rem;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.badge-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		margin-bottom: 0.45rem;
	}

	.badge-tag {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.22rem 0.6rem;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.15);
		color: #818cf8;
	}

	.sync-badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.22rem 0.6rem;
		border-radius: 6px;
	}

	.sync-badge.conectado {
		background: rgba(16, 185, 129, 0.14);
		color: #10b981;
	}

	.sync-badge.cargando {
		background: rgba(56, 189, 248, 0.14);
		color: #38bdf8;
	}

	.sync-badge.solo_local {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.25rem;
	}

	.subtitle {
		font-size: 0.9rem;
		color: var(--text-muted);
		max-width: 760px;
	}

	.warning-strip {
		margin-top: 0.5rem;
		font-size: 0.78rem;
		padding: 0.4rem 0.7rem;
		border-radius: 7px;
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.35);
		color: #f59e0b;
	}

	.header-actions {
		display: flex;
		gap: 0.65rem;
		align-items: center;
	}

	.btn-primary,
	.btn-primary-sm {
		background: #6366f1;
		color: #ffffff;
		border: none;
		padding: 0.6rem 1.1rem;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.86rem;
		cursor: pointer;
	}

	.btn-primary-sm {
		padding: 0.45rem 0.9rem;
		font-size: 0.8rem;
	}

	.btn-primary:hover,
	.btn-primary-sm:hover {
		background: #4f46e5;
	}

	.btn-refresh {
		background: var(--surface-card);
		color: var(--text-1);
		border: 1px solid var(--border);
		padding: 0.6rem 1rem;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.86rem;
		cursor: pointer;
	}

	.controls-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.35rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.search-box {
		display: flex;
		align-items: center;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.5rem 0.9rem;
		width: 100%;
		max-width: 460px;
		gap: 0.5rem;
	}

	.search-box input {
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-1);
		width: 100%;
		font-size: 0.88rem;
	}

	.stats-pills {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.stat-pill {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.42rem 0.8rem;
		border-radius: 8px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		font-size: 0.8rem;
	}

	.stat-pill.active {
		border-color: #6366f1;
		background: rgba(99, 102, 241, 0.08);
	}

	.stat-num {
		font-weight: 700;
		color: var(--text-1);
	}

	.stat-lbl {
		color: var(--text-muted);
	}

	.layout-grid {
		display: grid;
		grid-template-columns: 330px 1fr;
		gap: 1.35rem;
		align-items: start;
	}

	@media (max-width: 980px) {
		.layout-grid {
			grid-template-columns: 1fr;
		}
	}

	.sidebar-tramites {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1.15rem;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.9rem;
	}

	.sidebar-header h2 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.badge-count {
		background: #4f46e5;
		color: #ffffff;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 20px;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.tramite-card {
		width: 100%;
		text-align: left;
		padding: 0.95rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--surface-card);
		cursor: pointer;
		transition: border-color 0.2s, transform 0.2s;
	}

	.tramite-card:hover {
		border-color: #6366f1;
		transform: translateY(-1px);
	}

	.tramite-card.active {
		border-color: #6366f1;
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.22);
		background: rgba(99, 102, 241, 0.06);
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.35rem;
	}

	.folder-name {
		font-weight: 700;
		font-size: 0.92rem;
		color: var(--text-1);
	}

	.badge-credit {
		font-size: 0.68rem;
		font-weight: 600;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.14);
		padding: 0.18rem 0.45rem;
		border-radius: 6px;
		white-space: nowrap;
	}

	.property-line,
	.parties-line {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin-bottom: 0.3rem;
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.card-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
		margin-top: 0.4rem;
	}

	.price-tag {
		font-weight: 700;
		font-size: 0.88rem;
		color: #10b981;
	}

	.status-indicator {
		font-size: 0.72rem;
		font-weight: 700;
		color: #818cf8;
	}

	.main-expediente {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.expediente-banner {
		padding: 1.35rem 1.5rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
		background: linear-gradient(to right, rgba(99, 102, 241, 0.06), transparent);
	}

	.path-bread {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-family: monospace;
		margin-bottom: 0.2rem;
	}

	.expediente-banner h2 {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.2rem;
	}

	.summary-text {
		font-size: 0.86rem;
		color: var(--text-muted);
	}

	.download-action {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.3rem;
	}

	.btn-download-contract {
		display: inline-flex;
		align-items: center;
		background: #10b981;
		color: #ffffff;
		padding: 0.65rem 1.15rem;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.86rem;
		text-decoration: none;
	}

	.sub-download {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.action-buttons-row {
		display: flex;
		gap: 0.5rem;
	}

	.btn-secondary-sm,
	.btn-danger-sm {
		padding: 0.45rem 0.8rem;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--surface-card);
		color: var(--text-1);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-danger-sm {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.35);
	}

	.tabs-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.45rem 1rem 0;
		border-bottom: 1px solid var(--border);
		background: var(--surface-card);
	}

	.tab-btn {
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0.65rem 0.72rem;
		font-weight: 600;
		font-size: 0.81rem;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.tab-btn.active {
		color: #6366f1;
		border-bottom-color: #6366f1;
	}

	.badge-alert {
		background: #ef4444;
		color: #ffffff;
		font-size: 0.68rem;
		padding: 0.1rem 0.45rem;
		border-radius: 10px;
	}

	.badge-info-tab {
		background: #f59e0b;
		color: #ffffff;
		font-size: 0.68rem;
		padding: 0.1rem 0.45rem;
		border-radius: 10px;
	}

	.tab-body {
		padding: 1.35rem;
	}

	.active-rules-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.7rem 0.95rem;
		border-radius: 9px;
		background: rgba(99, 102, 241, 0.08);
		border: 1px solid rgba(99, 102, 241, 0.25);
		margin-bottom: 1rem;
		font-size: 0.8rem;
		color: var(--text-1);
	}

	.btn-link-cfg {
		background: var(--surface-1);
		border: 1px solid #6366f1;
		color: #818cf8;
		padding: 0.35rem 0.7rem;
		border-radius: 7px;
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
	}

	.cfg-intro-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.cfg-intro-bar h3 {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.15rem;
	}

	.cfg-intro-bar p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.grid-2-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.15rem;
	}

	.grid-3-cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	@media (max-width: 800px) {
		.grid-2-cols {
			grid-template-columns: 1fr;
		}
	}

	.detail-card {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1.15rem;
	}

	.detail-card.full-width {
		grid-column: 1 / -1;
	}

	.card-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 700;
		font-size: 0.92rem;
		margin-bottom: 0.85rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.45rem;
		color: var(--text-1);
	}

	.field-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.3rem 0;
		font-size: 0.83rem;
		gap: 0.5rem;
	}

	.field-lbl {
		color: var(--text-muted);
		font-weight: 500;
		font-size: 0.78rem;
	}

	.field-col {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.83rem;
	}

	.code-span {
		font-family: monospace;
		background: rgba(0, 0, 0, 0.18);
		padding: 0.12rem 0.35rem;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.code-span.highlight {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.1);
	}

	.sub-party {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		padding: 0.7rem;
	}

	.sub-party.mt-2 {
		margin-top: 0.7rem;
	}

	.sub-party-title {
		font-weight: 700;
		font-size: 0.85rem;
		color: #818cf8;
		margin-bottom: 0.35rem;
	}

	.badge-status-green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		font-size: 0.7rem;
		padding: 0.18rem 0.48rem;
		border-radius: 6px;
		font-weight: 600;
	}

	.badge-status-blue {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
		font-size: 0.7rem;
		padding: 0.18rem 0.48rem;
		border-radius: 6px;
		font-weight: 600;
	}

	.badge-status-purple {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		font-size: 0.7rem;
		padding: 0.18rem 0.48rem;
		border-radius: 6px;
		font-weight: 600;
	}

	.equipment-box {
		margin-top: 1rem;
		padding-top: 0.85rem;
		border-top: 1px dashed var(--border);
	}

	.equipment-title {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.45rem;
	}

	.equipment-tags {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.eq-tag {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.25);
		font-size: 0.75rem;
		padding: 0.22rem 0.55rem;
		border-radius: 6px;
	}

	.financial-cards-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.9rem;
	}

	.fin-stat-card {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1.1rem;
	}

	.fin-lbl {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.fin-val {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-1);
		margin: 0.2rem 0;
	}

	.fin-sub {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.fin-stat-card.green .fin-val {
		color: #10b981;
	}

	.fin-stat-card.blue .fin-val {
		color: #38bdf8;
	}

	.fin-stat-card.orange .fin-val {
		color: #f59e0b;
	}

	.mt-3 {
		margin-top: 1rem;
	}

	.commission-box {
		background: rgba(0, 0, 0, 0.12);
		border-radius: 8px;
		padding: 0.9rem;
	}

	.box-head {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.box-number {
		font-size: 1.12rem;
		font-weight: 700;
		color: #10b981;
		margin: 0.25rem 0;
	}

	.box-desc {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin: 0;
	}

	.vault-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.85rem;
	}

	.stage2-roadmap-box {
		padding: 0.75rem 0.95rem;
		border-radius: 8px;
		border: 1px dashed rgba(99, 102, 241, 0.45);
		background: rgba(99, 102, 241, 0.06);
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}

	.stage2-roadmap-box span {
		color: #818cf8;
		font-weight: 700;
	}

	.vault-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.9rem;
	}

	.doc-card {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.8rem;
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.doc-icon {
		font-size: 1.4rem;
	}

	.doc-info {
		flex: 1;
		overflow: hidden;
	}

	.doc-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.doc-type {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.doc-ok {
		color: #10b981;
		font-weight: 600;
	}

	.btn-download-sm {
		font-size: 0.72rem;
		font-weight: 600;
		color: #818cf8;
		text-decoration: none;
		padding: 0.28rem 0.5rem;
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-radius: 6px;
		white-space: nowrap;
	}

	.empty-vault,
	.empty-state {
		padding: 1.25rem;
		text-align: center;
		font-size: 0.84rem;
		color: var(--text-muted);
		background: var(--surface-card);
		border-radius: 8px;
		border: 1px solid var(--border);
	}
</style>
