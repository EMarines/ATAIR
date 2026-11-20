<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import {
		LABELS_ESTADO_CIVIL,
		LABELS_FORMA_PAGO,
		LABELS_GARANTIA_RENTA,
		LABELS_GRAVAMEN,
		LABELS_OPERACION,
		LABELS_ORIGEN_INMUEBLE,
		LABELS_PERSONA,
		LABELS_REGIMEN,
		LABELS_USO_RENTA
	} from '$lib/tramites/motorRequisitos';
	import type {
		AlertaJuridica,
		ConfiguracionTramite,
		TipoOperacion
	} from '$lib/tramites/tramiteTypes';

	export let config: ConfiguracionTramite;
	export let alertas: AlertaJuridica[] = [];
	export let compact = false;

	const dispatch = createEventDispatcher<{ change: { config: ConfiguracionTramite } }>();

	function cloneConfig(c: ConfiguracionTramite): ConfiguracionTramite {
		return {
			...c,
			comprador: { ...c.comprador },
			vendedor: { ...c.vendedor }
		};
	}

	function emitChange(next: ConfiguracionTramite) {
		config = next;
		dispatch('change', { config: next });
	}

	function onOperacionChange(rawOperacion: string) {
		const tipoOperacion = rawOperacion as TipoOperacion;
		const next = cloneConfig(config);
		next.tipoOperacion = tipoOperacion;
		if (tipoOperacion === 'compraventa' && !next.formaPago) {
			next.formaPago = 'bancario';
		}
		if (tipoOperacion === 'arrendamiento') {
			if (!next.garantiaRenta) next.garantiaRenta = 'fiador_propiedad';
			if (!next.usoArrendamiento) next.usoArrendamiento = 'habitacional';
		}
		emitChange(next);
	}

	function updateParte(
		rol: 'comprador' | 'vendedor',
		field: 'tipoPersona' | 'estadoCivil' | 'regimenConyugal',
		value: string
	) {
		const next = cloneConfig(config);
		const target = next[rol];
		if (field === 'tipoPersona') {
			target.tipoPersona = value as 'fisica' | 'moral';
		} else if (field === 'estadoCivil') {
			target.estadoCivil = value as ConfiguracionTramite['comprador']['estadoCivil'];
			if (value === 'casado' && !target.regimenConyugal) {
				target.regimenConyugal = 'sociedad_conyugal';
			}
		} else if (field === 'regimenConyugal') {
			target.regimenConyugal = value as 'sociedad_conyugal' | 'separacion_bienes';
		}
		emitChange(next);
	}

	function updateRootField(field: keyof ConfiguracionTramite, value: unknown) {
		const next = cloneConfig(config);
		(next as unknown as Record<string, unknown>)[field] = value;
		emitChange(next);
	}

	$: partesMeta = [
		{
			rol: 'comprador' as const,
			titulo:
				config.tipoOperacion === 'arrendamiento'
					? '2. Situación del Arrendatario (Inquilino)'
					: '2. Situación de la Parte Compradora',
			badge: 'Adquirente'
		},
		{
			rol: 'vendedor' as const,
			titulo:
				config.tipoOperacion === 'arrendamiento'
					? '3. Situación del Arrendador (Propietario)'
					: '3. Situación de la Parte Vendedora',
			badge: 'Enajenante'
		}
	];
</script>

