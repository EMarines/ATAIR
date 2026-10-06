<!-- src/lib/components/CardProperty.svelte -->
<script lang="ts">
	import type { Property } from '$lib/types';
	import { formatCurrency, formatNumber } from '$lib/functions/formatUtils';
	import { getProposalUrl } from '$lib/functions/urlUtils';
	import { notifications } from '$lib/stores/notificationStore';
	import { goto } from '$app/navigation';

	export let property: Property;

	let imgError = false;

	$: rawImg =
		property?.title_image_thumb ||
		property?.title_image_full ||
		property?.imagenPrincipal ||
		property?.imagenMiniatura ||
		(Array.isArray(property?.images) && property?.images[0]) ||
		(Array.isArray(property?.fotos) && property?.fotos[0]) ||
		'';

	$: imgSrc = imgError || !rawImg ? '/placeholder-property.png' : typeof rawImg === 'string' ? rawImg : rawImg?.url || '/placeholder-property.png';

	$: code = property?.clavePropiedad || property?.easybroker_id || property?.public_id || property?.id || '';
	$: isRental =
		String(property?.tipoOperacion).toLowerCase().includes('rent') ||
		String(property?.operation_type).toLowerCase().includes('rent');
	$: price = property?.precio || property?.price || 0;
	$: title = property?.titulo || property?.title || 'Propiedad sin título';
	$: colonia = property?.colonia || (typeof property?.location === 'string' ? property.location : property?.location?.name) || '';
	$: type = property?.tipoPropiedad || property?.property_type || 'Inmueble';

	function handleCardClick() {
		if (code) {
			goto(`/property/${encodeURIComponent(code)}`);
		}
	}

	function handleActionClick(e: MouseEvent) {
		e.stopPropagation();
	}

	function copyProposalLink(e: MouseEvent) {
		e.stopPropagation();
		if (!code) return;
		const url = getProposalUrl(code);
		navigator.clipboard.writeText(url);
		notifications.success('¡Enlace de propuesta copiado al portapapeles!');
	}
</script>

<div
	class="property-card"
	role="button"
	tabindex="0"
	on:click={handleCardClick}
	on:keydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') handleCardClick();
	}}
>
	<!-- Imagen de Portada -->
	<div class="card-image-wrap">
		<img
			src={imgSrc}
			alt={title}
			class="property-img"
			loading="lazy"
			on:error={() => (imgError = true)}
		/>

		<!-- Badges Flotantes -->
		<div class="badges-overlay">
			<span class="op-badge" class:rental-badge={isRental}>
				{isRental ? 'RENTA' : 'VENTA'}
			</span>
			{#if code}
				<span class="code-badge">{code}</span>
			{/if}
		</div>

		<!-- Tipo de Propiedad -->
		<span class="type-floating-pill">{type}</span>
	</div>

	<!-- Contenido Informativo -->
	<div class="card-body">
		<!-- Precio -->
		<div class="price-row">
			<span class="price-val">{formatCurrency(price)}</span>
			{#if isRental}
				<span class="rental-suffix">/mes</span>
			{/if}
		</div>

		<!-- Título y Ubicación -->
		<h3 class="property-title" title={title}>{title}</h3>
		{#if colonia}
			<div class="location-row">
				<i class="fa-solid fa-location-dot loc-icon"></i>
				<span class="loc-text" title={colonia}>{colonia}</span>
			</div>
		{/if}

		<!-- Características Principales -->
		<div class="features-row">
			{#if property.bedrooms || property.recamaras}
				<span class="feat-item" title="Recámaras">
					<i class="fa-solid fa-bed"></i> {property.bedrooms || property.recamaras}
				</span>
			{/if}
			{#if property.bathrooms || property.banos}
				<span class="feat-item" title="Baños">
					<i class="fa-solid fa-bath"></i> {property.bathrooms || property.banos}
				</span>
			{/if}
			{#if property.construction_size || property.construccion}
				<span class="feat-item" title="Construcción">
					<i class="fa-solid fa-ruler-combined"></i> {formatNumber(property.construction_size || property.construccion)} m²
				</span>
			{/if}
			{#if property.lot_size || property.terreno}
				<span class="feat-item" title="Terreno">
					<i class="fa-solid fa-chart-area"></i> {formatNumber(property.lot_size || property.terreno)} m²
				</span>
			{/if}
		</div>

		<!-- Botones de Acción -->
		<div class="card-actions-footer" on:click={handleActionClick} role="presentation">
			<button
				type="button"
				class="btn-share-proposal"
				on:click={copyProposalLink}
				title="Copiar link de propuesta pública"
			>
				<i class="fa-regular fa-copy"></i>
				<span>Copiar Link</span>
			</button>

			<a
				href={`/property/${encodeURIComponent(code)}`}
				class="btn-view-detail"
				title="Ver ficha completa"
			>
				<span>Ver Ficha</span>
				<i class="fa-solid fa-arrow-right"></i>
			</a>
		</div>
	</div>
</div>

<style>
	.property-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		cursor: pointer;
		transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
	}

	.property-card:hover {
		transform: translateY(-2px);
		border-color: rgba(12, 191, 246, 0.45);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
	}

	.card-image-wrap {
		position: relative;
		width: 100%;
		height: 180px;
		background: #27272a;
		overflow: hidden;
	}

	.property-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.25s ease;
	}

	.property-card:hover .property-img {
		transform: scale(1.03);
	}

	.badges-overlay {
		position: absolute;
		top: 10px;
		left: 10px;
		right: 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		pointer-events: none;
	}

	.op-badge {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		background: #10b981;
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.op-badge.rental-badge {
		background: #0284c7;
	}

	.code-badge {
		font-size: 0.7rem;
		font-weight: 700;
		background: rgba(0, 0, 0, 0.75);
		color: #e4e4e7;
		padding: 0.25rem 0.55rem;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.type-floating-pill {
		position: absolute;
		bottom: 10px;
		left: 10px;
		font-size: 0.72rem;
		font-weight: 700;
		background: rgba(0, 0, 0, 0.75);
		color: #38bdf8;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(12, 191, 246, 0.3);
	}

	.card-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		flex-grow: 1;
	}

	.price-row {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.price-val {
		font-size: 1.25rem;
		font-weight: 800;
		color: #4ade80;
	}

	.rental-suffix {
		font-size: 0.78rem;
		color: #a1a1aa;
	}

	.property-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}

	.location-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #a1a1aa;
	}

	.loc-icon {
		color: #38bdf8;
		font-size: 0.75rem;
	}

	.loc-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.features-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: #d4d4d8;
		background: rgba(255, 255, 255, 0.03);
		padding: 0.4rem 0.6rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.feat-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.feat-item i {
		color: #0cbff6;
		font-size: 0.72rem;
	}

	.card-actions-footer {
		margin-top: auto;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.btn-share-proposal {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #e4e4e7;
		padding: 0.38rem 0.7rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.btn-share-proposal:hover {
		background: rgba(12, 191, 246, 0.2);
		border-color: #0cbff6;
		color: #ffffff;
	}

	.btn-view-detail {
		background: #0cbff6;
		color: #000000;
		border: none;
		padding: 0.38rem 0.8rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 700;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition: background 0.15s ease, transform 0.15s ease;
	}

	.btn-view-detail:hover {
		background: #38bdf8;
		transform: translateY(-1px);
	}
</style>
