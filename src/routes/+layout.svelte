<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../styles/main.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		initializeAuthManager,
		authLoading,
		authInitialized,
		userStore,
		userProfile,
		isAdmin
	} from '$lib/firebase/authManager';
	import { isSandbox, currentProjectId } from '$lib/firebase/config';
	import { isPublicRoute, isAdminOnlyRoute } from '$lib/config/routes';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import NotificationContainer from '$lib/components/NotificationContainer.svelte';

	onMount(async () => {
		await initializeAuthManager();
	});

	// Guardia de navegación reactiva en cliente
	$: if ($authInitialized && !$authLoading) {
		const pathname = $page.url.pathname;
		const isAuthenticated = !!$userStore || !!$userProfile;
		const isPublic = isPublicRoute(pathname);

		if (!isAuthenticated && !isPublic) {
			goto(`/login?redirect=${encodeURIComponent(pathname)}`);
		} else if (isAuthenticated && pathname === '/login') {
			goto('/');
		}
	}
</script>

<div class="app-container">
	<NotificationContainer />

	{#if $authLoading && !$userStore && !$userProfile && $page.url.pathname !== '/login'}
		<div class="loading-overlay">
			<div class="spinner"></div>
			<p>Iniciando ATAIR CRM...</p>
		</div>
	{:else}
		<header>
			<Navbar />
		</header>

		<main>
			{#if isSandbox}
				<div class="sandbox-banner">
					<div class="sandbox-left">
						<span class="sandbox-pill">🧪 MODO SANDBOX ACTIVO</span>
						<span class="sandbox-desc">
							Conectado a <strong>{currentProjectId}</strong>. Las pruebas no afectarán los datos oficiales de producción.
						</span>
					</div>
					<span class="sandbox-badge">Aislamiento Seguro</span>
				</div>
			{/if}

			<slot />
		</main>

		<Footer />
	{/if}
</div>

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		overflow-x: hidden;
		background-color: var(--bg-color, #000000);
		color: var(--color, #f4f4f5);
	}

	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: #09090b;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		color: white;
		gap: 1rem;
	}

	.spinner {
		width: 44px;
		height: 44px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-left-color: #0cbff6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	main {
		flex: 1;
		position: relative;
		z-index: 2;
		width: 100%;
	}

	/* === SANDBOX BANNER === */
	.sandbox-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 1.5rem;
		background: linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.12) 100%);
		border-bottom: 1px solid rgba(245, 158, 11, 0.4);
		backdrop-filter: blur(8px);
	}

	.sandbox-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.sandbox-pill {
		background: #f59e0b;
		color: #18181b;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		letter-spacing: 0.04em;
	}

	.sandbox-desc {
		color: #fef3c7;
		font-size: 0.82rem;
	}

	.sandbox-desc strong {
		color: #ffffff;
		font-family: monospace;
		background: rgba(0, 0, 0, 0.3);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}

	.sandbox-badge {
		font-size: 0.72rem;
		font-weight: 600;
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.5);
		background: rgba(245, 158, 11, 0.1);
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		white-space: nowrap;
	}
</style>
