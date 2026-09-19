<script lang="ts">
  import { db } from '$lib/firebase_toggle';
  import { syncEasyBrokerProperties } from '$lib/easybroker';

  export let current: 'subir-propiedad' | 'subir-link' | 'herramientas' | 'none' = 'none';
  export let onSyncComplete: ((res: any) => void) | undefined = undefined;
  export let onOpenModal: ((method: 'texto' | 'easybroker' | 'link') => void) | undefined = undefined;

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
      {#if current === 'subir-propiedad'}
        <button
          type="button"
          class="btn-subir-texto"
          on:click={() => onOpenModal && onOpenModal('texto')}
          title="Subir arrastrando texto de WhatsApp y fotos con IA"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>Texto y Fotos</span>
        </button>

        <button
          type="button"
          class="btn-subir-clave"
          on:click={() => onOpenModal && onOpenModal('easybroker')}
          title="Descargar y precargar propiedad desde EasyBroker usando su clave (EB-...)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
          </svg>
          <span>Por Clave EB</span>
        </button>

        <button
          type="button"
          class="btn-action-link"
          on:click={() => onOpenModal && onOpenModal('link')}
          title="Importar propiedad pegando enlace externo con automatización n8n"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <span>Por Link</span>
        </button>
      {:else}
        <a
          href="/subir-propiedad?import=whatsapp"
          class="btn-subir-texto"
          title="Subir arrastrando texto de WhatsApp y fotos con IA"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>Texto y Fotos</span>
        </a>

        <a
          href="/subir-propiedad?import=easybroker"
          class="btn-subir-clave"
          title="Descargar y precargar propiedad desde EasyBroker usando su clave (EB-...)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
          </svg>
          <span>Por Clave EB</span>
        </a>

        <a
          href="/subir-propiedad?import=link"
          class="btn-action-link"
          title="Ingestar propiedad pegando enlace externo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <span>Por Link</span>
        </a>
      {/if}
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

  .btn-subir-texto {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn-subir-texto:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
    filter: brightness(1.1);
  }

  .btn-subir-clave,
  .btn-sync-quick {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    border: none;
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn-subir-clave:hover:not(:disabled),
  .btn-sync-quick:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
    filter: brightness(1.1);
  }

  .btn-subir-clave:disabled,
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
    cursor: pointer;
    font-family: inherit;
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
