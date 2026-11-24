<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { LABELS_CONDICIONES, LABELS_QUIEN_CUBRE } from '$lib/tramites/catalogoBaseTramites';
	import type {
		AmbitoConfig,
		CondicionRegla,
		ConfiguracionMaestraTramites,
		DatoMaestro,
		DocumentoMaestro,
		ParteTrato,
		PasoMaestro,
		QuienCubreCosto
	} from '$lib/tramites/tramiteTypes';

	export let open = false;
	export let configMaestra: ConfiguracionMaestraTramites;
	export let saving = false;

	const dispatch = createEventDispatcher<{
		close: void;
		save: { config: ConfiguracionMaestraTramites };
		resetSeed: void;
	}>();

	type TabConfig = 'documentos' | 'datos' | 'pasos' | 'ambitos';
	let activeTab: TabConfig = 'documentos';
	let searchTerm = '';
	let filtroAmbito = 'todos';

	// Estados de edición / alta para Documentos
	let docFormOpen = false;
	let editingDocId: string | null = null;
	let docForm: {
		titulo: string;
		descripcion: string;
		obligatorioPara: string;
		dependencia: string;
		parte: ParteTrato;
		costoEstimado: number;
		pagadoPor: QuienCubreCosto;
		obligatorio: boolean;
		activo: boolean;
		condicion: CondicionRegla;
		aplicaA: string[];
	} = createEmptyDocForm();

	// Estados de edición / alta para Datos
	let datoFormOpen = false;
	let editingDatoId: string | null = null;
	let datoForm: {
		titulo: string;
		campoClave: string;
		obligatorioPara: string;
		parte: ParteTrato;
		placeholder: string;
		ayudaFormato: string;
		condicion: CondicionRegla;
		aplicaA: string[];
		activo: boolean;
	} = createEmptyDatoForm();

	// Estados de edición / alta para Pasos
	let pasoFormOpen = false;
	let editingPasoId: string | null = null;
	let pasoForm: {
		orden: number;
		titulo: string;
		descripcion: string;
		responsable: string;
		parteRelacionada: NonNullable<PasoMaestro['parteRelacionada']>;
		duracionEstimadaDias: number;
		condicion: CondicionRegla;
		aplicaA: string[];
		activo: boolean;
	} = createEmptyPasoForm();

	// Estado para nuevo ámbito / dependencia
	let nuevoAmbitoNombre = '';
	let nuevoAmbitoTipo: 'modalidad' | 'institucion' = 'institucion';

	function createEmptyDocForm() {
		return {
			titulo: '',
			descripcion: '',
			obligatorioPara: '',
			dependencia: 'INFONAVIT',
			parte: 'comprador' as ParteTrato,
			costoEstimado: 0,
			pagadoPor: 'comprador' as QuienCubreCosto,
			obligatorio: true,
			activo: true,
			condicion: 'siempre' as CondicionRegla,
			aplicaA: ['infonavit_tradicional', 'infonavit_conyugal']
		};
	}

	function createEmptyDatoForm() {
		return {
			titulo: '',
			campoClave: '',
			obligatorioPara: '',
			parte: 'comprador' as ParteTrato,
			placeholder: '',
			ayudaFormato: '',
			condicion: 'siempre' as CondicionRegla,
			aplicaA: ['bancario', 'infonavit_tradicional', 'infonavit_conyugal'],
			activo: true
		};
	}

	function createEmptyPasoForm() {
		const nextOrden = (configMaestra?.pasos?.length || 0) + 1;
		return {
			orden: nextOrden,
			titulo: '',
			descripcion: '',
			responsable: 'Match Home',
			parteRelacionada: 'tramite_externo' as NonNullable<PasoMaestro['parteRelacionada']>,
			duracionEstimadaDias: 3,
			condicion: 'siempre' as CondicionRegla,
			aplicaA: ['infonavit_tradicional', 'infonavit_conyugal'],
			activo: true
		};
	}

	function formatCurrency(val: number | undefined) {
		const num = Number(val || 0);
		return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
	}

	function cloneMaestra(): ConfiguracionMaestraTramites {
		return {
			...configMaestra,
			ambitos: configMaestra.ambitos.map((a) => ({ ...a })),
			documentos: configMaestra.documentos.map((d) => ({ ...d, aplicaA: [...d.aplicaA] })),
			datos: configMaestra.datos.map((d) => ({ ...d, aplicaA: [...d.aplicaA] })),
			pasos: configMaestra.pasos.map((p) => ({ ...p, aplicaA: [...p.aplicaA] }))
		};
	}

	function emitSave(next: ConfiguracionMaestraTramites) {
		dispatch('save', { config: next });
	}

	function toggleSelection(list: string[], id: string): string[] {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	function selectAllModalidades(target: 'doc' | 'dato' | 'paso') {
		const mods = modalidades.map((m) => m.id);
		if (target === 'doc') docForm.aplicaA = Array.from(new Set([...docForm.aplicaA, ...mods]));
		if (target === 'dato') datoForm.aplicaA = Array.from(new Set([...datoForm.aplicaA, ...mods]));
		if (target === 'paso') pasoForm.aplicaA = Array.from(new Set([...pasoForm.aplicaA, ...mods]));
	}

	$: modalidades = (configMaestra?.ambitos || []).filter((a) => a.tipo === 'modalidad' && a.activo);
	$: instituciones = (configMaestra?.ambitos || []).filter(
		(a) => a.tipo === 'institucion' && a.activo
	);
	$: ambitoMap = new Map((configMaestra?.ambitos || []).map((a) => [a.id, a.nombre]));

	$: filteredDocs = (configMaestra?.documentos || []).filter((d) => {
		const q = searchTerm.trim().toLowerCase();
		const matchSearch =
			!q ||
			d.titulo.toLowerCase().includes(q) ||
			d.dependencia.toLowerCase().includes(q) ||
			d.descripcion.toLowerCase().includes(q);
		const matchAmbito = filtroAmbito === 'todos' || d.aplicaA.includes(filtroAmbito);
		return matchSearch && matchAmbito;
	});

	$: filteredDatos = (configMaestra?.datos || []).filter((d) => {
		const q = searchTerm.trim().toLowerCase();
		const matchSearch =
			!q || d.titulo.toLowerCase().includes(q) || d.campoClave.toLowerCase().includes(q);
		const matchAmbito = filtroAmbito === 'todos' || d.aplicaA.includes(filtroAmbito);
		return matchSearch && matchAmbito;
	});

	$: filteredPasos = [...(configMaestra?.pasos || [])]
		.sort((a, b) => a.orden - b.orden)
		.filter((p) => {
			const q = searchTerm.trim().toLowerCase();
			const matchSearch =
				!q || p.titulo.toLowerCase().includes(q) || p.responsable.toLowerCase().includes(q);
			const matchAmbito = filtroAmbito === 'todos' || p.aplicaA.includes(filtroAmbito);
			return matchSearch && matchAmbito;
		});

	// --- CRUD DOCUMENTOS ---
	function openNewDoc() {
		editingDocId = null;
		docForm = createEmptyDocForm();
		docFormOpen = true;
	}

	function openEditDoc(d: DocumentoMaestro) {
		editingDocId = d.id;
		docForm = {
			titulo: d.titulo,
			descripcion: d.descripcion || '',
			obligatorioPara: d.obligatorioPara || '',
			dependencia: d.dependencia || '',
			parte: d.parte,
			costoEstimado: Number(d.costoEstimado || 0),
			pagadoPor: d.pagadoPor || 'por_definir',
			obligatorio: d.obligatorio,
			activo: d.activo,
			condicion: d.condicion || 'siempre',
			aplicaA: [...d.aplicaA]
		};
		docFormOpen = true;
	}

	function saveDoc() {
		if (!docForm.titulo.trim()) return;
		if (docForm.aplicaA.length === 0) {
			alert('Selecciona al menos una modalidad o institución donde solicitan este documento.');
			return;
		}
		const next = cloneMaestra();
		const now = Date.now();

		if (editingDocId) {
			next.documentos = next.documentos.map((d) =>
				d.id === editingDocId
					? {
							...d,
							...docForm,
							titulo: docForm.titulo.trim(),
							descripcion: docForm.descripcion.trim(),
							obligatorioPara: docForm.obligatorioPara.trim() || 'Integración de expediente',
							dependencia: docForm.dependencia.trim() || 'Institución / Notaría',
							actualizadoEn: now
						}
					: d
			);
		} else {
			const slug = docForm.titulo
				.toUpperCase()
				.replace(/[^A-Z0-9]+/g, '_')
				.slice(0, 22);
			const nuevo: DocumentoMaestro = {
				id: `DOC_CUSTOM_${slug}_${now.toString().slice(-4)}`,
				titulo: docForm.titulo.trim(),
				descripcion: docForm.descripcion.trim(),
				obligatorioPara: docForm.obligatorioPara.trim() || 'Requisito operativo',
				dependencia: docForm.dependencia.trim() || 'Dependencia',
				parte: docForm.parte,
				costoEstimado: Number(docForm.costoEstimado || 0),
				pagadoPor: docForm.pagadoPor,
				obligatorio: docForm.obligatorio,
				aplicaA: [...docForm.aplicaA],
				condicion: docForm.condicion,
				activo: docForm.activo,
				creadoEn: now
			};
			next.documentos = [nuevo, ...next.documentos];
		}

		docFormOpen = false;
		emitSave(next);
	}

	function toggleDocActivo(id: string) {
		const next = cloneMaestra();
		next.documentos = next.documentos.map((d) =>
			d.id === id ? { ...d, activo: !d.activo, actualizadoEn: Date.now() } : d
		);
		emitSave(next);
	}

	function deleteDoc(id: string, titulo: string) {
		if (!window.confirm(`¿Eliminar el documento "${titulo}" del catálogo global?`)) return;
		const next = cloneMaestra();
		next.documentos = next.documentos.filter((d) => d.id !== id);
		emitSave(next);
	}

	// --- CRUD DATOS ---
	function openNewDato() {
		editingDatoId = null;
		datoForm = createEmptyDatoForm();
		datoFormOpen = true;
	}

	function openEditDato(d: DatoMaestro) {
		editingDatoId = d.id;
		datoForm = {
			titulo: d.titulo,
			campoClave: d.campoClave,
			obligatorioPara: d.obligatorioPara,
			parte: d.parte,
			placeholder: d.placeholder || '',
			ayudaFormato: d.ayudaFormato || '',
			condicion: d.condicion || 'siempre',
			aplicaA: [...d.aplicaA],
			activo: d.activo
		};
		datoFormOpen = true;
	}

	function saveDato() {
		if (!datoForm.titulo.trim()) return;
		if (datoForm.aplicaA.length === 0) {
			alert('Selecciona al menos una modalidad o institución donde se solicita este dato.');
			return;
		}
		const next = cloneMaestra();
		const now = Date.now();
		const claveLimpia =
			datoForm.campoClave.trim() ||
			'dato_' +
				datoForm.titulo
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '_')
					.slice(0, 24);

		if (editingDatoId) {
			next.datos = next.datos.map((d) =>
				d.id === editingDatoId
					? {
							...d,
							...datoForm,
							titulo: datoForm.titulo.trim(),
							campoClave: claveLimpia,
							obligatorioPara: datoForm.obligatorioPara.trim() || 'Expediente',
							actualizadoEn: now
						}
					: d
			);
		} else {
			const nuevo: DatoMaestro = {
				id: `DATO_CUSTOM_${now}`,
				campoClave: claveLimpia,
				titulo: datoForm.titulo.trim(),
				obligatorioPara: datoForm.obligatorioPara.trim() || 'Integración de expediente',
				parte: datoForm.parte,
				placeholder: datoForm.placeholder.trim(),
				ayudaFormato: datoForm.ayudaFormato.trim(),
				aplicaA: [...datoForm.aplicaA],
				condicion: datoForm.condicion,
				activo: datoForm.activo,
				creadoEn: now
			};
			next.datos = [nuevo, ...next.datos];
		}

		datoFormOpen = false;
		emitSave(next);
	}

	function toggleDatoActivo(id: string) {
		const next = cloneMaestra();
		next.datos = next.datos.map((d) =>
			d.id === id ? { ...d, activo: !d.activo, actualizadoEn: Date.now() } : d
		);
		emitSave(next);
	}

	function deleteDato(id: string, titulo: string) {
		if (!window.confirm(`¿Eliminar el dato "${titulo}" del catálogo global?`)) return;
		const next = cloneMaestra();
		next.datos = next.datos.filter((d) => d.id !== id);
		emitSave(next);
	}

	// --- CRUD PASOS ---
	function openNewPaso() {
		editingPasoId = null;
		pasoForm = createEmptyPasoForm();
		pasoFormOpen = true;
	}

	function openEditPaso(p: PasoMaestro) {
		editingPasoId = p.id;
		pasoForm = {
			orden: p.orden,
			titulo: p.titulo,
			descripcion: p.descripcion,
			responsable: p.responsable,
			parteRelacionada: p.parteRelacionada || 'tramite_externo',
			duracionEstimadaDias: Number(p.duracionEstimadaDias || 1),
			condicion: p.condicion || 'siempre',
			aplicaA: [...p.aplicaA],
			activo: p.activo
		};
		pasoFormOpen = true;
	}

	function savePaso() {
		if (!pasoForm.titulo.trim()) return;
		if (pasoForm.aplicaA.length === 0) {
			alert('Selecciona al menos una modalidad donde aplica este paso.');
			return;
		}
		const next = cloneMaestra();
		const now = Date.now();

		if (editingPasoId) {
			next.pasos = next.pasos.map((p) =>
				p.id === editingPasoId
					? {
							...p,
							...pasoForm,
							titulo: pasoForm.titulo.trim(),
							descripcion: pasoForm.descripcion.trim(),
							responsable: pasoForm.responsable.trim() || 'Match Home',
							duracionEstimadaDias: Math.max(1, Number(pasoForm.duracionEstimadaDias || 1)),
							actualizadoEn: now
						}
					: p
			);
		} else {
			const nuevo: PasoMaestro = {
				id: `PASO_CUSTOM_${now}`,
				orden: Number(pasoForm.orden || next.pasos.length + 1),
				titulo: pasoForm.titulo.trim(),
				descripcion: pasoForm.descripcion.trim(),
				responsable: pasoForm.responsable.trim() || 'Match Home',
				parteRelacionada: pasoForm.parteRelacionada,
				duracionEstimadaDias: Math.max(1, Number(pasoForm.duracionEstimadaDias || 1)),
				aplicaA: [...pasoForm.aplicaA],
				condicion: pasoForm.condicion,
				activo: pasoForm.activo,
				creadoEn: now
			};
			next.pasos = [...next.pasos, nuevo];
		}

		pasoFormOpen = false;
		emitSave(next);
	}

	function movePasoOrder(id: string, delta: number) {
		const sorted = [...configMaestra.pasos].sort((a, b) => a.orden - b.orden);
		const idx = sorted.findIndex((p) => p.id === id);
		if (idx < 0) return;
		const swapIdx = idx + delta;
		if (swapIdx < 0 || swapIdx >= sorted.length) return;
		const temp = sorted[idx];
		sorted[idx] = sorted[swapIdx];
		sorted[swapIdx] = temp;
		const next = cloneMaestra();
		next.pasos = sorted.map((p, i) => ({ ...p, orden: i + 1 }));
		emitSave(next);
	}

	function togglePasoActivo(id: string) {
		const next = cloneMaestra();
		next.pasos = next.pasos.map((p) =>
			p.id === id ? { ...p, activo: !p.activo, actualizadoEn: Date.now() } : p
		);
		emitSave(next);
	}

	function deletePaso(id: string, titulo: string) {
		if (!window.confirm(`¿Eliminar el paso "${titulo}" de las plantillas?`)) return;
		const next = cloneMaestra();
		next.pasos = next.pasos.filter((p) => p.id !== id);
		emitSave(next);
	}

	// --- CRUD ÁMBITOS / DEPENDENCIAS ---
	function addAmbito() {
		const nombre = nuevoAmbitoNombre.trim();
		if (!nombre) return;
		const prefix = nuevoAmbitoTipo === 'institucion' ? 'inst_' : 'mod_';
		const slug = nombre
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '_');
		const id = `${prefix}${slug}`;
		if (configMaestra.ambitos.some((a) => a.id === id)) {
			alert('Ya existe una modalidad o institución con un identificador similar.');
			return;
		}
		const next = cloneMaestra();
		const nuevo: AmbitoConfig = {
			id,
			nombre,
			tipo: nuevoAmbitoTipo,
			activo: true
		};
		next.ambitos = [...next.ambitos, nuevo];
		nuevoAmbitoNombre = '';
		emitSave(next);
	}

	function toggleAmbitoActivo(id: string) {
		const next = cloneMaestra();
		next.ambitos = next.ambitos.map((a) => (a.id === id ? { ...a, activo: !a.activo } : a));
		emitSave(next);
	}

	function handleResetSeed() {
		if (
			window.confirm(
				'¿Restaurar el catálogo base de documentos, datos y pasos? Los expedientes existentes no se borrarán, pero las reglas personalizadas del catálogo maestro volverán al estado inicial.'
			)
		) {
			dispatch('resetSeed');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) dispatch('close');
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="cfg-backdrop"
		transition:fade={{ duration: 150 }}
		on:click|self={() => dispatch('close')}
	>
		<div
			class="cfg-modal"
			role="dialog"
			aria-modal="true"
			aria-label="Configuración Maestra de Trámites"
			transition:scale={{ duration: 160, start: 0.96 }}
		>
			<!-- HEADER -->
			<header class="cfg-header">
				<div class="cfg-header-left">
					<div class="cfg-badge">⚙️ Configuración Global en Firebase</div>
					<h2>Motor Dinámico de Trámites, Documentos y Pasos</h2>
					<p>
						Agrega, edita o desactiva documentos (con costo y pagador), datos requeridos, pasos con
						días estimados y dependencias.
					</p>
				</div>
				<div class="cfg-header-right">
					<span class="save-indicator" class:saving>
						{saving ? '⏳ Guardando en Firebase...' : '● Sincronizado en Firebase'}
					</span>
					<button type="button" class="btn-close-x" on:click={() => dispatch('close')}>✕</button>
				</div>
			</header>

			<!-- TABS -->
			<nav class="cfg-tabs">
				<button
					type="button"
					class="cfg-tab"
					class:active={activeTab === 'documentos'}
					on:click={() => {
						activeTab = 'documentos';
						docFormOpen = false;
					}}
				>
					📄 Documentos ({configMaestra.documentos.length})
				</button>
				<button
					type="button"
					class="cfg-tab"
					class:active={activeTab === 'datos'}
					on:click={() => {
						activeTab = 'datos';
						datoFormOpen = false;
					}}
				>
					📋 Datos Requeridos ({configMaestra.datos.length})
				</button>
				<button
					type="button"
					class="cfg-tab"
					class:active={activeTab === 'pasos'}
					on:click={() => {
						activeTab = 'pasos';
						pasoFormOpen = false;
					}}
				>
					🧭 Pasos y Tiempos ({configMaestra.pasos.length})
				</button>
				<button
					type="button"
					class="cfg-tab"
					class:active={activeTab === 'ambitos'}
					on:click={() => (activeTab = 'ambitos')}
				>
					🏛️ Modalidades y Dependencias ({configMaestra.ambitos.length})
				</button>
			</nav>

			<!-- BARRA DE FILTROS + ACCIÓN PRINCIPAL -->
			{#if activeTab !== 'ambitos'}
				<div class="cfg-toolbar">
					<div class="cfg-filters">
						<input
							type="text"
							class="cfg-search"
							placeholder="Buscar por nombre, dependencia o clave..."
							bind:value={searchTerm}
						/>
						<select class="cfg-filter-select" bind:value={filtroAmbito}>
							<option value="todos">Todas las modalidades / dependencias</option>
							{#each configMaestra.ambitos.filter((a) => a.activo) as amb}
								<option value={amb.id}>{amb.nombre}</option>
							{/each}
						</select>
					</div>

					{#if activeTab === 'documentos'}
						<button type="button" class="btn-add-cfg" on:click={openNewDoc}>
							➕ Agregar documento para trámite
						</button>
					{:else if activeTab === 'datos'}
						<button type="button" class="btn-add-cfg" on:click={openNewDato}>
							➕ Agregar dato requerido
						</button>
					{:else if activeTab === 'pasos'}
						<button type="button" class="btn-add-cfg" on:click={openNewPaso}>
							➕ Agregar paso de trámite
						</button>
					{/if}
				</div>
			{/if}

			<!-- BODY -->
			<div class="cfg-body">
				<!-- ===================== TAB DOCUMENTOS ===================== -->
				{#if activeTab === 'documentos'}
					{#if docFormOpen}
						<div class="cfg-form-card">
							<div class="form-card-head">
								<h3>
									{editingDocId ? '✏️ Editar Documento del Catálogo' : '➕ Nuevo Documento para Trámite'}
								</h3>
								<button type="button" class="btn-cancel-sm" on:click={() => (docFormOpen = false)}>
									Cancelar
								</button>
							</div>

							{#if !editingDocId}
								<div class="info-banner-warn">
									<span>⚠️</span>
									<span>
										Al guardar este nuevo documento, aparecerá automáticamente marcado con
										<strong>⚠️ pendiente por confirmar</strong> en los trámites abiertos que coincidan
										con tu selección, para que confirmes <em>"Sí aplica"</em> o
										<em>"No aplica en este trámite"</em>.
									</span>
								</div>
							{/if}

							<div class="form-grid-2">
								<div class="field-group span-2">
									<label for="doc-titulo">Nombre del Documento *</label>
									<input
										id="doc-titulo"
										type="text"
										placeholder="Ej. Carta de vacunación del perro / Constancia adicional"
										bind:value={docForm.titulo}
									/>
								</div>

								<div class="field-group span-2">
									<label for="doc-desc">Descripción / Especificaciones</label>
									<textarea
										id="doc-desc"
										rows="2"
										placeholder="Detalles de vigencia, sellos, copias o formato requerido..."
										bind:value={docForm.descripcion}
									></textarea>
								</div>

								<div class="field-group">
									<label for="doc-dep">Dependencia / Institución que lo pide o emite</label>
									<input
										id="doc-dep"
										type="text"
										placeholder="Ej. INFONAVIT, Notaría, JMAS, RPP..."
										bind:value={docForm.dependencia}
									/>
								</div>

								<div class="field-group">
									<label for="doc-obpara">¿Para qué es obligatorio?</label>
									<input
										id="doc-obpara"
										type="text"
										placeholder="Ej. Inscripción de crédito / Escrituración"
										bind:value={docForm.obligatorioPara}
									/>
								</div>

								<div class="field-group">
									<label for="doc-parte">Parte Responsable de Entregarlo</label>
									<select id="doc-parte" bind:value={docForm.parte}>
										<option value="comprador">Parte Compradora / Arrendatario</option>
										<option value="vendedor">Parte Vendedora / Arrendador</option>
										<option value="inmueble">Inmueble / Operación</option>
									</select>
								</div>

								<div class="field-group">
									<label for="doc-cond">Condición de Activación</label>
									<select id="doc-cond" bind:value={docForm.condicion}>
										{#each Object.entries(LABELS_CONDICIONES) as [val, lbl]}
											<option value={val}>{lbl}</option>
										{/each}
									</select>
								</div>

								<div class="field-group">
									<label for="doc-costo">Costo Estimado ($ MXN)</label>
									<input
										id="doc-costo"
										type="number"
										min="0"
										step="10"
										bind:value={docForm.costoEstimado}
									/>
								</div>

								<div class="field-group">
									<label for="doc-pagador">¿Quién cubre este costo?</label>
									<select id="doc-pagador" bind:value={docForm.pagadoPor}>
										{#each Object.entries(LABELS_QUIEN_CUBRE) as [val, lbl]}
											<option value={val}>{lbl}</option>
										{/each}
									</select>
								</div>
							</div>

							<!-- LISTA MÚLTIPLE: DÓNDE SE SOLICITA -->
							<div class="aplica-section">
								<div class="aplica-head">
									<span>¿En dónde más lo están solicitando? (Selección múltiple) *</span>
									<button
										type="button"
										class="btn-link-sm"
										on:click={() => selectAllModalidades('doc')}
									>
										Marcar todas las modalidades
									</button>
								</div>

								<div class="aplica-group-label">Modalidades de Operación / Crédito</div>
								<div class="chips-multiselect">
									{#each modalidades as m}
										<button
											type="button"
											class="chip-opt"
											class:selected={docForm.aplicaA.includes(m.id)}
											on:click={() => (docForm.aplicaA = toggleSelection(docForm.aplicaA, m.id))}
										>
											{docForm.aplicaA.includes(m.id) ? '✓' : '+'} {m.nombre}
										</button>
									{/each}
								</div>

								<div class="aplica-group-label">Instituciones / Dependencias</div>
								<div class="chips-multiselect">
									{#each instituciones as inst}
										<button
											type="button"
											class="chip-opt inst"
											class:selected={docForm.aplicaA.includes(inst.id)}
											on:click={() =>
												(docForm.aplicaA = toggleSelection(docForm.aplicaA, inst.id))}
										>
											{docForm.aplicaA.includes(inst.id) ? '✓' : '+'} {inst.nombre}
										</button>
									{/each}
								</div>
							</div>

							<div class="form-checks-row">
								<label class="chk-inline">
									<input type="checkbox" bind:checked={docForm.obligatorio} />
									<span>Requisito obligatorio (cuenta en el % de documentos)</span>
								</label>
								<label class="chk-inline">
									<input type="checkbox" bind:checked={docForm.activo} />
									<span>Activo en el catálogo</span>
								</label>
							</div>

							<div class="form-actions">
								<button type="button" class="btn-save-cfg" on:click={saveDoc}>
									💾 {editingDocId ? 'Guardar Cambios' : 'Guardar Documento en Firebase'}
								</button>
							</div>
						</div>
					{:else}
						<div class="items-list">
							{#each filteredDocs as d (d.id)}
								<div class="cfg-item-row" class:inactive={!d.activo}>
									<div class="item-main">
										<div class="item-title-line">
											<span class="parte-pill {d.parte}">{d.parte}</span>
											<strong>{d.titulo}</strong>
											{#if !d.activo}
												<span class="badge-off">Inactivo</span>
											{/if}
										</div>
										{#if d.descripcion}
											<p class="item-desc">{d.descripcion}</p>
										{/if}
										<div class="item-meta-pills">
											<span class="meta-chip dep">🏛️ {d.dependencia}</span>
											<span class="meta-chip cost">
												💵 {d.costoEstimado > 0 ? formatCurrency(d.costoEstimado) : 'Sin costo'} •
												{LABELS_QUIEN_CUBRE[d.pagadoPor]}
											</span>
											<span class="meta-chip cond">⚖️ {LABELS_CONDICIONES[d.condicion]}</span>
										</div>
										<div class="item-aplica-tags">
											{#each d.aplicaA as ambId}
												<span class="amb-tag">{ambitoMap.get(ambId) || ambId}</span>
											{/each}
										</div>
									</div>

									<div class="item-actions">
										<button
											type="button"
											class="btn-icon-sm"
											title="Activar / Desactivar"
											on:click={() => toggleDocActivo(d.id)}
										>
											{d.activo ? '👁️' : '🚫'}
										</button>
										<button
											type="button"
											class="btn-icon-sm"
											title="Editar"
											on:click={() => openEditDoc(d)}
										>
											✏️
										</button>
										<button
											type="button"
											class="btn-icon-sm danger"
											title="Eliminar"
											on:click={() => deleteDoc(d.id, d.titulo)}
										>
											🗑️
										</button>
									</div>
								</div>
							{:else}
								<div class="empty-cfg">No hay documentos con el filtro seleccionado.</div>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- ===================== TAB DATOS ===================== -->
				{#if activeTab === 'datos'}
					{#if datoFormOpen}
						<div class="cfg-form-card">
							<div class="form-card-head">
								<h3>{editingDatoId ? '✏️ Editar Dato Requerido' : '➕ Nuevo Dato a Recabar'}</h3>
								<button
									type="button"
									class="btn-cancel-sm"
									on:click={() => (datoFormOpen = false)}
								>
									Cancelar
								</button>
							</div>

							<div class="form-grid-2">
								<div class="field-group span-2">
									<label for="dato-titulo">Nombre / Etiqueta del Dato *</label>
									<input
										id="dato-titulo"
										type="text"
										placeholder="Ej. Número de Crédito Infonavit / Folio de Avalúo"
										bind:value={datoForm.titulo}
									/>
								</div>

								<div class="field-group">
									<label for="dato-clave">Clave Técnica Única</label>
									<input
										id="dato-clave"
										type="text"
										placeholder="Ej. numeroCreditoInfonavit (se autogenera si se deja vacío)"
										bind:value={datoForm.campoClave}
									/>
								</div>

								<div class="field-group">
									<label for="dato-obpara">¿Para qué es obligatorio?</label>
									<input
										id="dato-obpara"
										type="text"
										placeholder="Ej. Escritura y Aviso de Retención"
										bind:value={datoForm.obligatorioPara}
									/>
								</div>

								<div class="field-group">
									<label for="dato-parte">Parte</label>
									<select id="dato-parte" bind:value={datoForm.parte}>
										<option value="comprador">Comprador</option>
										<option value="vendedor">Vendedor</option>
										<option value="inmueble">Inmueble</option>
									</select>
								</div>

								<div class="field-group">
									<label for="dato-cond">Condición</label>
									<select id="dato-cond" bind:value={datoForm.condicion}>
										{#each Object.entries(LABELS_CONDICIONES) as [val, lbl]}
											<option value={val}>{lbl}</option>
										{/each}
									</select>
								</div>

								<div class="field-group">
									<label for="dato-ph">Placeholder de ejemplo</label>
									<input id="dato-ph" type="text" bind:value={datoForm.placeholder} />
								</div>

								<div class="field-group">
									<label for="dato-ayuda">Ayuda de formato</label>
									<input id="dato-ayuda" type="text" bind:value={datoForm.ayudaFormato} />
								</div>
							</div>

							<div class="aplica-section">
								<div class="aplica-head">
									<span>¿En qué trámites se solicita este dato? *</span>
									<button
										type="button"
										class="btn-link-sm"
										on:click={() => selectAllModalidades('dato')}
									>
										Marcar todas las modalidades
									</button>
								</div>
								<div class="chips-multiselect">
									{#each modalidades as m}
										<button
											type="button"
											class="chip-opt"
											class:selected={datoForm.aplicaA.includes(m.id)}
											on:click={() =>
												(datoForm.aplicaA = toggleSelection(datoForm.aplicaA, m.id))}
										>
											{datoForm.aplicaA.includes(m.id) ? '✓' : '+'} {m.nombre}
										</button>
									{/each}
								</div>
							</div>

							<div class="form-actions">
								<button type="button" class="btn-save-cfg" on:click={saveDato}>
									💾 Guardar Dato en Firebase
								</button>
							</div>
						</div>
					{:else}
						<div class="items-list">
							{#each filteredDatos as d (d.id)}
								<div class="cfg-item-row" class:inactive={!d.activo}>
									<div class="item-main">
										<div class="item-title-line">
											<span class="parte-pill {d.parte}">{d.parte}</span>
											<strong>{d.titulo}</strong>
											<code class="code-key">{d.campoClave}</code>
											{#if !d.activo}<span class="badge-off">Inactivo</span>{/if}
										</div>
										<div class="item-meta-pills">
											<span class="meta-chip">{d.obligatorioPara}</span>
											<span class="meta-chip cond">⚖️ {LABELS_CONDICIONES[d.condicion]}</span>
										</div>
										<div class="item-aplica-tags">
											{#each d.aplicaA as ambId}
												<span class="amb-tag">{ambitoMap.get(ambId) || ambId}</span>
											{/each}
										</div>
									</div>
									<div class="item-actions">
										<button
											type="button"
											class="btn-icon-sm"
											on:click={() => toggleDatoActivo(d.id)}
										>
											{d.activo ? '👁️' : '🚫'}
										</button>
										<button type="button" class="btn-icon-sm" on:click={() => openEditDato(d)}>
											✏️
										</button>
										<button
											type="button"
											class="btn-icon-sm danger"
											on:click={() => deleteDato(d.id, d.titulo)}
										>
											🗑️
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- ===================== TAB PASOS Y TIEMPOS ===================== -->
				{#if activeTab === 'pasos'}
					{#if pasoFormOpen}
						<div class="cfg-form-card">
							<div class="form-card-head">
								<h3>
									{editingPasoId ? '✏️ Editar Paso de Plantilla' : '➕ Nuevo Paso de Trámite'}
								</h3>
								<button
									type="button"
									class="btn-cancel-sm"
									on:click={() => (pasoFormOpen = false)}
								>
									Cancelar
								</button>
							</div>

							<div class="form-grid-2">
								<div class="field-group span-2">
									<label for="paso-titulo">Título del Paso *</label>
									<input
										id="paso-titulo"
										type="text"
										placeholder="Ej. Entregar al tramitador oficial de INFONAVIT"
										bind:value={pasoForm.titulo}
									/>
								</div>

								<div class="field-group span-2">
									<label for="paso-desc">Descripción Operativa</label>
									<textarea id="paso-desc" rows="2" bind:value={pasoForm.descripcion}></textarea>
								</div>

								<div class="field-group">
									<label for="paso-resp">Responsable</label>
									<input
										id="paso-resp"
										type="text"
										placeholder="Ej. Match Home, Tramitador Infonavit, Notaría..."
										bind:value={pasoForm.responsable}
									/>
								</div>

								<div class="field-group">
									<label for="paso-dias">Duración Estimada (Días) *</label>
									<input
										id="paso-dias"
										type="number"
										min="1"
										bind:value={pasoForm.duracionEstimadaDias}
									/>
								</div>

								<div class="field-group">
									<label for="paso-orden">Orden Secuencial</label>
									<input id="paso-orden" type="number" min="1" bind:value={pasoForm.orden} />
								</div>

								<div class="field-group">
									<label for="paso-cond">Condición</label>
									<select id="paso-cond" bind:value={pasoForm.condicion}>
										{#each Object.entries(LABELS_CONDICIONES) as [val, lbl]}
											<option value={val}>{lbl}</option>
										{/each}
									</select>
								</div>
							</div>

							<div class="aplica-section">
								<div class="aplica-head">
									<span>Modalidades en las que aplica este paso *</span>
									<button
										type="button"
										class="btn-link-sm"
										on:click={() => selectAllModalidades('paso')}
									>
										Marcar todas las modalidades
									</button>
								</div>
								<div class="chips-multiselect">
									{#each modalidades as m}
										<button
											type="button"
											class="chip-opt"
											class:selected={pasoForm.aplicaA.includes(m.id)}
											on:click={() =>
												(pasoForm.aplicaA = toggleSelection(pasoForm.aplicaA, m.id))}
										>
											{pasoForm.aplicaA.includes(m.id) ? '✓' : '+'} {m.nombre}
										</button>
									{/each}
								</div>
							</div>

							<div class="form-actions">
								<button type="button" class="btn-save-cfg" on:click={savePaso}>
									💾 Guardar Paso en Firebase
								</button>
							</div>
						</div>
					{:else}
						<div class="items-list">
							{#each filteredPasos as p (p.id)}
								<div class="cfg-item-row" class:inactive={!p.activo}>
									<div class="item-main">
										<div class="item-title-line">
											<span class="orden-badge">#{p.orden}</span>
											<strong>{p.titulo}</strong>
											<span class="dias-badge">⏱️ {p.duracionEstimadaDias}d est.</span>
											{#if !p.activo}<span class="badge-off">Inactivo</span>{/if}
										</div>
										<p class="item-desc">{p.descripcion}</p>
										<div class="item-meta-pills">
											<span class="meta-chip dep">👤 {p.responsable}</span>
											<span class="meta-chip cond">⚖️ {LABELS_CONDICIONES[p.condicion]}</span>
										</div>
										<div class="item-aplica-tags">
											{#each p.aplicaA as ambId}
												<span class="amb-tag">{ambitoMap.get(ambId) || ambId}</span>
											{/each}
										</div>
									</div>

									<div class="item-actions">
										<button
											type="button"
											class="btn-icon-sm"
											title="Subir"
											on:click={() => movePasoOrder(p.id, -1)}
										>
											▲
										</button>
										<button
											type="button"
											class="btn-icon-sm"
											title="Bajar"
											on:click={() => movePasoOrder(p.id, 1)}
										>
											▼
										</button>
										<button
											type="button"
											class="btn-icon-sm"
											on:click={() => togglePasoActivo(p.id)}
										>
											{p.activo ? '👁️' : '🚫'}
										</button>
										<button type="button" class="btn-icon-sm" on:click={() => openEditPaso(p)}>
											✏️
										</button>
										<button
											type="button"
											class="btn-icon-sm danger"
											on:click={() => deletePaso(p.id, p.titulo)}
										>
											🗑️
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- ===================== TAB ÁMBITOS / DEPENDENCIAS ===================== -->
				{#if activeTab === 'ambitos'}
					<div class="ambitos-panel">
						<div class="cfg-form-card">
							<h3>➕ Agregar Nueva Modalidad o Dependencia a la Lista Múltiple</h3>
							<div class="add-ambito-row">
								<input
									type="text"
									placeholder="Ej. Infonavit Mejoravit, Secretaría de Desarrollo Urbano, Tesorería..."
									bind:value={nuevoAmbitoNombre}
								/>
								<select bind:value={nuevoAmbitoTipo}>
									<option value="institucion">Institución / Dependencia</option>
									<option value="modalidad">Modalidad de Crédito / Operación</option>
								</select>
								<button type="button" class="btn-add-cfg" on:click={addAmbito}>➕ Agregar</button>
							</div>
						</div>

						<div class="ambitos-columns">
							<div class="amb-col">
								<h4>Modalidades de Operación y Crédito</h4>
								{#each configMaestra.ambitos.filter((a) => a.tipo === 'modalidad') as amb}
									<div class="amb-row" class:inactive={!amb.activo}>
										<span>{amb.nombre}</span>
										<button
											type="button"
											class="btn-icon-sm"
											on:click={() => toggleAmbitoActivo(amb.id)}
										>
											{amb.activo ? '✓ Activa' : 'Inactiva'}
										</button>
									</div>
								{/each}
							</div>

							<div class="amb-col">
								<h4>Instituciones y Dependencias</h4>
								{#each configMaestra.ambitos.filter((a) => a.tipo === 'institucion') as amb}
									<div class="amb-row" class:inactive={!amb.activo}>
										<span>{amb.nombre}</span>
										<button
											type="button"
											class="btn-icon-sm"
											on:click={() => toggleAmbitoActivo(amb.id)}
										>
											{amb.activo ? '✓ Activa' : 'Inactiva'}
										</button>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- FOOTER -->
			<footer class="cfg-footer">
				<button type="button" class="btn-reset-seed" on:click={handleResetSeed}>
					🔄 Restaurar Catálogo Base
				</button>
				<button type="button" class="btn-done-close" on:click={() => dispatch('close')}>
					Listo / Cerrar
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.cfg-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(5px);
		z-index: 950;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.cfg-modal {
		width: min(1040px, 100%);
		height: min(88vh, 860px);
		max-height: 90vh;
		background: var(--surface-1, #18181b);
		border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
	}

	.cfg-header {
		flex-shrink: 0;
		padding: 1.15rem 1.4rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), transparent);
	}

	.cfg-badge {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 700;
		color: #818cf8;
		background: rgba(99, 102, 241, 0.16);
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		margin-bottom: 0.35rem;
	}

	.cfg-header h2 {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-1, #fff);
		margin-bottom: 0.2rem;
	}

	.cfg-header p {
		font-size: 0.8rem;
		color: var(--text-muted, #a1a1aa);
	}

	.cfg-header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.save-indicator {
		font-size: 0.74rem;
		font-weight: 600;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.save-indicator.saving {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.14);
	}

	.btn-close-x {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border);
		color: var(--text-1);
		width: 32px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 700;
	}

	.cfg-tabs {
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0.65rem 1.4rem;
		border-bottom: 1px solid var(--border);
		background: rgba(0, 0, 0, 0.18);
	}

	.cfg-tab {
		padding: 0.48rem 0.85rem;
		border-radius: 8px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.cfg-tab.active {
		background: rgba(99, 102, 241, 0.16);
		border-color: rgba(99, 102, 241, 0.4);
		color: #a5b4fc;
	}

	.cfg-toolbar {
		flex-shrink: 0;
		padding: 0.85rem 1.4rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--border);
	}

	.cfg-filters {
		display: flex;
		gap: 0.5rem;
		flex: 1;
		min-width: 260px;
	}

	.cfg-search,
	.cfg-filter-select {
		background: var(--surface-card, #27272a);
		border: 1px solid var(--border);
		color: var(--text-1);
		padding: 0.45rem 0.75rem;
		border-radius: 8px;
		font-size: 0.82rem;
	}

	.cfg-search {
		flex: 1;
	}

	.btn-add-cfg {
		background: linear-gradient(135deg, #6366f1, #4f46e5);
		color: #ffffff;
		border: none;
		padding: 0.5rem 0.95rem;
		border-radius: 8px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.cfg-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 1.15rem 1.4rem;
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.cfg-item-row {
		background: var(--surface-card, #27272a);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.85rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.cfg-item-row.inactive {
		opacity: 0.52;
	}

	.item-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.item-title-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		font-size: 0.9rem;
		color: var(--text-1);
	}

	.parte-pill {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 0.12rem 0.45rem;
		border-radius: 5px;
	}

	.parte-pill.comprador {
		background: rgba(56, 189, 248, 0.16);
		color: #38bdf8;
	}
	.parte-pill.vendedor {
		background: rgba(168, 85, 247, 0.18);
		color: #c084fc;
	}
	.parte-pill.inmueble {
		background: rgba(16, 185, 129, 0.16);
		color: #34d399;
	}

	.orden-badge {
		background: #4f46e5;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.12rem 0.45rem;
		border-radius: 6px;
	}

	.dias-badge {
		background: rgba(245, 158, 11, 0.16);
		color: #fbbf24;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.12rem 0.5rem;
		border-radius: 6px;
	}

	.code-key {
		font-size: 0.72rem;
		background: rgba(0, 0, 0, 0.3);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		color: #94a3b8;
	}

	.badge-off {
		font-size: 0.68rem;
		background: rgba(239, 68, 68, 0.18);
		color: #f87171;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}

	.item-desc {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.item-meta-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.meta-chip {
		font-size: 0.72rem;
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
		padding: 0.15rem 0.5rem;
		border-radius: 5px;
	}

	.meta-chip.cost {
		color: #34d399;
		background: rgba(16, 185, 129, 0.12);
	}

	.item-aplica-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.15rem;
	}

	.amb-tag {
		font-size: 0.67rem;
		background: rgba(99, 102, 241, 0.12);
		color: #a5b4fc;
		padding: 0.1rem 0.42rem;
		border-radius: 4px;
	}

	.item-actions {
		display: flex;
		gap: 0.35rem;
	}

	.btn-icon-sm {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border);
		color: var(--text-1);
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.78rem;
	}

	.btn-icon-sm.danger:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: #ef4444;
	}

	/* FORMULARIO */
	.cfg-form-card {
		background: var(--surface-card, #27272a);
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-radius: 12px;
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.form-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.form-card-head h3 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.btn-cancel-sm {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 0.3rem 0.7rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.78rem;
	}

	.info-banner-warn {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.35);
		color: #fcd34d;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		font-size: 0.78rem;
	}

	.form-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	@media (max-width: 640px) {
		.form-grid-2 {
			grid-template-columns: 1fr;
		}
	}

	.span-2 {
		grid-column: 1 / -1;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.field-group label {
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.field-group input,
	.field-group select,
	.field-group textarea {
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--border);
		color: var(--text-1);
		padding: 0.48rem 0.7rem;
		border-radius: 7px;
		font-size: 0.84rem;
		font-family: inherit;
	}

	.aplica-section {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.aplica-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.btn-link-sm {
		background: transparent;
		border: none;
		color: #818cf8;
		font-size: 0.76rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.aplica-group-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-weight: 600;
		margin-top: 0.2rem;
	}

	.chips-multiselect {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip-opt {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 0.3rem 0.65rem;
		border-radius: 999px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.chip-opt.selected {
		background: rgba(99, 102, 241, 0.22);
		border-color: #6366f1;
		color: #e0e7ff;
		font-weight: 600;
	}

	.chip-opt.inst.selected {
		background: rgba(56, 189, 248, 0.2);
		border-color: #38bdf8;
		color: #e0f2fe;
	}

	.form-checks-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
	}

	.chk-inline {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8rem;
		color: var(--text-1);
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
	}

	.btn-save-cfg {
		background: #10b981;
		color: #052e16;
		border: none;
		padding: 0.55rem 1.2rem;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.84rem;
		cursor: pointer;
	}

	.add-ambito-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.add-ambito-row input {
		flex: 1;
		min-width: 220px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--border);
		color: var(--text-1);
		padding: 0.48rem 0.75rem;
		border-radius: 8px;
	}

	.add-ambito-row select {
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--border);
		color: var(--text-1);
		padding: 0.48rem 0.75rem;
		border-radius: 8px;
	}

	.ambitos-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	@media (max-width: 680px) {
		.ambitos-columns {
			grid-template-columns: 1fr;
		}
	}

	.amb-col {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.amb-col h4 {
		font-size: 0.84rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.25rem;
	}

	.amb-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.55rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
		font-size: 0.8rem;
		color: var(--text-1);
	}

	.amb-row.inactive {
		opacity: 0.5;
	}

	.empty-cfg {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.cfg-footer {
		flex-shrink: 0;
		padding: 0.85rem 1.4rem;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(0, 0, 0, 0.2);
	}

	.btn-reset-seed {
		background: transparent;
		border: 1px solid rgba(245, 158, 11, 0.35);
		color: #fbbf24;
		padding: 0.42rem 0.8rem;
		border-radius: 8px;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.btn-done-close {
		background: var(--surface-card);
		border: 1px solid var(--border);
		color: var(--text-1);
		padding: 0.45rem 1rem;
		border-radius: 8px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}
</style>