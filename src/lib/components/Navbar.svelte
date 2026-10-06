<!-- src/lib/components/Navbar.svelte -->
<!-- Barra de navegación con soporte multi-rol (Admin vs Asociado) y estética oscura original -->

<script lang="ts">
	import '../../styles/main.css';
	import { userStore, userProfile, logoutUser, isAdmin, isAsociado } from '$lib/firebase/authManager';
	import { derived } from 'svelte/store';
	import { onMount } from 'svelte';
	import Moon from './icons/moon.svelte';
	import Sun from './icons/sun.svelte';
	import { empresa } from '$lib/config/empresa';
	import { goto } from '$app/navigation';

	let currentTheme = 'dark';
	let nav__links = 'wide';
	let menuOpen = false;
	let logoutLoading = false;

	const isAuthenticated = derived([userStore, userProfile], ([$u, $p]) => !!$u || !!$p);

	async function logout() {
		logoutLoading = true;
		try {
			await logoutUser();
			goto('/login');
		} catch (error) {
			console.error('❌ Error durante logout:', error);
		} finally {
			logoutLoading = false;
		}
	}

	onMount(() => {
		const userPrefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const hasUserSetDarkModeManually = document.documentElement.dataset.theme === 'dark';
		if (!hasUserSetDarkModeManually) {
			setTheme(userPrefersDarkMode ? 'dark' : 'light');
		} else {
			currentTheme = document.documentElement.dataset.theme || 'dark';
		}
	});

	const setTheme = (theme: string) => {
		document.documentElement.dataset.theme = theme;
		localStorage.setItem('theme', theme);
		currentTheme = theme;
	};

	function toggleMenu() {
		menuOpen = !menuOpen;
		nav__links = menuOpen ? 'small' : 'wide';

		if (menuOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'auto';
		}
	}

	function handleLinkClick() {
		if (menuOpen) {
			toggleMenu();
		}
	}
</script>

