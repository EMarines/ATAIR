<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import { contactsStore, propertiesStore } from '$lib/stores/dataStore';
	import {
		CONFIG_DEFAULT_VENTA,
		evaluarRequisitosTramite
	} from '$lib/tramites/motorRequisitos';
	import type { ConfiguracionTramite } from '$lib/tramites/tramiteTypes';
	import type { CrearTramitePayload } from '$lib/tramites/tramiteService';
	import ConfiguradorParametrico from './ConfiguradorParametrico.svelte';

	export let open = false;
	export let saving = false;

	const dispatch = createEventDispatcher<{
		close: void;
		submit: CrearTramitePayload;
	}>();

	let config: ConfiguracionTramite = {
		...CONFIG_DEFAULT_VENTA,
		comprador: { ...CONFIG_DEFAULT_VENTA.comprador },
		vendedor: { ...CONFIG_DEFAULT_VENTA.vendedor }
	};

	let folderName = '';
	let folderManuallyEdited = false;

	let buyerSearch = '';
	let selectedBuyerId = '';
	let compradorNombre = '';
	let compradorTelefono = '';

	let sellerSearch = '';
	let selectedSellerId = '';
	let vendedorNombre = '';
	let vendedorTelefono = '';

	let propSearch = '';
	let selectedPropertyId = '';
	let calle = '';
	let numeroOficial = '';
	let colonia = '';
	let ciudad = 'Chihuahua';
	let precioORenta = 0;

	$: buyerMatches = ($contactsStore || [])
		.filter((c) => {
			if (!buyerSearch.trim()) return true;
			const full = `${c.name} ${c.lastname} ${c.telephon}`.toLowerCase();
			return full.includes(buyerSearch.toLowerCase());
		})
		.slice(0, 30);

	$: sellerMatches = ($contactsStore || [])
		.filter((c) => {
			if (!sellerSearch.trim()) return true;
			const full = `${c.name} ${c.lastname} ${c.telephon}`.toLowerCase();
			return full.includes(sellerSearch.toLowerCase());
		})
		.slice(0, 30);

	function extractLocationName(loc: unknown): string {
		if (typeof loc === 'string') return loc;
		if (loc && typeof loc === 'object' && 'name' in loc) {
			return String((loc as { name?: unknown }).name || '');
		}
		return '';
	}

	$: propMatches = ($propertiesStore || [])
		.filter((p) => {
			if (!propSearch.trim()) return true;
			const locName = extractLocationName(p.location);
			const txt = `${p.title || ''} ${locName} ${p.neighborhood || ''}`.toLowerCase();
			return txt.includes(propSearch.toLowerCase());
		})
		.slice(0, 30);

	function autoSuggestFolder() {
		if (folderManuallyEdited) return;
		const compPart = compradorNombre.trim().split(/\s+/).slice(-1)[0] || '';
		const vendPart = vendedorNombre.trim().split(/\s+/).slice(-1)[0] || '';
		if (compPart && vendPart) {
			folderName = `${compPart} - ${vendPart}`;
		} else if (compPart || vendPart) {
			folderName = compPart || vendPart;
		}
	}

	function onSelectBuyerContact(id: string) {
		selectedBuyerId = id;
		const c = ($contactsStore || []).find((x) => x.id === id);
		if (!c) return;
		compradorNombre = `${c.name || ''} ${c.lastname || ''}`.trim();
		compradorTelefono = c.telephon || '';
		autoSuggestFolder();
	}

	function onSelectSellerContact(id: string) {
		selectedSellerId = id;
		const c = ($contactsStore || []).find((x) => x.id === id);
		if (!c) return;
		vendedorNombre = `${c.name || ''} ${c.lastname || ''}`.trim();
		vendedorTelefono = c.telephon || '';
		autoSuggestFolder();
	}

	function onSelectProperty(id: string) {
		selectedPropertyId = id;
		const p = ($propertiesStore || []).find((x) => (x.docId || x.id || x.public_id) === id);
		if (!p) return;
		calle = extractLocationName(p.location) || p.title || '';
		colonia = p.neighborhood || '';
		if (typeof p.price === 'number' && p.price > 0) {
			precioORenta = p.price;
		}
	}

	function handleSubmit() {
		if (!compradorNombre.trim() || !vendedorNombre.trim()) {
			return;
		}
		dispatch('submit', {
			folderName: folderName.trim() || `${compradorNombre.split(' ')[0]} - ${vendedorNombre.split(' ')[0]}`,
			configuracion: config,
			compradorNombre,
			compradorTelefono,
			compradorContactId: selectedBuyerId || undefined,
			vendedorNombre,
			vendedorTelefono,
			vendedorContactId: selectedSellerId || undefined,
			propertyId: selectedPropertyId || undefined,
			calle,
			numeroOficial,
			colonia,
			ciudad,
			precioORenta: Number(precioORenta) || 0
		});
	}

	$: previewEval = evaluarRequisitosTramite(config);
