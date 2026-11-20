<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import type {
		EstadoControlSistema,
		ParteTrato,
		RequisitoEvaluado,
		ResultadoEvaluacionMotor,
		TramiteExpediente
	} from '$lib/tramites/tramiteTypes';

	export let expediente: TramiteExpediente;
	export let evaluacion: ResultadoEvaluacionMotor;
	export let currentUserName = 'Enrique Marines (Admin)';

	type FiltroParte = 'todos' | 'pendientes' | ParteTrato;
	let filtroActivo: FiltroParte = 'todos';

	// Buffer local por campoClave para permitir edición fluida antes de guardar
	let draftDatos: Record<string, string> = {};
	let savingFieldKey: string | null = null;

	const dispatch = createEventDispatcher<{
		toggleDoc: { reqId: string; nuevoEstado: EstadoControlSistema; validadoPor: string };
		saveDato: { campoClave: string; valor: string };
	}>();

	$: {
		// Sincronizar valores del motor cuando cambia el expediente seleccionado
		const nextDraft: Record<string, string> = {};
		for (const r of evaluacion.requisitos) {
			if (r.tipo === 'dato' && r.campoClave) {
				nextDraft[r.campoClave] =
					draftDatos[r.campoClave] !== undefined && savingFieldKey === r.campoClave
						? draftDatos[r.campoClave]
						: r.valorActual || '';
			}
		}
		draftDatos = nextDraft;
	}

	function cleanPhoneForWa(raw?: string): string {
		if (!raw) return '';
		const digits = raw.replace(/\D/g, '');
		if (digits.length === 10) return `52${digits}`;
		if (digits.length >= 12) return digits;
		return '';
	}

	function buildWaUrl(phoneRaw: string | undefined, message: string): string {
		const digits = cleanPhoneForWa(phoneRaw);
		const encoded = encodeURIComponent(message);
		return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
	}

	function getParteInfo(parte: ParteTrato) {
		const esRenta = evaluacion.config.tipoOperacion === 'arrendamiento';
		if (parte === 'comprador') {
			return {
				icon: '🛒',
				titulo: esRenta ? 'Parte Arrendataria (Inquilino)' : 'Parte Compradora',
				nombre: expediente.partes.compradorTitular?.nombre || 'Comprador / Arrendatario',
				telefono: expediente.partes.compradorTitular?.telefono
			};
		}
		if (parte === 'vendedor') {
			return {
				icon: '🏷️',
				titulo: esRenta ? 'Parte Arrendadora (Propietario)' : 'Parte Vendedora (Propietario)',
				nombre: expediente.partes.vendedora?.nombre || 'Propietario',
				telefono: expediente.partes.vendedora?.telefono
			};
		}
		return {
			icon: '🏠',
			titulo: 'Inmueble y Operación',
			nombre: expediente.partes.vendedora?.nombre || 'Expediente',
			telefono: expediente.partes.vendedora?.telefono
		};
	}

	function pedirUnoPorWa(req: RequisitoEvaluado) {
		const info = getParteInfo(req.parte);
		const saludo = info.nombre.split(' ')[0] || 'hola';
		const msg = `Hola ${saludo}, gusto en saludarte de Match Home Bienes Raíces. Para avanzar con tu trámite de ${expediente.folderName} (${expediente.modalidadCredito}), necesitamos de tu apoyo con el siguiente requisito para ${req.obligatorioPara}: *${req.concepto}*. ¡Quedamos atentos!`;
		window.open(buildWaUrl(info.telefono, msg), '_blank');
	}

	function pedirFaltantesPartePorWa(parte: ParteTrato, items: RequisitoEvaluado[]) {
		const pendientes = items.filter((i) => !i.completado);
		if (pendientes.length === 0) return;
		const info = getParteInfo(parte);
		const saludo = info.nombre.split(' ')[0] || 'hola';
		const bullets = pendientes.map((p, idx) => `${idx + 1}. ${p.concepto}`).join('\n');
		const msg = `Hola ${saludo}, gusto en saludarte de Match Home Bienes Raíces. Te comparto la lista de requisitos pendientes para tu expediente *${expediente.folderName}* (${expediente.modalidadCredito}):\n\n${bullets}\n\nCualquier duda estoy a tus órdenes.`;
		window.open(buildWaUrl(info.telefono, msg), '_blank');
	}

	function onDocCheckboxToggle(req: RequisitoEvaluado) {
		const siguiente: EstadoControlSistema = req.completado ? 'pendiente' : 'cotejado_admin';
		dispatch('toggleDoc', {
			reqId: req.id,
			nuevoEstado: siguiente,
			validadoPor: currentUserName
		});
	}

	function onDocEstadoSelect(req: RequisitoEvaluado, nuevoEstado: string) {
		dispatch('toggleDoc', {
			reqId: req.id,
			nuevoEstado: nuevoEstado as EstadoControlSistema,
			validadoPor: currentUserName
		});
	}

	function commitDato(req: RequisitoEvaluado) {
		if (!req.campoClave) return;
		const val = draftDatos[req.campoClave] ?? '';
		if (val.trim() === (req.valorActual || '').trim()) return;
		savingFieldKey = req.campoClave;
		dispatch('saveDato', {
			campoClave: req.campoClave,
			valor: val
		});
		setTimeout(() => {
			if (savingFieldKey === req.campoClave) savingFieldKey = null;
		}, 400);
	}

	$: requisitosFiltrados = evaluacion.requisitos.filter((r) => {
		if (filtroActivo === 'pendientes') return !r.completado;
		if (filtroActivo === 'comprador' || filtroActivo === 'vendedor' || filtroActivo === 'inmueble') {
			return r.parte === filtroActivo;
		}
		return true;
	});

	const ORDEN_PARTES: ParteTrato[] = ['comprador', 'vendedor', 'inmueble'];

	$: seccionesActivas = ORDEN_PARTES.map((parte) => {
		const todosParte = requisitosFiltrados.filter((r) => r.parte === parte);
		return {
			parte,
			info: getParteInfo(parte),
			datos: todosParte.filter((r) => r.tipo === 'dato'),
			documentos: todosParte.filter((r) => r.tipo === 'documento'),
			total: todosParte.length,
			completados: todosParte.filter((r) => r.completado).length
		};
	}).filter((sec) => sec.total > 0);
