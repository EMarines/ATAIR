<script lang="ts">
	import { toComaSep, toTele } from '$lib/functions/format';
	import { formatDate } from '$lib/functions/dateFunctions';
	import type { Contact } from '$types';
	import { onMount } from 'svelte';
	import { contactsStore } from '$lib/stores/dataStore';

	export let cont: Contact;
	let isValidContact = false;

	function validateContact() {
		if (!cont || !cont.id || typeof cont.id !== 'string' || cont.id.trim() === '') {
			console.error('Error: Contacto inválido o sin ID válido', cont);
			isValidContact = false;
			return;
		}
		isValidContact = true;
	}

	$: {
		if (cont) {
			validateContact();
		}
	}

	$: isAgent = (() => {
		if (!cont) return false;
		const raw = cont as any;
		const type = (cont.typeContact || cont.contactType || raw.tipo || '').toLowerCase();
		const notes = (cont.notes || raw.comContact || raw.notas || '').toLowerCase();
		const company = (raw.company || raw.inmobiliaria || '').toLowerCase();
		return (
			type.includes('agente') ||
			type.includes('constructor') ||
			type.includes('inmobiliaria') ||
			type.includes('colaborador') ||
			type.includes('asesor') ||
			notes.includes('sinergia') ||
			notes.includes('agente') ||
			notes.includes('constructor') ||
			notes.includes('inmobiliaria') ||
			Boolean(cont.procedencia)
		);
	})();

	$: agentCompany = (() => {
		if (!cont) return '';
		const raw = cont as any;
		if (raw.company && String(raw.company).trim()) return String(raw.company).trim();
		if (raw.inmobiliaria && String(raw.inmobiliaria).trim()) return String(raw.inmobiliaria).trim();

		// Respaldo inteligente: si se capturó en las notas (ej. "Constructora: ...", "Inmobiliaria: CituHaus", "Empresa: ...")
		const rawNotes = String(cont.notes || raw.comContact || raw.notas || '').trim();
		if (rawNotes) {
			const match = rawNotes.match(/(?:constructora|inmobiliaria|empresa|agencia|broker)\s*[:=-]?\s*([^\n,\.]+)/i);
			if (match && match[1]?.trim()) {
				return match[1].trim();
			}
		}
		return '';
	})();

	$: rangeProp = (() => {
		if (!cont) return '';
		const raw = cont as any;
		return raw.rangeProp || '';
	})();

	onMount(() => {
		validateContact();
	});
</script>

{#if isValidContact}
	<div class="card" class:card--agent={isAgent}>
		<div class="card__infoHead">
			<span class="date">Alta: {formatDate(cont.createdAt)}</span>
		</div>

		<div class="card__TitleWrap">
			<span class="card__Title">{cont.name} {cont.lastname}</span>
			{#if isAgent && agentCompany}
				<span class="card__SubCompany">🏢 {agentCompany}</span>
			{/if}
		</div>

		<div class="info__cont">
			{#if cont.telephon}
				<span> <i class="fa-solid fa-mobile-screen-button"></i> {toTele(cont.telephon)}</span>
			{/if}
			{#if cont.email}
				<span title={cont.email}> <i class="fa-regular fa-envelope"></i></span>
			{/if}
			{#if !isAgent}
				{#if cont.budget}
					<span
						><i class="fa-solid fa-money-check-dollar"></i> $ {toComaSep(Number(cont.budget))}.</span
					>
				{:else if rangeProp}
					<span> <i class="fa-solid fa-money-check-dollar"></i> Pres: {rangeProp}</span>
				{/if}
			{/if}
		</div>

		<div class="info__tags">
			{#if cont.tagsProperty}
				<span
					><i class="fa-solid fa-tags to__showR"></i>
					{cont.tagsProperty.toString().replaceAll(',', ', ')}</span
				>
			{/if}
			{#if cont.locaProperty}
				<span
					><i class="fa-sharp fa-regular fa-compass to__showR"></i>
					{cont.locaProperty.toString().replaceAll(',', ', ')}</span
				>
			{/if}
		</div>
	</div>
{:else}
	<div class="card card--invalid">
		<div class="card__info">
			<div class="card__infoHead">
				<span class="card__Title">Contacto inválido</span>
			</div>
			<div class="info__cont">
				<span>Este contacto no tiene un ID válido</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		width: 100%;
		background: var(--surface-card, rgb(56, 56, 56));
		color: var(--color, #ffffff);
		border: 1px solid #cbd5e1;
		border-left: 3.5px solid #eab308;
		border-radius: 8px;
		padding: 0.65em;
		margin: 0;
		gap: 0.8rem;
		transition: transform 0.25s, box-shadow 0.25s, background 0.25s, border-color 0.25s;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--card-shadow, 0 4px 12px rgba(0, 0, 0, 0.1));
	}

	.card:hover {
		transform: translateY(-5px);
		box-shadow: var(--card-shadow-hover, 0 8px 20px rgba(0, 0, 0, 0.35)), 0 0 10px rgba(203, 213, 225, 0.25);
		background: var(--surface-card-hover, rgb(76, 76, 76));
		border-color: #f8fafc;
	}

	.card--agent {
		border-left: 3.5px solid #8b5cf6;
	}

	.card--invalid {
		background-color: #553333;
		border: 1px solid #aa5555;
	}

	.card__infoHead {
		display: flex;
		width: 100%;
		font-size: 0.8rem;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.card__TitleWrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		gap: 0.2rem;
	}

	.card__Title {
		display: flex;
		font-size: 1.2em;
		width: 100%;
		justify-content: center;
		font-weight: 600;
		text-transform: capitalize;
		text-align: center;
	}

	.card__SubCompany {
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--text-muted, #cbd5e1);
		opacity: 0.9;
	}

	.info__cont {
		display: flex;
		justify-content: space-evenly;
		font-size: 0.9em;
	}

	.info__tags {
		display: flex;
		flex-direction: column;
		font-size: 0.8em;
	}
</style>
