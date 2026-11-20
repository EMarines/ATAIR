<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import '../../styles/main.css';

	interface TramiteExpediente {
		id: string;
		folderName: string;
		tipoOperacion: string;
		modalidadCredito: string;
		estadoTramite: string;
		fechaApertura: string;
		inmueble: {
			calle: string;
			numeroEscritura: string;
			numeroOficial: string;
			colonia: string;
			codigoPostal: string;
			ciudad: string;
			estado: string;
			claveCatastral: string;
			folioReal: string;
			superficieTerrenoM2: number;
			superficieConstruccionM2: number;
			medidasColindancias: Record<string, string>;
			antecedentePropiedad: {
				tipoActo: string;
				numeroEscritura: string;
				volumen: string;
				fecha: string;
				notario: string;
				numeroNotaria: number;
				distrito: string;
				rppInscripcion: string;
				rppFolio: string;
				rppLibro: string;
				rppSeccion: string;
				rppFecha: string;
			};
			equipamientoIncluido?: string[];
		};
		partes: {
			vendedora: {
				nombre: string;
				nombreEnEscritura: string;
				estadoCivil: string;
				curp: string;
				claveElector: string;
				vigenciaIne: string;
				domicilio: string;
				telefono?: string;
			};
			compradorTitular: {
				nombre: string;
				curp: string;
				nss: string;
				claveElector: string;
				vigenciaIne: string;
				domicilio: string;
				telefono?: string;
				infonavit: {
					montoCredito: number;
					saldoSubcuentaVivienda: number;
					gastosTitulacion: number;
					retencionMensual: number;
					tasaInteres: number;
				};
			};
			compradoraConyuge: {
				nombre: string;
				curp: string;
				nss: string;
				claveElector: string;
				vigenciaIne: string;
				domicilio: string;
				infonavit: {
					montoCredito: number;
					saldoSubcuentaVivienda: number;
					gastosTitulacion: number;
					retencionMensual: number;
					tasaInteres: number;
				};
			};
		};
		financiero: {
			precioPactado: number;
			apartadoEfectivo: number;
			fechaApartado: string;
			saldoRestante: number;
			montoNetoInfonavit: number;
			gapRecursosPropios: number;
			estimadoGastosEscrituracionComprador: number;
			porcentajeComisionInmobiliaria?: number;
			comisionInmobiliariaPactada: number;
			penalizacionTotal?: number;
			repartoPenalizacion?: {
				parteAfectada: number;
				inmobiliaria: number;
			};
		};
		documentos: Array<{ nombre: string; tipo: string; estatus: string }>;
		checklistComprador: Array<{
			id: string;
			concepto: string;
			obligatorioPara: string;
			estatus: string;
			completado: boolean;
		}>;
		checklistVendedor: Array<{
			id: string;
			concepto: string;
			obligatorioPara: string;
			estatus: string;
			completado: boolean;
		}>;
	}

	// Lista de trámites (cargada dinámicamente o fallback canónico)
	let tramites: TramiteExpediente[] = [];
	let selectedTramite: TramiteExpediente | null = null;
	let activeTab: 'general' | 'financiero' | 'checklist' | 'documentos' = 'general';
	let searchQuery = '';
	let filterEstado = 'todos';
	let notificationMsg = '';

	const formatCurrency = (val: number) => {
		if (isNaN(val)) return '$0.00';
		return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
	};

	onMount(async () => {
		try {
			// Intentamos cargar el expediente del caso piloto desde static
			const res = await fetch('/tramites/Espinoza%20-%20Mu%C3%B1oz/expediente.json');
			if (res.ok) {
				const data: TramiteExpediente = await res.json();
				tramites = [data];
				selectedTramite = data;
			}
		} catch (e) {
			console.warn('Cargando expediente canónico integrado:', e);
		}
	});

	$: filteredTramites = tramites.filter((t) => {
		const matchQuery =
			t.folderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.partes.vendedora.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.partes.compradorTitular.nombre.toLowerCase().includes(searchQuery.toLowerCase());
		return matchQuery;
	});

	function selectTramite(t: TramiteExpediente) {
		selectedTramite = t;
	}

	function toggleChecklistItem(item: any) {
		item.completado = !item.completado;
		item.estatus = item.completado ? 'Recibido / Verificado' : 'Pendiente de Solicitar';
		tramites = [...tramites];
		showToast(`Requisito actualizado: ${item.concepto}`);
	}

	function showToast(msg: string) {
		notificationMsg = msg;
		setTimeout(() => {
			notificationMsg = '';
		}, 3000);
	}

	function requestViaWhatsapp(concepto: string, destinatario: string) {
		const text = encodeURIComponent(
			`Hola ${destinatario}, gusto en saludarte de Match Home Bienes Raíces. Te escribimos para dar seguimiento a tu trámite de compraventa. Para continuar con la integración de tu expediente en Notaría e Infonavit, necesitamos nos apoyes con: *${concepto}*. ¡Quedamos atentos!`
		);
		window.open(`https://wa.me/?text=${text}`, '_blank');
	}