</script>

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-backdrop" transition:fade={{ duration: 150 }} on:click={() => dispatch('close')}>
		<div class="modal-card" on:click|stopPropagation>
			<div class="modal-header">
				<div>
					<span class="modal-tag">Expediente Paramétrico Firestore</span>
					<h2>➕ Nuevo Trámite / Contrato Inmobiliario</h2>
				</div>
				<button class="btn-close" on:click={() => dispatch('close')}>✕</button>
			</div>

			<div class="modal-body">
				<!-- VISTA PREVIA EN VIVO DEL MOTOR -->
				<div class="live-motor-bar">
					<span>⚡ Motor de Reglas Activo:</span>
					<strong>{previewEval.resumen.totalDocs} documentos</strong>
					<span>•</span>
					<strong>{previewEval.resumen.totalDatos} datos obligatorios</strong>
					{#if previewEval.alertas.length > 0}
						<span>•</span>
						<strong class="alert-text">{previewEval.alertas.length} alertas legales detectadas</strong>
					{/if}
				</div>

				<!-- CONFIGURADOR PARAMÉTRICO -->
				<ConfiguradorParametrico
					{config}
					alertas={previewEval.alertas}
					compact={true}
					on:change={(e) => (config = e.detail.config)}
				/>

				<!-- IDENTIFICACIÓN DE LAS PARTES E INMUEBLE -->
				<div class="modal-section">
					<h3>Datos Base del Expediente (Vincular CRM o Capturar)</h3>

					<div class="form-row">
						<div class="form-field full">
							<label for="nuevo-folder">Nombre de Carpeta / Expediente</label>
							<input
								id="nuevo-folder"
								type="text"
								bind:value={folderName}
								on:input={() => (folderManuallyEdited = true)}
								placeholder="Ej. Pérez - García (se sugiere automático con apellidos)"
							/>
						</div>
					</div>

					<div class="dual-parties">
						<!-- COMPRADOR / ARRENDATARIO -->
						<div class="party-box">
							<div class="party-box-title">
								🛒 {config.tipoOperacion === 'arrendamiento' ? 'Arrendatario (Inquilino)' : 'Comprador'}
							</div>
							{#if ($contactsStore || []).length > 0}
								<div class="crm-picker">
									<input
										type="text"
										placeholder="Filtrar contacto en ATAIR..."
										bind:value={buyerSearch}
									/>
									<select
										value={selectedBuyerId}
										on:change={(e) => onSelectBuyerContact(e.currentTarget.value)}
									>
										<option value="">-- Vincular contacto del CRM (opcional) --</option>
										{#each buyerMatches as c}
											<option value={c.id}>{c.name} {c.lastname} ({c.telephon || 'sin tel'})</option>
										{/each}
									</select>
								</div>
							{/if}
							<div class="form-field">
								<label for="comp-nom">Nombre completo *</label>
								<input
									id="comp-nom"
									type="text"
									bind:value={compradorNombre}
									on:input={autoSuggestFolder}
									placeholder="Nombre(s) y Apellidos"
								/>
							</div>
							<div class="form-field">
								<label for="comp-tel">Teléfono / WhatsApp</label>
								<input
									id="comp-tel"
									type="text"
									bind:value={compradorTelefono}
									placeholder="Ej. 614 123 4567"
								/>
							</div>
						</div>

						<!-- VENDEDOR / ARRENDADOR -->
						<div class="party-box">
							<div class="party-box-title">
								🏷️ {config.tipoOperacion === 'arrendamiento' ? 'Arrendador (Propietario)' : 'Vendedor (Propietario)'}
							</div>
							{#if ($contactsStore || []).length > 0}
								<div class="crm-picker">
									<input
										type="text"
										placeholder="Filtrar contacto en ATAIR..."
										bind:value={sellerSearch}
									/>
									<select
										value={selectedSellerId}
										on:change={(e) => onSelectSellerContact(e.currentTarget.value)}
									>
										<option value="">-- Vincular contacto del CRM (opcional) --</option>
										{#each sellerMatches as c}
											<option value={c.id}>{c.name} {c.lastname} ({c.telephon || 'sin tel'})</option>
										{/each}
									</select>
								</div>
							{/if}
							<div class="form-field">
								<label for="vend-nom">Nombre completo *</label>
								<input
									id="vend-nom"
									type="text"
									bind:value={vendedorNombre}
									on:input={autoSuggestFolder}
									placeholder="Nombre(s) y Apellidos"
								/>
							</div>
							<div class="form-field">
								<label for="vend-tel">Teléfono / WhatsApp</label>
								<input
									id="vend-tel"
									type="text"
									bind:value={vendedorTelefono}
									placeholder="Ej. 614 987 6543"
								/>
							</div>
						</div>
					</div>

					<!-- INMUEBLE Y MONTO -->
					<div class="property-box">
						<div class="party-box-title">🏠 Inmueble Objeto de la Operación</div>
						{#if ($propertiesStore || []).length > 0}
							<div class="crm-picker horizontal">
								<input
									type="text"
									placeholder="Filtrar propiedad del catálogo..."
									bind:value={propSearch}
								/>
								<select
									value={selectedPropertyId}
									on:change={(e) => onSelectProperty(e.currentTarget.value)}
								>
									<option value="">-- Vincular propiedad existente (opcional) --</option>
									{#each propMatches as p}
										{@const pid = p.docId || p.id || p.public_id}
										<option value={pid}>
											{p.title || extractLocationName(p.location)} — ${(p.price || 0).toLocaleString('es-MX')}
										</option>
									{/each}
								</select>
							</div>
						{/if}

						<div class="form-grid-4">
							<div class="form-field span-2">
								<label for="inm-calle">Calle / Dirección</label>
								<input id="inm-calle" type="text" bind:value={calle} placeholder="Ej. Calle Cedro" />
							</div>
							<div class="form-field">
								<label for="inm-num">No. Exterior</label>
								<input id="inm-num" type="text" bind:value={numeroOficial} placeholder="Ej. 1514-1" />
							</div>
							<div class="form-field">
								<label for="inm-col">Colonia</label>
								<input id="inm-col" type="text" bind:value={colonia} placeholder="Ej. Las Granjas" />
							</div>
							<div class="form-field span-2">
								<label for="inm-precio">
									{config.tipoOperacion === 'arrendamiento'
										? 'Renta Mensual Pactada ($ MXN)'
										: 'Precio Pactado ($ MXN)'}
								</label>
								<input
									id="inm-precio"
									type="number"
									bind:value={precioORenta}
									placeholder="Ej. 2150000"
								/>
							</div>
							<div class="form-field span-2">
								<label for="inm-ciu">Ciudad</label>
								<input id="inm-ciu" type="text" bind:value={ciudad} />
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="modal-footer">
				<button class="btn-cancel" on:click={() => dispatch('close')} disabled={saving}>
					Cancelar
				</button>
				<button
					class="btn-save"
					on:click={handleSubmit}
					disabled={saving || !compradorNombre.trim() || !vendedorNombre.trim()}
				>
					{saving ? 'Guardando en Firestore...' : '✓ Crear Expediente y Generar Checklist'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		z-index: 9500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal-card {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 14px;
		width: 100%;
		max-width: 960px;
		max-height: 92vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.15rem 1.4rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-tag {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #818cf8;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-1);
		margin: 0.2rem 0 0;
	}

	.btn-close {
		background: var(--surface-card);
		border: 1px solid var(--border);
		color: var(--text-1);
		width: 32px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 700;
	}

	.modal-body {
		padding: 1.25rem 1.4rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.live-motor-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding: 0.65rem 0.9rem;
		border-radius: 8px;
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.35);
		font-size: 0.82rem;
		color: var(--text-1);
	}

	.alert-text {
		color: #f59e0b;
	}

	.modal-section {
		background: var(--surface-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.modal-section h3 {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-1);
		margin: 0;
	}

	.dual-parties {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.9rem;
	}

	.party-box,
	.property-box {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.party-box-title {
		font-size: 0.83rem;
		font-weight: 700;
		color: var(--text-1);
	}

	.crm-picker {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px dashed var(--border);
	}

	.crm-picker.horizontal {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 0.5rem;
	}

	.crm-picker input,
	.crm-picker select,
	.form-field input {
		width: 100%;
		padding: 0.45rem 0.68rem;
		border-radius: 7px;
		border: 1px solid var(--input-border, var(--border));
		background: var(--input-bg, var(--surface-1));
		color: var(--input-text, var(--text-1));
		font-size: 0.82rem;
		outline: none;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.form-field label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.form-grid-4 {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.65rem;
	}

	.span-2 {
		grid-column: span 2;
	}

	@media (max-width: 680px) {
		.form-grid-4,
		.crm-picker.horizontal {
			grid-template-columns: 1fr;
		}
		.span-2 {
			grid-column: span 1;
		}
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 0.95rem 1.4rem;
		border-top: 1px solid var(--border);
		background: var(--surface-card);
	}

	.btn-cancel {
		padding: 0.55rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface-1);
		color: var(--text-1);
		font-weight: 600;
		cursor: pointer;
	}

	.btn-save {
		padding: 0.55rem 1.2rem;
		border-radius: 8px;
		border: none;
		background: #10b981;
		color: #ffffff;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-save:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
