<script lang="ts">
  import { db } from '$lib/firebase_toggle';
  import { syncEasyBrokerProperties } from '$lib/easybroker';

  export let current: 'subir-propiedad' | 'subir-link' | 'herramientas' | 'none' = 'none';
  export let onSyncComplete: ((res: any) => void) | undefined = undefined;

  let isSyncing = false;
  let syncFeedback: { type: 'success' | 'error'; message: string } | null = null;

  async function handleSync() {
    if (isSyncing) return;
    isSyncing = true;
    syncFeedback = null;
    try {
      const res = await syncEasyBrokerProperties(db);
      syncFeedback = {
        type: 'success',
        message: `¡Sincronización completada! (${res.added} nuevas, ${res.updated} actualizadas, ${res.deleted} eliminadas, ${res.unchanged} sin cambios). Total: ${res.totalFetched} propiedades de EasyBroker.`,
      };
      if (onSyncComplete) {
        onSyncComplete(res);
      }
    } catch (err: any) {
      console.error('Error sincronizando EasyBroker:', err);
      syncFeedback = {
        type: 'error',
        message: `Error al sincronizar: ${err?.message || err}`,
      };
    } finally {
      isSyncing = false;
      setTimeout(() => {
        syncFeedback = null;
      }, 9000);
    }
  }
</script>

<div class="property-nav-actions-container">
  <div class="property-nav-actions">
    {#if current !== 'herramientas'}
      <button
        type="button"
        class="btn-sync-quick"
        on:click={handleSync}
        disabled={isSyncing}
        title="Sincronizar catálogo de EasyBroker directamente a la base de datos"
      >
        {#if isSyncing}
          <span class="btn-spinner"></span>
          <span>Sincronizando...</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Sincronizar EasyBroker</span>
        {/if}
      </button>
    {/if}

    {#if current !== 'subir-link'}
      <a href="/subir-link" class="btn-action-link" title="Ingestar propiedad pegando enlace externo">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        <span>Por Link</span>
      </a>
    {/if}

    {#if current !== 'subir-propiedad'}
      <a href="/subir-propiedad" class="btn-new-prop" title="Registrar propiedad manualmente">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span>Nueva Propiedad</span>
      </a>
    {/if}
  </div>

  {#if syncFeedback}
    <div class="sync-banner {syncFeedback.type}">
      {#if syncFeedback.type === 'success'}
        <span class="banner-icon">✅</span>
      {:else}
        <span class="banner-icon">❌</span>
      {/if}
      <span class="banner-text">{syncFeedback.message}</span>
      <button class="banner-close" on:click={() => syncFeedback = null}>✕</button>
    </div>
  {/if}
</div>

<style>
  .property-nav-actions-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .property-nav-actions {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .btn-sync-quick {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn-sync-quick:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    filter: brightness(1.1);
  }

  .btn-sync-quick:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-action-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(14, 165, 233, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(14, 165, 233, 0.3);
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-action-link:hover {
    background: rgba(14, 165, 233, 0.22);
    border-color: #38bdf8;
    color: white;
    transform: translateY(-1px);
  }

  .btn-new-prop {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary, #f8fafc);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-new-prop:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(99, 102, 241, 0.4);
    color: white;
    transform: translateY(-1px);
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .sync-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.1rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.84rem;
    animation: fadeIn 0.3s ease;
    width: 100%;
    max-width: 600px;
    box-sizing: border-box;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sync-banner.success {
    background: rgba(52, 211, 153, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.3);
    color: #34d399;
  }

  .sync-banner.error {
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.3);
    color: #f87171;
  }

  .banner-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    line-height: 1.35;
  }

  .banner-close {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 1rem;
    cursor: pointer;
    padding: 0 0.25rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .banner-close:hover {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .property-nav-actions-container {
      align-items: stretch;
      width: 100%;
    }
    .property-nav-actions {
      width: 100%;
    }
    .btn-sync-quick, .btn-action-link, .btn-new-prop {
      flex: 1;
      justify-content: center;
    }
  }
</style>
