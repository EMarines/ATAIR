<!-- src/routes/admin/squad/+page.svelte -->
<!-- Vista Ejecutiva: Organigrama Jerárquico y Líneas de Mando del Squad IA - ATAIR CRM -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { isAdmin, isAsociado, userProfile, setDevRole } from '$lib/firebase/authManager';
	import { notifications } from '$lib/stores/notificationStore';

	let isFullscreen = false;
	let squadFrame: HTMLIFrameElement;
	let copiedMiro = false;

	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
		const elem = document.getElementById('squadContainer');
		if (isFullscreen) {
			if (elem && elem.requestFullscreen) {
				elem.requestFullscreen().catch(() => {});
			}
		} else {
			if (document.fullscreenElement && document.exitFullscreen) {
				document.exitFullscreen().catch(() => {});
			}
		}
	}

	onMount(() => {
		const handleFsChange = () => {
			isFullscreen = !!document.fullscreenElement;
		};
		document.addEventListener('fullscreenchange', handleFsChange);
		return () => {
			document.removeEventListener('fullscreenchange', handleFsChange);
		};
	});

	function copyMiroLink() {
		const miroUrl = `${window.location.origin}/organigrama_squad_elite.html`;
		const embedCode = `<iframe src="${miroUrl}" width="1440" height="900" frameborder="0" allowfullscreen></iframe>`;
		navigator.clipboard.writeText(embedCode).then(() => {
			copiedMiro = true;
			notifications.success('✓ Código de Embed para Miro copiado al portapapeles');
			setTimeout(() => (copiedMiro = false), 3500);
		}).catch(() => {
			notifications.info(`Enlace Miro: ${miroUrl}`);
		});
	}

	function openInNewTab() {
		window.open('/organigrama_squad_elite.html', '_blank');
	}
</script>

<svelte:head>
	<title>Squad IA • Organigrama Jerárquico | ATAIR CRM</title>
</svelte:head>

<div class="squad-page" id="squadContainer" class:is-fullscreen={isFullscreen}>
	<!-- Header de Comando / Breadcrumbs -->
	<div class="squad-topbar">
		<div class="topbar-left">
			<div class="breadcrumb">
				<a href="/" class="bc-link"><i class="fa-solid fa-chart-pie"></i> Inicio</a>
				<span class="bc-sep">/</span>
				<a href="/admin/asociados" class="bc-link">Dirección</a>
				<span class="bc-sep">/</span>
				<span class="bc-current">Squad IA & Cadena de Mando</span>
			</div>
			<div class="title-row">
				<div class="icon-badge">
					<i class="fa-solid fa-network-wired"></i>
				</div>
				<div>
					<h1 class="page-title">
						Organigrama Jerárquico • Squad Match Home & SICH
					</h1>
					<p class="page-subtitle">
						Líneas de mando activas: Enrique Marines (Dirección) &rarr; Maya & Mina (Estado Mayor) &rarr; Squad Especialistas
					</p>
				</div>
			</div>
		</div>

		<div class="topbar-right">
			{#if !$isAdmin}
				<button
					type="button"
					class="btn-switch-admin"
					title="Activar permisos de Administrador"
					on:click={async () => {
						await setDevRole('admin');
					}}
				>
					<i class="fa-solid fa-crown"></i>
					<span>Activar Modo Admin</span>
				</button>
			{/if}

			<button
				type="button"
				class="btn-action btn-miro"
				title="Copiar código de integración para tablero Miro"
				on:click={copyMiroLink}
			>
				<i class="fa-solid {copiedMiro ? 'fa-check' : 'fa-share-nodes'}"></i>
				<span>{copiedMiro ? '¡Copiado!' : 'Integrar en Miro'}</span>
			</button>

			<button
				type="button"
				class="btn-action"
				title="Abrir en pestaña completa independiente"
				on:click={openInNewTab}
			>
				<i class="fa-solid fa-arrow-up-right-from-square"></i>
				<span>Pestaña Nueva</span>
			</button>

			<button
				type="button"
				class="btn-action btn-fullscreen"
				title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla Completa'}
				on:click={toggleFullscreen}
			>
				<i class="fa-solid {isFullscreen ? 'fa-compress' : 'fa-expand'}"></i>
				<span>{isFullscreen ? 'Restaurar' : 'Pantalla Completa'}</span>
			</button>
		</div>
	</div>

	<!-- Lienzo del Organigrama Interactivo -->
	<div class="frame-container">
		<iframe
			bind:this={squadFrame}
			src="/organigrama_squad_elite.html"
			title="Organigrama Jerárquico Squad IA Match Home & SICH"
			class="squad-frame"
			allow="clipboard-write"
		></iframe>
	</div>
</div>

<style>
	.squad-page {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: calc(100vh - 65px);
		background-color: #070a12;
		color: #f1f5f9;
		overflow: hidden;
		position: relative;
	}

	.squad-page.is-fullscreen {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		z-index: 9999;
	}

	.squad-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 0.75rem 1.5rem;
		background: #0d1322;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.topbar-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.bc-link {
		color: #94a3b8;
		text-decoration: none;
		transition: color 0.15s ease;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.bc-link:hover {
		color: #38bdf8;
	}

	.bc-sep {
		opacity: 0.5;
	}

	.bc-current {
		color: #f59e0b;
		font-weight: 600;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-badge {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
		border: 1px solid rgba(245, 158, 11, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #f59e0b;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.page-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.page-subtitle {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.btn-switch-admin {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		background: rgba(168, 85, 247, 0.2);
		border: 1px solid rgba(168, 85, 247, 0.5);
		color: #e9d5ff;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		transition: all 0.15s ease;
	}

	.btn-switch-admin:hover {
		background: rgba(168, 85, 247, 0.35);
		border-color: #c084fc;
		transform: translateY(-1px);
	}

	.btn-action {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.42rem 0.8rem;
		border-radius: 8px;
		background: #1e293b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #cbd5e1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-action:hover {
		background: #334155;
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.btn-miro {
		background: rgba(37, 99, 235, 0.2);
		border-color: rgba(59, 130, 246, 0.4);
		color: #93c5fd;
	}

	.btn-miro:hover {
		background: rgba(37, 99, 235, 0.35);
		border-color: #60a5fa;
		color: #ffffff;
	}

	.btn-fullscreen {
		background: rgba(245, 158, 11, 0.15);
		border-color: rgba(245, 158, 11, 0.35);
		color: #fcd34d;
	}

	.btn-fullscreen:hover {
		background: rgba(245, 158, 11, 0.25);
		border-color: #f59e0b;
		color: #ffffff;
	}

	.frame-container {
		flex: 1;
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		background: #070a12;
	}

	.squad-frame {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
		background: #070a12;
	}

	@media (max-width: 768px) {
		.squad-topbar {
			padding: 0.6rem 1rem;
		}

		.page-title {
			font-size: 0.95rem;
		}

		.page-subtitle {
			display: none;
		}

		.btn-action span {
			display: none;
		}
	}
</style>
