<script lang="ts">
	import { goto } from '$app/navigation';
	import { Hero } from '$components';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { userProfile } from '$lib/firebase/authManager';
	import { isAdminOnlyRoute } from '$lib/config/routes';

	interface Action {
		id: string;
		icon: string;
		title: string;
		description: string;
	}

	const actions: Action[] = [
		{
			id: 'properties',
			icon: 'fa-solid fa-house',
			title: 'Propiedades',
			description: 'Ver propiedades'
		},
		{
			id: 'contacts',
			icon: 'fa-solid fa-users',
			title: 'Contactos',
			description: 'Gestionar contactos'
		},
		{
			id: 'agenda',
			icon: 'fa-solid fa-calendar-days',
			title: 'Agenda',
			description: 'Programar citas'
		},
		{
			id: 'tramites',
			icon: 'fa-solid fa-file-contract',
			title: 'Trámites',
			description: 'Control de trámites'
		},
		{
			id: 'actions',
			icon: 'fa-solid fa-gear',
			title: 'Acciones',
			description: 'Acciones del sistema'
		},
		{
			id: 'filters',
			icon: 'fa-solid fa-user',
			title: 'Filtro',
			description: 'Propiedades-contactos'
		},
		{
			id: 'about',
			icon: 'fa-solid fa-circle-info',
			title: 'Acerca de MH',
			description: 'Información sobre ATAIR'
		},
		{
			id: 'help',
			icon: 'fa-solid fa-question-circle',
			title: 'Ayuda',
			description: 'Centro de ayuda'
		}
	];

	function handleAction(actionId: string) {
		const actionPath = getActionPath(actionId);

		// Si la ruta es solo para admin y el usuario no es admin, no hacer nada
		if (isAdminOnlyRoute(actionPath) && $userProfile?.role !== 'admin') {
			console.warn(`Acceso restringido a ${actionId} para usuarios no-admin`);
			return;
		}

		switch (actionId) {
			case 'properties':
				goto('/properties');
				break;
			case 'contacts':
				goto('/contacts');
				break;
			case 'agenda':
				goto('/agenda');
				break;
			case 'tramites':
				goto('/tramites');
				break;
			case 'actions':
				goto('/actions');
				break;
			case 'filters':
				goto('/filtros');
				break;
			case 'about':
				goto('/about');
				break;
			case 'help':
				goto('/help');
				break;
			default:
				console.log(`Acción ${actionId} aún no implementada`);
		}
	}

	function getActionPath(id: string): string {
		const paths: Record<string, string> = {
			properties: '/properties',
			contacts: '/contacts',
			agenda: '/agenda',
			tramites: '/tramites',
			actions: '/actions',
			filters: '/filtros',
			about: '/about',
			help: '/help'
		};
		return paths[id] || '/';
	}

	// Diagnóstico temporal para variables de entorno
	let envDiagnostic = {
		apiKeyConfigured: false,
		authDomainConfigured: false,
		projectIdConfigured: false
	};

	onMount(() => {
		if (browser) {
			envDiagnostic = {
				apiKeyConfigured: !!import.meta.env.VITE_FIREBASE_API_KEY,
				authDomainConfigured: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
				projectIdConfigured: !!import.meta.env.VITE_FIREBASE_PROJECT_ID
			};
		}
	});
</script>

<Hero />

<div class="container">
	<h2 class="title">Panel de Control</h2>

	<div class="actions-grid">
		{#each actions as action}
			{@const path = getActionPath(action.id)}
			{@const isRestricted = isAdminOnlyRoute(path) && $userProfile?.role !== 'admin'}
			<button
				class="action-card"
				class:disabled={isRestricted}
				on:click={() => handleAction(action.id)}
				disabled={isRestricted}
			>
				<i class={action.icon}></i>
				<h3>{action.title}</h3>
				<p>{action.description}</p>
			</button>
		{/each}
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.title {
		text-align: center;
		margin-bottom: 2rem;
		font-size: 2rem;
		color: white;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 2rem;
		padding: 1rem;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		transition: all 0.3s ease;
		cursor: pointer;
		text-align: center;
		width: 100%;
	}

	.action-card:not(.disabled):hover {
		transform: translateY(-8px);
		background: rgba(255, 255, 255, 0.08);
		border-color: #6b21a8;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
	}

	.action-card i {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		color: #6b21a8;
		transition: color 0.3s ease;
	}

	.action-card h3 {
		margin: 0.5rem 0;
		font-size: 1.25rem;
		color: white;
	}

	.action-card p {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.6);
		margin: 0;
	}

	/* Estado deshabilitado (no-admin) */
	.action-card.disabled {
		cursor: not-allowed;
		background: rgba(255, 255, 255, 0.02);
		border-color: rgba(255, 255, 255, 0.05);
		filter: grayscale(1) opacity(0.5);
	}

	.action-card.disabled i,
	.action-card.disabled h3,
	.action-card.disabled p {
		color: #888 !important;
	}

	@media (max-width: 768px) {
		.actions-grid {
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 1.5rem;
		}
	}
</style>
