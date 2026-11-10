<script lang="ts">
	import { whatsappBroadcastStore } from '$lib/stores/whatsappBroadcastStore';

	let showErrors = false;

	$: state = $whatsappBroadcastStore;
	$: visible = state.isRunning || state.failedItems.length > 0;
	$: percent = state.total > 0 ? Math.min(100, Math.round((state.processed / state.total) * 100)) : 0;

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if ($whatsappBroadcastStore.isRunning) {
			event.preventDefault();
			event.returnValue = 'Hay envíos de WhatsApp en curso en segundo plano.';
			return event.returnValue;
		}
	}
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />

{#if visible}
	<div class="waba-monitor" class:has-errors={!state.isRunning && state.failed > 0} role="status" aria-live="polite">
		<div class="waba-header">
			<div class="waba-title">
				{#if state.isRunning}
					<span class="pulse-dot"></span>
					<span>WhatsApp API (2° plano) · {state.processed}/{state.total}</span>
				{:else}
					<i class="fa-solid fa-triangle-exclamation warn-icon"></i>
					<span>Resumen WhatsApp API ({state.sent} enviados, {state.failed} con aviso)</span>
				{/if}
			</div>

			{#if !state.isRunning}
				<button
					type="button"
					class="close-btn"
					on:click={() => {
						showErrors = false;
						whatsappBroadcastStore.dismiss();
					}}
					aria-label="Cerrar monitor"
				>
					✕
				</button>
			{/if}
		</div>

		{#if state.isRunning}
			<div class="progress-track">
				<div class="progress-fill" style="width: {percent}%"></div>
			</div>
			<p class="waba-sub">
				Enviando <strong>{state.currentPropertyId}</strong> a <strong>{state.currentContactName || '...'}</strong>
				<span class="safe-tag">E3/E4</span>
			</p>
		{:else if state.failedItems.length > 0}
			<div class="error-actions">
				<button type="button" class="toggle-err-btn" on:click={() => (showErrors = !showErrors)}>
					{showErrors ? 'Ocultar detalle' : `Ver detalle (${state.failedItems.length})`}
				</button>
			</div>

			{#if showErrors}
				<ul class="error-list">
					{#each state.failedItems as item}
						<li>
							<strong>{item.contactName}</strong> ({item.phone}):
							<span>{item.error}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.waba-monitor {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 9998;
		width: min(380px, calc(100vw - 32px));
		background: rgba(17, 24, 39, 0.96);
		border: 1px solid rgba(16, 185, 129, 0.45);
		border-radius: 12px;
		padding: 12px 14px;
		color: #f9fafb;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(10px);
	}

	.waba-monitor.has-errors {
		border-color: rgba(245, 158, 11, 0.55);
	}

	.waba-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.waba-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.pulse-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 0 rgba(16, 185, 129, 0.7);
		animation: wabaPulse 1.4s infinite;
		flex-shrink: 0;
	}

	@keyframes wabaPulse {
		0% {
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
		}
		70% {
			box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
		}
	}

	.warn-icon {
		color: #f59e0b;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 2px 6px;
		border-radius: 6px;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		overflow: hidden;
		margin: 8px 0 6px;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #10b981, #34d399);
		transition: width 0.3s ease;
	}

	.waba-sub {
		margin: 0;
		font-size: 0.78rem;
		color: #d1d5db;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.safe-tag {
		background: rgba(16, 185, 129, 0.18);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.35);
		font-size: 0.68rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 999px;
		margin-left: auto;
	}

	.error-actions {
		margin-top: 8px;
	}

	.toggle-err-btn {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.35);
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 0.76rem;
		cursor: pointer;
	}

	.error-list {
		margin: 8px 0 0;
		padding-left: 16px;
		max-height: 150px;
		overflow-y: auto;
		font-size: 0.74rem;
		color: #e5e7eb;
	}

	.error-list li {
		margin-bottom: 4px;
		line-height: 1.35;
	}

	.error-list span {
		color: #fca5a5;
	}
</style>