<div class="config-wrapper" class:compact>
	<!-- PASO 1: OPERACIÓN Y ESQUEMA DE PAGO / GARANTÍA -->
	<div class="cfg-block">
		<div class="cfg-block-title">1. Tipo de Trámite y Esquema Financiero</div>
		<div class="cfg-grid">
			<div class="cfg-field">
				<label for="cfg-operacion-{compact}">Tipo de Operación</label>
				<select
					id="cfg-operacion-{compact}"
					value={config.tipoOperacion}
					on:change={(e) => onOperacionChange(e.currentTarget.value)}
				>
					{#each Object.entries(LABELS_OPERACION) as [val, label]}
						<option value={val}>{label}</option>
					{/each}
				</select>
			</div>

			{#if config.tipoOperacion === 'compraventa'}
				<div class="cfg-field" transition:slide={{ duration: 150 }}>
					<label for="cfg-pago-{compact}">Forma de Pago / Crédito</label>
					<select
						id="cfg-pago-{compact}"
						value={config.formaPago || 'bancario'}
						on:change={(e) => updateRootField('formaPago', e.currentTarget.value)}
					>
						{#each Object.entries(LABELS_FORMA_PAGO) as [val, label]}
							<option value={val}>{label}</option>
						{/each}
					</select>
				</div>
			{:else}
				<div class="cfg-field" transition:slide={{ duration: 150 }}>
					<label for="cfg-uso-{compact}">Uso del Inmueble</label>
					<select
						id="cfg-uso-{compact}"
						value={config.usoArrendamiento || 'habitacional'}
						on:change={(e) => updateRootField('usoArrendamiento', e.currentTarget.value)}
					>
						{#each Object.entries(LABELS_USO_RENTA) as [val, label]}
							<option value={val}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="cfg-field" transition:slide={{ duration: 150 }}>
					<label for="cfg-garantia-{compact}">Garantía de Arrendamiento</label>
					<select
						id="cfg-garantia-{compact}"
						value={config.garantiaRenta || 'fiador_propiedad'}
						on:change={(e) => updateRootField('garantiaRenta', e.currentTarget.value)}
					>
						{#each Object.entries(LABELS_GARANTIA_RENTA) as [val, label]}
							<option value={val}>{label}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>
	</div>

	<!-- PASOS 2 Y 3: SITUACIÓN DE LAS PARTES EN CASCADA -->
	<div class="cfg-parties-grid">
		{#each partesMeta as pm (pm.rol)}
			{@const estadoParte = config[pm.rol]}
			<div class="cfg-block">
				<div class="cfg-block-header">
					<span class="cfg-block-title">{pm.titulo}</span>
					<span class="cfg-mini-tag">{pm.badge}</span>
				</div>

				<div class="cfg-stack">
					<div class="cfg-field">
						<label for="cfg-{pm.rol}-persona-{compact}">Personalidad Jurídica</label>
						<select
							id="cfg-{pm.rol}-persona-{compact}"
							value={estadoParte.tipoPersona}
							on:change={(e) => updateParte(pm.rol, 'tipoPersona', e.currentTarget.value)}
						>
							{#each Object.entries(LABELS_PERSONA) as [val, label]}
								<option value={val}>{label}</option>
							{/each}
						</select>
					</div>

					{#if estadoParte.tipoPersona === 'fisica'}
						<div class="cfg-field" transition:slide={{ duration: 150 }}>
							<label for="cfg-{pm.rol}-civil-{compact}">Estado Civil</label>
							<select
								id="cfg-{pm.rol}-civil-{compact}"
								value={estadoParte.estadoCivil}
								on:change={(e) => updateParte(pm.rol, 'estadoCivil', e.currentTarget.value)}
							>
								{#each Object.entries(LABELS_ESTADO_CIVIL) as [val, label]}
									<option value={val}>{label}</option>
								{/each}
							</select>
						</div>

						{#if estadoParte.estadoCivil === 'casado'}
							<div class="cfg-field cascade-highlight" transition:slide={{ duration: 160 }}>
								<label for="cfg-{pm.rol}-regimen-{compact}">
									↳ Régimen Patrimonial del Matrimonio
								</label>
								<select
									id="cfg-{pm.rol}-regimen-{compact}"
									value={estadoParte.regimenConyugal || 'sociedad_conyugal'}
									on:change={(e) => updateParte(pm.rol, 'regimenConyugal', e.currentTarget.value)}
								>
									{#each Object.entries(LABELS_REGIMEN) as [val, label]}
										<option value={val}>{label}</option>
									{/each}
								</select>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- PASO 4: VARIABLES DEL INMUEBLE Y BLINDAJE -->
	<div class="cfg-block">
		<div class="cfg-block-title">4. Variables Jurídicas del Inmueble y Cláusulas</div>

		{#if config.tipoOperacion === 'compraventa'}
			<div class="cfg-grid" transition:slide={{ duration: 150 }}>
				<div class="cfg-field">
					<label for="cfg-origen-{compact}">Origen / Título de Adquisición</label>
					<select
						id="cfg-origen-{compact}"
						value={config.origenInmueble}
						on:change={(e) => updateRootField('origenInmueble', e.currentTarget.value)}
					>
						{#each Object.entries(LABELS_ORIGEN_INMUEBLE) as [val, label]}
							<option value={val}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="cfg-field">
					<label for="cfg-gravamen-{compact}">Situación de Gravamen</label>
					<select
						id="cfg-gravamen-{compact}"
						value={config.situacionGravamen}
						on:change={(e) => updateRootField('situacionGravamen', e.currentTarget.value)}
					>
						{#each Object.entries(LABELS_GRAVAMEN) as [val, label]}
							<option value={val}>{label}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		<div class="cfg-toggles">
			{#if config.tipoOperacion === 'compraventa'}
				{#if config.vendedor.tipoPersona === 'fisica'}
					<label class="cfg-toggle-pill">
						<input
							type="checkbox"
							checked={config.exentarIsrCasaHab}
							on:change={(e) => updateRootField('exentarIsrCasaHab', e.currentTarget.checked)}
						/>
						<span>Exención de ISR Casa Habitación (Art. 93 LISR)</span>
					</label>
				{/if}

				<label class="cfg-toggle-pill">
					<input
						type="checkbox"
						checked={config.discrepanciaDomicilio}
						on:change={(e) =>
							updateRootField('discrepanciaDomicilio', e.currentTarget.checked)}
					/>
					<span>Diferencia de número oficial (Requiere Alineamiento)</span>
				</label>
			{/if}

			<label class="cfg-toggle-pill">
				<input
					type="checkbox"
					checked={config.clausulasMasc}
					on:change={(e) => updateRootField('clausulasMasc', e.currentTarget.checked)}
				/>
				<span>Incluir Cláusulas MASC / Justicia Alternativa (Sala PACTUM)</span>
			</label>
		</div>
	</div>

	<!-- ALERTAS JURÍDICAS DINÁMICAS -->
	{#if alertas.length > 0 && !compact}
		<div class="alerts-grid" transition:slide={{ duration: 150 }}>
			{#each alertas as al (al.id)}
				<div class="legal-alert {al.nivel}">
					<div class="alert-head">
						<span>
							{#if al.nivel === 'critica'}🚨{:else if al.nivel === 'advertencia'}⚠️{:else}💡{/if}
							{al.titulo}
						</span>
					</div>
					<p>{al.detalle}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.config-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.cfg-block {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1rem 1.1rem;
	}

	.compact .cfg-block {
		padding: 0.85rem;
	}

	.cfg-block-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.cfg-block-title {
		font-size: 0.86rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.75rem;
		display: block;
	}

	.cfg-block-header .cfg-block-title {
		margin-bottom: 0;
	}

	.cfg-mini-tag {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.14);
		color: #818cf8;
	}

	.cfg-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.85rem;
	}

	.cfg-parties-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.cfg-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cfg-field {
		display: flex;
		flex-direction: column;
		gap: 0.32rem;
	}

	.cfg-field label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.cfg-field select {
		width: 100%;
		padding: 0.52rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--input-border, var(--border));
		background: var(--input-bg, var(--surface-1));
		color: var(--input-text, var(--text-1));
		font-size: 0.85rem;
		font-weight: 500;
		outline: none;
		cursor: pointer;
	}

	.cfg-field select:focus {
		border-color: #6366f1;
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
	}

	.cascade-highlight {
		padding: 0.6rem 0.75rem;
		border-left: 3px solid #6366f1;
		background: rgba(99, 102, 241, 0.06);
		border-radius: 6px;
	}

	.cascade-highlight label {
		color: #818cf8;
	}

	.cfg-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 0.85rem;
	}

	.cfg-toggle-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.8rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface-1);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-1);
		cursor: pointer;
		user-select: none;
	}

	.cfg-toggle-pill:hover {
		border-color: #6366f1;
	}

	.cfg-toggle-pill input[type='checkbox'] {
		accent-color: #6366f1;
		width: 15px;
		height: 15px;
		cursor: pointer;
	}

	.alerts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
		gap: 0.75rem;
	}

	.legal-alert {
		border-radius: 10px;
		padding: 0.85rem 1rem;
		border: 1px solid;
	}

	.legal-alert.critica {
		background: rgba(239, 68, 68, 0.08);
		border-color: rgba(239, 68, 68, 0.35);
	}

	.legal-alert.advertencia {
		background: rgba(245, 158, 11, 0.09);
		border-color: rgba(245, 158, 11, 0.35);
	}

	.legal-alert.info {
		background: rgba(56, 189, 248, 0.08);
		border-color: rgba(56, 189, 248, 0.35);
	}

	.alert-head {
		font-size: 0.84rem;
		font-weight: 700;
		color: var(--text-1);
		margin-bottom: 0.3rem;
	}

	.legal-alert p {
		font-size: 0.79rem;
		line-height: 1.45;
		color: var(--text-muted);
		margin: 0;
	}
</style>