<nav>
	<div class="container">
		<div class="brand-container">
			<a href="/" class="brand-link" on:click={handleLinkClick}>
				<h1 class="title">{empresa.companyName}</h1>
				<span class="sub-brand">ATAIR CRM</span>
			</a>
			{#if $isAuthenticated && $userProfile}
				<div class="role-pill" class:admin-pill={$isAdmin} class:asociado-pill={$isAsociado}>
					{#if $isAdmin}
						<i class="fa-solid fa-shield-halved"></i> Admin
					{:else if $isAsociado}
						<i class="fa-solid fa-handshake"></i> Asociado ({$userProfile?.city_id?.toUpperCase() || 'CUU'})
					{:else}
						<i class="fa-solid fa-user"></i> Usuario
					{/if}
				</div>
			{/if}
		</div>

		<button
			class="nav__target"
			on:click={toggleMenu}
			aria-label="Abrir menú de navegación"
			aria-expanded={menuOpen}
		>
			<i class="fa-solid {menuOpen ? 'fa-xmark' : 'fa-bars'} menu-fa-icon"></i>
		</button>

		{#if menuOpen}
			<div class="menu-overlay" on:click={toggleMenu} aria-hidden="true"></div>
		{/if}

		<ul class={nav__links} id="menu" role="menu">
			{#if $isAuthenticated}
				<li role="menuitem">
					<a href="/" class="nav__link" on:click={handleLinkClick}>
						<i class="fa-solid fa-chart-pie link-icon"></i> Dashboard
					</a>
				</li>

				{#if $isAsociado}
					<li role="menuitem">
						<a href="/ingesta-lead" class="nav__link ingesta-link" on:click={handleLinkClick}>
							<i class="fa-solid fa-bolt link-icon"></i> Captar Lead
						</a>
					</li>
				{/if}

				<li role="menuitem">
					<a href="/contacts" class="nav__link" on:click={handleLinkClick}>
						<i class="fa-solid fa-address-book link-icon"></i> Contactos
					</a>
				</li>

				<li role="menuitem">
					<a href="/properties" class="nav__link" on:click={handleLinkClick}>
						<i class="fa-solid fa-building link-icon"></i> Propiedades
					</a>
				</li>

				<li role="menuitem">
					<a href="/agenda" class="nav__link" on:click={handleLinkClick}>
						<i class="fa-solid fa-calendar-check link-icon"></i> Agenda
					</a>
				</li>

				{#if $isAdmin}
					<li role="menuitem">
						<a href="/admin/asociados" class="nav__link admin-special-link" on:click={handleLinkClick}>
							<i class="fa-solid fa-users-gear link-icon"></i> Asociados
						</a>
					</li>
				{/if}

				<li role="menuitem" class="user-greeting">
					<span class="user-email-text" title={$userProfile?.email || ''}>
						{$userProfile?.displayName || $userProfile?.email?.split('@')[0] || 'Sesión activa'}
					</span>
				</li>

				<li role="menuitem">
					<button
						class="logout-btn"
						on:click={() => {
							handleLinkClick();
							logout();
						}}
						disabled={logoutLoading}
					>
						<i class="fa-solid fa-arrow-right-from-bracket"></i>
						{logoutLoading ? 'Cerrando...' : 'Salir'}
					</button>
				</li>
			{:else}
				<li role="menuitem">
					<a href="/login" class="nav__link login-btn-nav" on:click={handleLinkClick}>
						<i class="fa-solid fa-right-to-bracket link-icon"></i> Iniciar Sesión
					</a>
				</li>
			{/if}

			<li role="menuitem" class="theme-toggle-li">
				<button
					class="theme-toggle"
					on:click={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
					aria-label="Cambiar tema"
				>
					{#if currentTheme === 'dark'}
						<Sun />
					{:else}
						<Moon />
					{/if}
				</button>
			</li>
		</ul>
	</div>
</nav>

<style>
	nav {
		background-color: var(--nav-bg, #18181b);
		border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
		position: sticky;
		top: 0;
		z-index: 100;
		width: 100%;
		backdrop-filter: blur(12px);
	}

	.container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.brand-container {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.brand-link {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		text-decoration: none;
	}

	.title {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--nav-logo, #ffffff);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.sub-brand {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		background: linear-gradient(135deg, #0284c7 0%, #0cbff6 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.role-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.admin-pill {
		background: rgba(168, 85, 247, 0.18);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.4);
	}

	.asociado-pill {
		background: rgba(12, 191, 246, 0.15);
		color: #38bdf8;
		border: 1px solid rgba(12, 191, 246, 0.4);
	}

	.nav__target {
		display: none;
		background: transparent;
		border: none;
		color: var(--nav-text, #ffffff);
		font-size: 1.3rem;
		cursor: pointer;
	}

	ul.wide {
		display: flex;
		align-items: center;
		list-style: none;
		gap: 1.25rem;
		margin: 0;
		padding: 0;
	}

	.nav__link {
		color: var(--nav-text, #f4f4f5);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.nav__link:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #0cbff6;
	}

	.ingesta-link {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399 !important;
		border: 1px solid rgba(16, 185, 129, 0.35);
	}

	.admin-special-link {
		color: #c084fc !important;
	}

	.link-icon {
		font-size: 0.85rem;
		opacity: 0.8;
	}

	.user-greeting {
		display: flex;
		align-items: center;
	}

	.user-email-text {
		font-size: 0.78rem;
		color: var(--text-muted, #a1a1aa);
		max-width: 140px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: rgba(255, 255, 255, 0.05);
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
	}

	.logout-btn {
		background: transparent;
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #f87171;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		transition: all 0.2s ease;
	}

	.logout-btn:hover {
		background: rgba(239, 68, 68, 0.15);
		border-color: #ef4444;
	}

	.theme-toggle-li {
		display: flex;
		align-items: center;
	}

	.theme-toggle {
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 0.25rem;
		color: var(--nav-text, #ffffff);
	}

	@media (max-width: 900px) {
		.nav__target {
			display: block;
		}

		ul.wide {
			display: none;
		}

		ul.small {
			display: flex;
			flex-direction: column;
			position: fixed;
			top: 60px;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--nav-bg, #18181b);
			padding: 2rem 1.5rem;
			gap: 1.5rem;
			z-index: 101;
			overflow-y: auto;
		}

		.menu-overlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.7);
			z-index: 99;
		}
	}
</style>