</script>

<div class="checklist-root" transition:fade={{ duration: 150 }}>
	<!-- BARRA DE PROGRESO Y CONTROL DEL SISTEMA -->
	<div class="progress-summary-card">
		<div class="summary-top">
			<div class="summary-titles">
				<h3>Checklist Paramétrico Controlado por Sistema</h3>
				<p>
					Los <strong>Datos</strong> se auto-validan al detectar formato válido; los <strong>Documentos</strong> se controlan por estado registral/operativo.
				</p>
			</div>
			<div class="summary-metrics">
				<span class="metric-chip">
					📄 Documentos: <strong>{evaluacion.resumen.docsCompletados}/{evaluacion.resumen.totalDocs}</strong>
				</span>
				<span class="metric-chip">
					⌨️ Datos: <strong>{evaluacion.resumen.datosCompletados}/{evaluacion.resumen.totalDatos}</strong>
				</span>
				<span class="metric-chip highlight">
					Avance: <strong>{evaluacion.resumen.porcentaje}%</strong>
				</span>
			</div>
		</div>

		<div class="progress-track">
			<div class="progress-fill" style="width: {evaluacion.resumen.porcentaje}%"></div>
		</div>

		<!-- PILLS DE FILTRADO -->
		<div class="filter-pills">
			<button
				class="f-pill"
				class:active={filtroActivo === 'todos'}
				on:click={() => (filtroActivo = 'todos')}
			>
				Todos ({evaluacion.resumen.total})
			</button>
			<button
				class="f-pill"
				class:active={filtroActivo === 'pendientes'}
				on:click={() => (filtroActivo = 'pendientes')}
			>
				⚠️ Solo Faltantes ({evaluacion.resumen.total - evaluacion.resumen.completados})
			</button>
			<button
				class="f-pill"
				class:active={filtroActivo === 'comprador'}
				on:click={() => (filtroActivo = 'comprador')}
			>
				🛒 Adquirente ({evaluacion.resumen.pendientesPorParte.comprador} falt.)
			</button>
			<button
				class="f-pill"
				class:active={filtroActivo === 'vendedor'}
				on:click={() => (filtroActivo = 'vendedor')}
			>
				🏷️ Propietario ({evaluacion.resumen.pendientesPorParte.vendedor} falt.)
			</button>
			<button
				class="f-pill"
				class:active={filtroActivo === 'inmueble'}
				on:click={() => (filtroActivo = 'inmueble')}
			>
				🏠 Inmueble ({evaluacion.resumen.pendientesPorParte.inmueble} falt.)
			</button>
		</div>
	</div>

	<!-- LISTADO POR PARTE -->
	{#each seccionesActivas as sec (sec.parte)}
		{@const todosItemsSec = [...sec.datos, ...sec.documentos]}
		{@const hayPendientes = todosItemsSec.some((i) => !i.completado)}
		<section class="party-section">
			<div class="party-header {sec.parte}">
				<div class="party-header-left">
					<span class="party-icon">{sec.info.icon}</span>
					<div>
						<h4>{sec.info.titulo}</h4>
						<span class="party-sub">{sec.info.nombre}</span>
					</div>
				</div>

				<div class="party-header-actions">
					<span class="sec-counter">
						{sec.completados} / {sec.total} listos
					</span>
					{#if hayPendientes}
						<button
							class="btn-wa-bulk"
							on:click={() => pedirFaltantesPartePorWa(sec.parte, todosItemsSec)}
						>
							📲 Pedir todos los faltantes ({todosItemsSec.filter((i) => !i.completado).length})
						</button>
					{/if}
				</div>
			</div>

			<!-- BLOQUE A: DATOS REQUERIDOS (CHECKBOX AUTO-CONTROLADO POR VALIDACIÓN) -->
			{#if sec.datos.length > 0}
				<div class="sub-block">
					<div class="sub-block-label">
						<span>⌨️ Datos Requeridos para Contrato / Notaría</span>
						<span class="system-lock-hint">🤖 Checkbox bloqueado: se marca automático al capturar dato válido</span>
					</div>

					<div class="req-rows">
						{#each sec.datos as req (req.id)}
							<div class="req-row dato-row" class:done={req.completado}>
								<div class="req-check" title="Controlado automáticamente por validación del sistema">
									<input type="checkbox" checked={req.completado} disabled />
								</div>

								<div class="req-info">
									<div class="req-title-line">
										<span class="req-title">{req.concepto}</span>
										<span class="rule-badge">{req.motivoRegla}</span>
									</div>
									<div class="req-meta">
										Para: <strong>{req.obligatorioPara}</strong>
										{#if req.ayudaFormato && !req.completado}
											<span class="format-hint">• {req.ayudaFormato}</span>
										{/if}
									</div>
								</div>

								<div class="req-dato-input-wrap">
									{#if req.campoClave}
										<input
											type="text"
											class="dato-inline-input"
											class:valid={req.completado}
											bind:value={draftDatos[req.campoClave]}
											placeholder={req.placeholder || 'Capturar dato...'}
											on:blur={() => commitDato(req)}
											on:keydown={(e) => {
												if (e.key === 'Enter') {
													e.currentTarget.blur();
												}
											}}
										/>
										<button
											class="btn-save-dato"
											on:click={() => commitDato(req)}
											title="Guardar y validar dato"
										>
											💾
										</button>
									{/if}
								</div>

								<div class="req-status">
									<span
										class="status-pill"
										class:green={req.completado}
										class:yellow={!req.completado}
									>
										{req.estatusEtiqueta}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- BLOQUE B: DOCUMENTOS REQUERIDOS -->
			{#if sec.documentos.length > 0}
				<div class="sub-block">
					<div class="sub-block-label">
						<span>📄 Documentos Requeridos del Expediente</span>
						<span class="system-lock-hint">🔒 Estado controlado por sistema y cotejo administrativo</span>
					</div>

					<div class="req-rows">
						{#each sec.documentos as req (req.id)}
							<div
								class="req-row"
								class:done={req.completado}
								class:warn={req.estadoSistema === 'observacion'}
							>
								<div class="req-check">
									<input
										type="checkbox"
										checked={req.completado}
										on:change={() => onDocCheckboxToggle(req)}
										title="Alternar validación administrativa del documento"
									/>
								</div>

								<div class="req-info">
									<div class="req-title-line">
										<span class="req-title">{req.concepto}</span>
										<span class="rule-badge">{req.motivoRegla}</span>
									</div>
									<div class="req-meta">
										Obligatorio para: <strong>{req.obligatorioPara}</strong>
										{#if req.validadoPor && req.completado}
											<span class="audit-stamp">
												• {req.validadoPor} ({req.actualizadoEn || ''})
											</span>
										{/if}
									</div>
								</div>

								<div class="req-controls">
									<select
										class="estado-select {req.estadoSistema}"
										value={req.estadoSistema}
										on:change={(e) => onDocEstadoSelect(req, e.currentTarget.value)}
									>
										<option value="pendiente">⏳ Pendiente</option>
										<option value="en_revision">🔎 En Revisión</option>
										<option value="cotejado_admin">✅ Cotejado (Admin)</option>
										<option value="validado_sistema">🤖 Validado Sistema</option>
										<option value="observacion">⚠️ Con Observación</option>
									</select>

									{#if !req.completado}
										<button class="btn-wa-single" on:click={() => pedirUnoPorWa(req)}>
											📲 Pedir por WA
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{:else}
		<div class="all-clear-card">
			<span>🎉</span>
			<div>
				<strong>No hay requisitos pendientes bajo este filtro.</strong>
				<p>Todos los documentos y datos mostrados ya fueron validados por el sistema.</p>
			</div>
		</div>
	{/each}
</div>

<style>
	.checklist-root {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.progress-summary-card {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1rem 1.2rem;
	}

	.summary-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.summary-titles h3 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-1);
		margin: 0 0 0.2rem;
	}

	.summary-titles p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.summary-metrics {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.metric-chip {
		font-size: 0.78rem;
		padding: 0.3rem 0.65rem;
		border-radius: 8px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		color: var(--text-1);
	}

	.metric-chip.highlight {
		border-color: rgba(16, 185, 129, 0.45);
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
	}

	.progress-track {
		width: 100%;
		height: 8px;
		border-radius: 999px;
		background: var(--border);
		overflow: hidden;
		margin-bottom: 0.9rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #6366f1, #10b981);
		transition: width 0.3s ease;
	}

	.filter-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.f-pill {
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface-1);
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.f-pill:hover {
		border-color: #6366f1;
		color: var(--text-1);
	}

	.f-pill.active {
		background: #6366f1;
		border-color: #6366f1;
		color: #ffffff;
	}

	/* SECCIÓN POR PARTE */
	.party-section {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.party-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.9rem 1.15rem;
		gap: 1rem;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--border);
	}

	.party-header.comprador {
		background: rgba(56, 189, 248, 0.08);
	}

	.party-header.vendedor {
		background: rgba(168, 85, 247, 0.08);
	}

	.party-header.inmueble {
		background: rgba(16, 185, 129, 0.08);
	}

	.party-header-left {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.party-icon {
		font-size: 1.35rem;
	}

	.party-header-left h4 {
		font-size: 0.96rem;
		font-weight: 700;
		color: var(--text-1);
		margin: 0;
	}

	.party-sub {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.party-header-actions {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.sec-counter {
		font-size: 0.78rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		background: var(--surface-card);
		border: 1px solid var(--border);
		color: var(--text-1);
	}

	.btn-wa-bulk {
		background: #16a34a;
		color: #ffffff;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-wa-bulk:hover {
		background: #15803d;
	}

	/* SUB-BLOQUES */
	.sub-block {
		padding: 0.85rem 1.15rem;
	}

	.sub-block + .sub-block {
		border-top: 1px dashed var(--border);
	}

	.sub-block-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.65rem;
	}

	.system-lock-hint {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.req-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.req-row {
		display: grid;
		grid-template-columns: 28px 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.85rem;
		border-radius: 9px;
		border: 1px solid var(--border);
		background: var(--surface-card);
	}

	.req-row.dato-row {
		grid-template-columns: 28px minmax(220px, 1.3fr) minmax(200px, 1fr) auto;
	}

	.req-row.done {
		border-color: rgba(16, 185, 129, 0.35);
		background: rgba(16, 185, 129, 0.05);
	}

	.req-row.warn {
		border-color: rgba(239, 68, 68, 0.45);
		background: rgba(239, 68, 68, 0.06);
	}

	@media (max-width: 820px) {
		.req-row,
		.req-row.dato-row {
			grid-template-columns: 24px 1fr;
		}
		.req-dato-input-wrap,
		.req-status,
		.req-controls {
			grid-column: 2;
		}
	}

	.req-check input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: #10b981;
		cursor: pointer;
	}

	.req-check input[type='checkbox']:disabled {
		cursor: not-allowed;
		opacity: 0.85;
	}

	.req-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.req-title-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.req-title {
		font-size: 0.87rem;
		font-weight: 600;
		color: var(--text-1);
	}

	.req-row.done .req-title {
		color: var(--text-1);
	}

	.rule-badge {
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.12rem 0.45rem;
		border-radius: 5px;
		background: rgba(99, 102, 241, 0.14);
		color: #818cf8;
	}

	.req-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.format-hint {
		color: #d97706;
		font-weight: 500;
	}

	.audit-stamp {
		color: #10b981;
	}

	/* INLINE INPUT DE DATOS */
	.req-dato-input-wrap {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.dato-inline-input {
		width: 100%;
		padding: 0.42rem 0.65rem;
		border-radius: 7px;
		border: 1px solid var(--input-border, var(--border));
		background: var(--input-bg, var(--surface-1));
		color: var(--input-text, var(--text-1));
		font-size: 0.8rem;
		outline: none;
	}

	.dato-inline-input:focus {
		border-color: #6366f1;
	}

	.dato-inline-input.valid {
		border-color: rgba(16, 185, 129, 0.55);
	}

	.btn-save-dato {
		padding: 0.4rem 0.55rem;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--surface-1);
		cursor: pointer;
		font-size: 0.82rem;
	}

	.btn-save-dato:hover {
		border-color: #6366f1;
	}

	/* CONTROLES Y ESTATUS */
	.req-controls {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.estado-select {
		padding: 0.35rem 0.55rem;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--surface-1);
		color: var(--text-1);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}

	.estado-select.validado_sistema,
	.estado-select.cotejado_admin {
		border-color: rgba(16, 185, 129, 0.5);
		color: #10b981;
	}

	.estado-select.observacion {
		border-color: rgba(239, 68, 68, 0.5);
		color: #ef4444;
	}

	.btn-wa-single {
		padding: 0.36rem 0.68rem;
		border-radius: 7px;
		border: 1px solid rgba(22, 163, 74, 0.4);
		background: rgba(22, 163, 74, 0.14);
		color: #22c55e;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-wa-single:hover {
		background: #16a34a;
		color: #ffffff;
	}

	.status-pill {
		font-size: 0.73rem;
		font-weight: 700;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.status-pill.green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.status-pill.yellow {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.all-clear-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1.5rem;
		border-radius: 12px;
		border: 1px solid rgba(16, 185, 129, 0.4);
		background: rgba(16, 185, 129, 0.08);
		color: var(--text-1);
	}

	.all-clear-card span {
		font-size: 1.8rem;
	}

	.all-clear-card p {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin: 0.2rem 0 0;
	}
</style>
