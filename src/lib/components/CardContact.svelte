<!-- src/lib/components/CardContact.svelte -->
<script lang="ts">
	import type { Contact } from '$lib/types';
	import { getContactBadgeInfo } from '$lib/functions/contactBadge';
	import { goto } from '$app/navigation';

	export let contact: Contact;
	export let showAdvisor = false;

	$: badge = getContactBadgeInfo(contact);
	$: fullName = contact.fullName || `${contact.name || ''} ${contact.lastname || ''}`.trim() || 'Sin Nombre';
	$: rawPhone = (contact.phoneRaw || contact.telephon || '').replace(/\D/g, '').slice(-10);
	$: waPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;
	$: budget = contact.budgetTope || (contact.presupuestoMax ? `$${Number(contact.presupuestoMax).toLocaleString('es-MX')}` : '');
	$: propInterest = contact.propertyTitle || contact.lonaCode || contact.propertyInterestId || '';

	function handleCardClick() {
		if (contact.id) {
			goto(`/contact/${contact.id}`);
		}
	}

	function handleActionClick(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

<div
	class="contact-card"
	role="button"
	tabindex="0"
	on:click={handleCardClick}
	on:keydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') handleCardClick();
	}}
>
	<!-- Indicador de Etapa / Badge Superior Derecho -->
	<div
		class="stage-badge"
		title={badge.tooltip}
		style="background-color: {badge.color}; border-radius: {badge.shape === 'square' ? '6px' : '50%'};"
	>
		{badge.text}
	</div>

	<!-- Encabezado de Tarjeta: Nombre y Tipo -->
	<div class="card-header">
		<h3 class="contact-name" title={fullName}>{fullName}</h3>
		{#if contact.typeContact}
			<span class="type-pill" class:pill-arrendatario={contact.typeContact === 'Arrendatario'}>
				{contact.typeContact}
			</span>
		{/if}
	</div>

	<!-- Inmueble de Interés o Lona -->
	{#if propInterest}
		<div class="prop-interest-row">
			<i class="fa-solid fa-map-pin icon"></i>
			<span class="prop-text" title={propInterest}>{propInterest}</span>
		</div>
	{/if}

	<!-- Presupuesto Máximo -->
	{#if budget}
		<div class="budget-row">
			<span class="budget-label"><i class="fa-solid fa-tag"></i> Tope:</span>
			<span class="budget-val">{budget}</span>
		</div>
	{/if}

	<!-- Asesor y Plaza (Vista de Administrador) -->
	{#if showAdvisor && (contact.associate_name || contact.city_id)}
		<div class="advisor-row">
			{#if contact.associate_name}
				<span class="advisor-pill">
					<i class="fa-solid fa-user-tie"></i> {contact.associate_name}
				</span>
			{/if}
			{#if contact.city_id}
				<span class="city-pill">
					{contact.city_id.toUpperCase()}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Barra Inferior de Acciones Rápidas -->
	<div class="card-footer" on:click={handleActionClick} role="presentation">
		{#if rawPhone}
			<a
				href="tel:+52{rawPhone}"
				class="action-btn call-btn"
				title="Llamar al cliente"
			>
				<i class="fa-solid fa-phone"></i>
				<span>{rawPhone}</span>
			</a>
			<a
				href="https://wa.me/{waPhone}"
				target="_blank"
				rel="noopener noreferrer"
				class="action-btn wa-btn"
				title="Abrir WhatsApp"
			>
				<i class="fa-brands fa-whatsapp"></i>
				<span>WhatsApp</span>
			</a>
		{/if}
		<span class="chevron-btn">
			<i class="fa-solid fa-chevron-right"></i>
		</span>
	</div>
</div>

<style>
	.contact-card {
		position: relative;
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		text-align: left;
		cursor: pointer;
		transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
	}

	.contact-card:hover {
		transform: translateY(-2px);
		border-color: rgba(12, 191, 246, 0.4);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
	}

	.stage-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 800;
		font-size: 0.8rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		border: 1.5px solid rgba(255, 255, 255, 0.9);
		user-select: none;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-right: 2.8rem;
	}

	.contact-name {
		font-size: 1.05rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.type-pill {
		align-self: flex-start;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.18rem 0.5rem;
		border-radius: 4px;
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.3);
	}

	.type-pill.pill-arrendatario {
		background: rgba(14, 165, 233, 0.15);
		color: #38bdf8;
		border-color: rgba(14, 165, 233, 0.3);
	}

	.prop-interest-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		color: #a1a1aa;
	}

	.prop-interest-row .icon {
		color: #38bdf8;
		font-size: 0.75rem;
	}

	.prop-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: #e4e4e7;
	}

	.budget-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		background: rgba(255, 255, 255, 0.03);
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		align-self: flex-start;
	}

	.budget-label {
		color: #71717a;
		font-size: 0.75rem;
	}

	.budget-val {
		color: #4ade80;
		font-weight: 700;
	}

	.advisor-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.advisor-pill {
		font-size: 0.7rem;
		color: #a1a1aa;
		background: #27272a;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.city-pill {
		font-size: 0.68rem;
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.3);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-weight: 700;
	}

	.card-footer {
		margin-top: 0.3rem;
		padding-top: 0.7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-btn {
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition: background 0.15s ease;
	}

	.call-btn {
		background: rgba(255, 255, 255, 0.08);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.call-btn:hover {
		background: rgba(255, 255, 255, 0.18);
		color: #ffffff;
	}

	.wa-btn {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.wa-btn:hover {
		background: rgba(34, 197, 94, 0.25);
		color: #22c55e;
	}

	.chevron-btn {
		margin-left: auto;
		color: #71717a;
		font-size: 0.8rem;
	}
</style>