</script>

<svelte:head>
	<title>Trámites Inmobiliarios | ATAIR SGI</title>
</svelte:head>

<div class="page-container">
	{#if notificationMsg}
		<div class="toast" transition:fade>{notificationMsg}</div>
	{/if}

	<!-- HEADER PRINCIPAL -->
	<header class="module-header">
		<div class="header-content">
			<div class="badge-tag">Módulo Oficial ATAIR SGI • COMPASS</div>
			<h1>Gestor de Trámites & Expedientes</h1>
			<p class="subtitle">
				Bóveda documental por subcarpetas, extracción de generales con IA, revisión preventiva y autollenado de contratos de compraventa y renta.
			</p>
		</div>
		<div class="header-actions">
			<button class="btn-refresh" on:click={() => showToast('Subcarpetas sincronizadas')}>
				🔄 Sincronizar Carpetas
			</button>
			<button class="btn-primary" on:click={() => showToast('Abre la carpeta tramites/ en disco para agregar una nueva')}>
				➕ Nueva Subcarpeta
			</button>
		</div>
	</header>

	<!-- BARRA DE BÚSQUEDA Y CONTROL -->
	<div class="controls-bar">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				placeholder="Buscar por apellidos (ej. Espinoza - Muñoz), comprador o calle..."
				bind:value={searchQuery}
			/>
		</div>
		<div class="stats-pills">
			<div class="stat-pill">
				<span class="stat-num">{tramites.length}</span>
				<span class="stat-lbl">En Proceso</span>
			</div>
			<div class="stat-pill active">
				<span class="stat-num">1</span>
				<span class="stat-lbl">Infonavit Conyugal</span>
			</div>
			<div class="stat-pill">
				<span class="stat-num">4%</span>
				<span class="stat-lbl">Comisión Pactada</span>
			</div>
		</div>
	</div>

	<!-- CONTENIDO DUAL: LISTA DE TRÁMITES + DETALLE EXPEDIENTE -->
	<div class="layout-grid">
		<!-- COLUMNA IZQUIERDA: TARJETAS DE TRÁMITES -->
		<aside class="sidebar-tramites">
			<div class="sidebar-header">
				<h2>Expedientes Activos</h2>
				<span class="badge-count">{filteredTramites.length}</span>
			</div>

			<div class="cards-list">
				{#each filteredTramites as t}
					<div
						class="tramite-card"
						class:active={selectedTramite?.id === t.id}
						on:click={() => selectTramite(t)}
						role="button"
						tabindex="0"
					>
						<div class="card-top">
							<span class="folder-name">📁 {t.folderName}</span>
							<span class="badge-credit">{t.modalidadCredito}</span>
						</div>
						<div class="property-line">
							📍 {t.inmueble.calle} #{t.inmueble.numeroOficial}, {t.inmueble.colonia}
						</div>
						<div class="parties-line">
							<span class="vendedor">Vend: {t.partes.vendedora.nombre.split(' ')[0]} {t.partes.vendedora.nombre.split(' ')[1]}</span>
							<span class="divider">•</span>
							<span class="comprador">Comp: {t.partes.compradorTitular.nombre.split(' ')[0]}</span>
						</div>
						<div class="card-bottom">
							<div class="price-tag">{formatCurrency(t.financiero.precioPactado)}</div>
							<span class="status-indicator yellow">🟡 Contrato Listo</span>
						</div>
					</div>
				{:else}
					<div class="empty-state">No se encontraron trámites con ese término de búsqueda.</div>
				{/each}
			</div>
		</aside>

		<!-- COLUMNA DERECHA: EXPEDIENTE DETALLADO -->
		{#if selectedTramite}
			<main class="main-expediente" transition:fade>
				<!-- HEADER DEL TRÁMITE SELECCIONADO -->
				<div class="expediente-banner">
					<div class="banner-title-area">
						<div class="path-bread">📁 /tramites/{selectedTramite.folderName}</div>
						<h2>{selectedTramite.folderName}</h2>
						<p class="summary-text">
							Operación de <strong>{selectedTramite.tipoOperacion}</strong> mediante <strong>{selectedTramite.modalidadCredito}</strong>.
							Casa habitación en {selectedTramite.inmueble.colonia}, Chihuahua.
						</p>
					</div>

					<div class="download-action">
						<a
							href="/tramites/Espinoza%20-%20Mu%C3%B1oz/CONTRATO_COMPRAVENTA_ESPINOZA_MU%C3%91OZ_ACTUALIZADO.docx"
							download="CONTRATO_COMPRAVENTA_ESPINOZA_MUÑOZ_ACTUALIZADO.docx"
							class="btn-download-contract"
						>
							📄 Descargar Contrato Word (.docx)
						</a>
						<span class="sub-download">Formato limpio • Comisión 4% • 50/50 penalización</span>
					</div>
				</div>

				<!-- TABS DE NAVEGACIÓN -->
				<nav class="tabs-nav">
					<button
						class="tab-btn"
						class:active={activeTab === 'general'}
						on:click={() => (activeTab = 'general')}
					>
						👥 Generales de las Partes
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'financiero'}
						on:click={() => (activeTab = 'financiero')}
					>
						💰 Radiografía Financiera
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'checklist'}
						on:click={() => (activeTab = 'checklist')}
					>
						📋 Checklist de Faltantes
						<span class="badge-alert">
							{((selectedTramite.checklistComprador || []).filter(f => !f.completado).length) +
								((selectedTramite.checklistVendedor || []).filter(f => !f.completado).length)}
						</span>
					</button>
					<button
						class="tab-btn"
						class:active={activeTab === 'documentos'}
						on:click={() => (activeTab = 'documentos')}
					>
						📂 Bóveda ({selectedTramite.documentos.length} docs)
					</button>
				</nav>

				<!-- CONTENIDO DE TABS -->
				<div class="tab-body">
					<!-- TAB 1: GENERALES -->
					{#if activeTab === 'general'}
						<div class="grid-2-cols" transition:fade>
							<!-- VENDEDORA -->
							<div class="detail-card">
								<div class="card-title">
									<span>Parte Vendedora</span>
									<span class="badge-status-green">Divorciada • Propios Derechos</span>
								</div>
								<div class="field-row">
									<label>Nombre:</label>
									<span>{selectedTramite.partes.vendedora.nombre}</span>
								</div>
								<div class="field-row">
									<label>En Escritura:</label>
									<span class="text-dim">{selectedTramite.partes.vendedora.nombreEnEscritura}</span>
								</div>
								<div class="field-row">
									<label>CURP / RFC:</label>
									<span class="code-span">{selectedTramite.partes.vendedora.curp}</span>
								</div>
								<div class="field-row">
									<label>Clave Elector:</label>
									<span>{selectedTramite.partes.vendedora.claveElector} (Vigente {selectedTramite.partes.vendedora.vigenciaIne})</span>
								</div>
								<div class="field-row">
									<label>Domicilio:</label>
									<span>{selectedTramite.partes.vendedora.domicilio}</span>
								</div>
							</div>

							<!-- COMPRADORES INFONAVIT CONYUGAL -->
							<div class="detail-card">
								<div class="card-title">
									<span>Parte Compradora (Coacreditados)</span>
									<span class="badge-status-blue">Infonavit Conyugal</span>
								</div>
								<!-- TITULAR -->
								<div class="sub-party">
									<div class="sub-party-title">Titular: {selectedTramite.partes.compradorTitular.nombre}</div>
									<div class="field-row">
										<label>CURP:</label>
										<span class="code-span">{selectedTramite.partes.compradorTitular.curp}</span>
									</div>
									<div class="field-row">
										<label>NSS Infonavit:</label>
										<span class="code-span highlight">{selectedTramite.partes.compradorTitular.nss}</span>
									</div>
									<div class="field-row">
										<label>Crédito / Subcuenta:</label>
										<span>{formatCurrency(selectedTramite.partes.compradorTitular.infonavit.montoCredito)} crédito + {formatCurrency(selectedTramite.partes.compradorTitular.infonavit.saldoSubcuentaVivienda)} SSV</span>
									</div>
								</div>

								<!-- CONYUGE -->
								<div class="sub-party mt-2">
									<div class="sub-party-title">Cónyuge: {selectedTramite.partes.compradoraConyuge.nombre}</div>
									<div class="field-row">
										<label>CURP:</label>
										<span class="code-span">{selectedTramite.partes.compradoraConyuge.curp}</span>
									</div>
									<div class="field-row">
										<label>NSS Infonavit:</label>
										<span class="code-span highlight">{selectedTramite.partes.compradoraConyuge.nss}</span>
									</div>
									<div class="field-row">
										<label>Crédito / Subcuenta:</label>
										<span>{formatCurrency(selectedTramite.partes.compradoraConyuge.infonavit.montoCredito)} crédito + {formatCurrency(selectedTramite.partes.compradoraConyuge.infonavit.saldoSubcuentaVivienda)} SSV</span>
									</div>
								</div>
							</div>

							<!-- INMUEBLE Y REGISTRO PUBLICO -->
							<div class="detail-card full-width">
								<div class="card-title">
									<span>Inmueble y Datos Registrales (RPPyC Morelos)</span>
									<span class="badge-status-purple">Escritura Donación No. 5,295 Notaría 12</span>
								</div>
								<div class="grid-3-cols">
									<div class="field-col">
										<label>Ubicación:</label>
										<span>{selectedTramite.inmueble.calle} #{selectedTramite.inmueble.numeroOficial} (en escritura: {selectedTramite.inmueble.numeroEscritura})</span>
									</div>
									<div class="field-col">
										<label>Superficies:</label>
										<span>Terreno: {selectedTramite.inmueble.superficieTerrenoM2} m² • Constr: {selectedTramite.inmueble.superficieConstruccionM2} m²</span>
									</div>
									<div class="field-col">
										<label>Clave Catastral / Folio Real:</label>
										<span class="code-span">{selectedTramite.inmueble.claveCatastral} • {selectedTramite.inmueble.folioReal}</span>
									</div>
									<div class="field-col">
										<label>Inscripción RPPyC:</label>
										<span>Inscripción {selectedTramite.inmueble.antecedentePropiedad.rppInscripcion}, Folio {selectedTramite.inmueble.antecedentePropiedad.rppFolio}, Libro {selectedTramite.inmueble.antecedentePropiedad.rppLibro}</span>
									</div>
									<div class="field-col">
										<label>Notaría de Origen:</label>
										<span>Notaría No. 12 (Lic. Armando Herrera Acosta, 1975)</span>
									</div>
									<div class="field-col">
										<label>Colindancias:</label>
										<span>11.00m Norte, Sur, Este y Oeste (121 m² total)</span>
									</div>
								</div>

								<!-- EQUIPAMIENTO PACTADO -->
								{#if selectedTramite.inmueble.equipamientoIncluido}
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

					<!-- TAB 2: FINANCIERO -->
					{#if activeTab === 'financiero'}
						<div class="financial-container" transition:fade>
							<div class="financial-cards-row">
								<div class="fin-stat-card">
									<div class="fin-lbl">Precio Pactado</div>
									<div class="fin-val">{formatCurrency(selectedTramite.financiero.precioPactado)}</div>
									<div class="fin-sub">Operación Total</div>
								</div>
								<div class="fin-stat-card green">
									<div class="fin-lbl">Apartado en Garantía</div>
									<div class="fin-val">{formatCurrency(selectedTramite.financiero.apartadoEfectivo)}</div>
									<div class="fin-sub">Recibido 19-Nov-2026</div>
								</div>
								<div class="fin-stat-card blue">
									<div class="fin-lbl">Neto Infonavit</div>
									<div class="fin-val">{formatCurrency(selectedTramite.financiero.montoNetoInfonavit)}</div>
									<div class="fin-sub">Crédito + Subcuentas</div>
								</div>
								<div class="fin-stat-card orange">
									<div class="fin-lbl">Recursos Propios (Gap)</div>
									<div class="fin-val">{formatCurrency(selectedTramite.financiero.gapRecursosPropios)}</div>
									<div class="fin-sub">A pagar en Notaría</div>
								</div>
							</div>

							<!-- DETALLE DE COMISIÓN Y PENALIZACIÓN PACTADA -->
							<div class="detail-card mt-3">
								<div class="card-title">
									<span>Condiciones Comerciales e Intermediación (Match Home)</span>
									<span class="badge-status-green">Pacto 4% • 50/50</span>
								</div>
								<div class="grid-2-cols">
									<div class="commission-box">
										<div class="box-head">Comisión Inmobiliaria (4%)</div>
										<div class="box-number">{formatCurrency(selectedTramite.financiero.comisionInmobiliariaPactada)}</div>
										<p class="box-desc">
											Correspondiente al 4% pactado sobre el precio total ($2,150,000 M.N.) a cargo exclusivo de la vendedora al escriturar.
										</p>
									</div>
									<div class="commission-box">
										<div class="box-head">Pena Convencional ($100,000 M.N.)</div>
										<div class="box-number">50% Afectado / 50% Inmobiliaria</div>
										<p class="box-desc">
											En caso de revocación injustificada: $50,000 M.N. para la parte inocente y $50,000 M.N. para Match Home por gastos devengados.
										</p>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB 3: CHECKLIST DE FALTANTES (SEPARADO COMPRADOR Y VENDEDOR) -->
					{#if activeTab === 'checklist'}
						<div class="checklist-container" transition:fade>
							<!-- SECCIÓN 1: COMPRADORES -->
							<div class="checklist-section">
								<div class="section-badge-header buyer">
									<div class="sec-left">
										<span class="sec-icon">🛒</span>
										<div>
											<h3>Documentos de la Parte Compradora</h3>
											<p>Jorge Ricardo Espinosa Miranda & Yamel Ivette Ramírez Flores (Infonavit Conyugal)</p>
										</div>
									</div>
									<div class="sec-stats">
										<span class="stat-pill-mini green">
											{(selectedTramite.checklistComprador || []).filter(c => c.completado).length} de {(selectedTramite.checklistComprador || []).length} listos
										</span>
									</div>
								</div>

								<div class="checklist-table">
									{#each (selectedTramite.checklistComprador || []) as item}
										<div class="check-row" class:completed={item.completado}>
											<div class="check-col-box">
												<input
													type="checkbox"
													checked={item.completado}
													on:change={() => toggleChecklistItem(item)}
												/>
											</div>
											<div class="check-col-main">
												<div class="item-title">{item.concepto}</div>
												<div class="item-meta">
													<span class="target">Obligatorio para: <strong>{item.obligatorioPara}</strong></span>
												</div>
											</div>
											<div class="check-col-status">
												<span class="status-pill" class:green={item.completado} class:yellow={!item.completado}>
													{item.estatus}
												</span>
											</div>
											<div class="check-col-action">
												{#if !item.completado}
													<button
														class="btn-wa-req"
														on:click={() => requestViaWhatsapp(item.concepto, 'Jorge y Yamel')}
													>
														📲 Pedir a Compradores
													</button>
												{:else}
													<span class="check-done">✓ En Bóveda</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- SECCIÓN 2: VENDEDORA -->
							<div class="checklist-section mt-4">
								<div class="section-badge-header seller">
									<div class="sec-left">
										<span class="sec-icon">🏷️</span>
										<div>
											<h3>Documentos de la Parte Vendedora</h3>
											<p>Flora Elena Muñoz Valenzuela (Propietaria • Divorciada)</p>
										</div>
									</div>
									<div class="sec-stats">
										<span class="stat-pill-mini green">
											{(selectedTramite.checklistVendedor || []).filter(c => c.completado).length} de {(selectedTramite.checklistVendedor || []).length} listos
										</span>
									</div>
								</div>

								<div class="checklist-table">
									{#each (selectedTramite.checklistVendedor || []) as item}
										<div class="check-row" class:completed={item.completado}>
											<div class="check-col-box">
												<input
													type="checkbox"
													checked={item.completado}
													on:change={() => toggleChecklistItem(item)}
												/>
											</div>
											<div class="check-col-main">
												<div class="item-title">{item.concepto}</div>
												<div class="item-meta">
													<span class="target">Obligatorio para: <strong>{item.obligatorioPara}</strong></span>
												</div>
											</div>
											<div class="check-col-status">
												<span class="status-pill" class:green={item.completado} class:yellow={!item.completado}>
													{item.estatus}
												</span>
											</div>
											<div class="check-col-action">
												{#if !item.completado}
													<button
														class="btn-wa-req seller"
														on:click={() => requestViaWhatsapp(item.concepto, 'Sra. Flora Elena')}
													>
														📲 Pedir a Vendedora
													</button>
												{:else}
													<span class="check-done">✓ En Bóveda</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB 4: BÓVEDA DOCUMENTAL -->
					{#if activeTab === 'documentos'}
						<div class="vault-container" transition:fade>
							<div class="vault-header">
								<h3>Archivos en Subcarpeta (/tramites/Espinoza - Muñoz)</h3>
								<span class="vault-count">{selectedTramite.documentos.length} archivos indexados</span>
							</div>

							<div class="vault-grid">
								{#each selectedTramite.documentos as doc}
									<div class="doc-card">
										<div class="doc-icon">
											{#if doc.nombre.endsWith('.docx')}
												📝
											{:else if doc.nombre.endsWith('.pdf')}
												📕
											{:else if doc.nombre.endsWith('.xlsx')}
												📊
											{:else}
												🖼️
											{/if}
										</div>
										<div class="doc-info">
											<div class="doc-name" title={doc.nombre}>{doc.nombre}</div>
											<div class="doc-type">{doc.tipo} • <span class="doc-ok">✓ {doc.estatus}</span></div>
										</div>
										<div class="doc-actions">
											<a
												href="/tramites/Espinoza%20-%20Mu%C3%B1oz/{encodeURIComponent(doc.nombre)}"
												download={doc.nombre}
												class="btn-download-sm"
												target="_blank"
											>
												⬇️ Descargar
											</a>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</main>
		{/if}
	</div>
</div>

<style>
	.page-container {
		width: 100%;
		max-width: 1350px;
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
		font-weight: 500;
		font-size: 0.9rem;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
		z-index: 9999;
	}

	/* HEADER */
	.module-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.badge-tag {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.15);
		color: #818cf8;
		margin-bottom: 0.5rem;
	}

	h1 {
		font-size: 1.85rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.25rem;
	}

	.subtitle {
		font-size: 0.92rem;
		color: var(--text-muted);
		max-width: 700px;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.btn-primary {
		background: #6366f1;
		color: #ffffff;
		border: none;
		padding: 0.6rem 1.1rem;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.88rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: #4f46e5;
	}

	.btn-refresh {
		background: var(--surface-card);
		color: var(--text-1);
		border: 1px solid var(--border);
		padding: 0.6rem 1rem;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.88rem;
		cursor: pointer;
	}

	.btn-refresh:hover {
		background: var(--surface-card-hover);
	}

	/* CONTROLS BAR */
	.controls-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
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
		max-width: 480px;
		gap: 0.5rem;
	}

	.search-box input {
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-1);
		width: 100%;
		font-size: 0.9rem;
	}

	.stats-pills {
		display: flex;
		gap: 0.75rem;
	}

	.stat-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		font-size: 0.82rem;
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

	/* GRID DUAL */
	.layout-grid {
		display: grid;
		grid-template-columns: 340px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 960px) {
		.layout-grid {
			grid-template-columns: 1fr;
		}
	}

	/* SIDEBAR */
	.sidebar-tramites {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.sidebar-header h2 {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.badge-count {
		background: #4f46e5;
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 20px;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tramite-card {
		padding: 1rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--surface-card);
		cursor: pointer;
		transition: all 0.2s;
	}

	.tramite-card:hover {
		border-color: #6366f1;
		background: var(--surface-card-hover);
		transform: translateY(-1px);
	}

	.tramite-card.active {
		border-color: #6366f1;
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
		background: rgba(99, 102, 241, 0.05);
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.folder-name {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-1);
	}

	.badge-credit {
		font-size: 0.72rem;
		font-weight: 600;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}

	.property-line {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin-bottom: 0.4rem;
	}

	.parties-line {
		font-size: 0.8rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.card-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid var(--border);
		padding-top: 0.6rem;
	}

	.price-tag {
		font-weight: 700;
		font-size: 0.92rem;
		color: #10b981;
	}

	.status-indicator {
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* MAIN EXPEDIENTE */
	.main-expediente {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.expediente-banner {
		padding: 1.5rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
		background: linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent);
	}

	.path-bread {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-family: monospace;
		margin-bottom: 0.25rem;
	}

	.expediente-banner h2 {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.25rem;
	}

	.summary-text {
		font-size: 0.88rem;
		color: var(--text-muted);
	}

	.download-action {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
	}

	.btn-download-contract {
		display: inline-flex;
		align-items: center;
		background: #10b981;
		color: #ffffff;
		padding: 0.7rem 1.25rem;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.9rem;
		text-decoration: none;
		box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
		transition: transform 0.2s, background 0.2s;
	}

	.btn-download-contract:hover {
		background: #059669;
		transform: translateY(-1px);
	}

	.sub-download {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* TABS */
	.tabs-nav {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 1.5rem 0;
		border-bottom: 1px solid var(--border);
		background: var(--surface-card);
		overflow-x: auto;
	}

	.tab-btn {
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0.75rem 1rem;
		font-weight: 600;
		font-size: 0.88rem;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.tab-btn:hover {
		color: var(--text-1);
	}

	.tab-btn.active {
		color: #6366f1;
		border-bottom-color: #6366f1;
	}

	.badge-alert {
		background: #ef4444;
		color: #ffffff;
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		border-radius: 10px;
	}

	.tab-body {
		padding: 1.5rem;
	}

	/* CARDS Y DETALLES */
	.grid-2-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}

	.grid-3-cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin-top: 0.75rem;
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
		padding: 1.25rem;
	}

	.detail-card.full-width {
		grid-column: 1 / -1;
	}

	.card-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 700;
		font-size: 0.95rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.5rem;
		color: var(--text-1);
	}

	.field-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.35rem 0;
		font-size: 0.85rem;
		gap: 0.5rem;
	}

	.field-row label {
		color: var(--text-muted);
		font-weight: 500;
	}

	.field-row span {
		color: var(--text-1);
		text-align: right;
	}

	.field-col {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.85rem;
	}

	.field-col label {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.field-col span {
		color: var(--text-1);
	}

	.code-span {
		font-family: monospace;
		background: rgba(0, 0, 0, 0.2);
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		font-size: 0.82rem;
	}

	.code-span.highlight {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.1);
	}

	.sub-party {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.sub-party.mt-2 {
		margin-top: 0.75rem;
	}

	.sub-party-title {
		font-weight: 700;
		font-size: 0.88rem;
		color: #818cf8;
		margin-bottom: 0.4rem;
	}

	.badge-status-green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		font-size: 0.72rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-weight: 600;
	}

	.badge-status-blue {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
		font-size: 0.72rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-weight: 600;
	}

	.badge-status-purple {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		font-size: 0.72rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-weight: 600;
	}

	/* EQUIPAMIENTO */
	.equipment-box {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--border);
	}

	.equipment-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.5rem;
	}

	.equipment-tags {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.eq-tag {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.25);
		font-size: 0.78rem;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		font-weight: 500;
	}

	/* FINANCIERO */
	.financial-cards-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.fin-stat-card {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.fin-stat-card .fin-lbl {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.fin-stat-card .fin-val {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.fin-stat-card .fin-sub {
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

	.commission-box {
		background: rgba(0, 0, 0, 0.15);
		border-radius: 8px;
		padding: 1rem;
	}

	.box-head {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-bottom: 0.25rem;
	}

	.box-number {
		font-size: 1.2rem;
		font-weight: 700;
		color: #10b981;
		margin-bottom: 0.4rem;
	}

	.box-desc {
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	/* CHECKLIST SECCIONES */
	.checklist-section {
		background: rgba(0, 0, 0, 0.08);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.checklist-section.mt-4 {
		margin-top: 1.5rem;
	}

	.section-badge-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
		gap: 1rem;
		flex-wrap: wrap;
	}

	.sec-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.sec-icon {
		font-size: 1.6rem;
	}

	.sec-left h3 {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.15rem;
	}

	.sec-left p {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.stat-pill-mini {
		font-size: 0.78rem;
		font-weight: 700;
		padding: 0.25rem 0.65rem;
		border-radius: 20px;
	}

	.stat-pill-mini.green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.btn-wa-req.seller {
		background: #0284c7;
	}

	.checklist-table {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.check-row {
		display: flex;
		align-items: center;
		padding: 0.85rem 1rem;
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		gap: 1rem;
		transition: background 0.2s;
	}

	.check-row.completed {
		opacity: 0.65;
		background: rgba(16, 185, 129, 0.05);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.check-col-box input {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.check-col-main {
		flex: 1;
	}

	.item-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-1);
		margin-bottom: 0.2rem;
	}

	.item-meta {
		font-size: 0.78rem;
		color: var(--text-muted);
		display: flex;
		gap: 0.5rem;
	}

	.status-pill {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
	}

	.status-pill.yellow {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.status-pill.green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.btn-wa-req {
		background: #25d366;
		color: #ffffff;
		border: none;
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.75rem;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.2s;
	}

	.btn-wa-req:hover {
		opacity: 0.9;
	}

	.check-done {
		font-size: 0.8rem;
		font-weight: 600;
		color: #10b981;
	}

	/* BÓVEDA */
	.vault-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.vault-header h3 {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.vault-count {
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.vault-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.doc-card {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.doc-icon {
		font-size: 1.5rem;
	}

	.doc-info {
		flex: 1;
		overflow: hidden;
	}

	.doc-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.doc-type {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.doc-ok {
		color: #10b981;
		font-weight: 600;
	}

	.btn-download-sm {
		font-size: 0.72rem;
		font-weight: 600;
		color: #6366f1;
		text-decoration: none;
		padding: 0.3rem 0.55rem;
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.05);
		white-space: nowrap;
	}

	.btn-download-sm:hover {
		background: rgba(99, 102, 241, 0.15);
	}
</style>
