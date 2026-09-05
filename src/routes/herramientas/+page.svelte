<script lang="ts">
  import { db } from '$lib/firebase_toggle';
  import { syncEasyBrokerProperties } from '$lib/easybroker';
  import PropertyNavActions from '$lib/components/PropertyNavActions.svelte';

  const WEBHOOK_CLEANUP = import.meta.env.VITE_N8N_WEBHOOK_CLEANUP ?? '';

  const LS_KEY_EB = 'mh_last_sync_easybroker';
  const LS_KEY_CL = 'mh_last_sync_cleanup';

  // ============================================================
  // ESTADO DE SINCRONIZACIÓN EASYBROKER
  // ============================================================
  let statusEB: 'idle'|'fetching'|'reading'|'writing'|'success'|'error' = 'idle';
  let errorEB = '';
  let lastSyncEB = getLastSync(LS_KEY_EB);
  let syncResultEB = { totalFetched: 0, added: 0, updated: 0, deleted: 0, unchanged: 0, totalInDb: 0 };
  let writeProgress = { saved: 0, total: 0 };

  // ============================================================
  // ESTADO DE LIMPIEZA
  // ============================================================
  let statusCL: 'idle'|'loading'|'success'|'error' = 'idle';
  let errorCL = '';
  let lastSyncCL = getLastSync(LS_KEY_CL);

  function getLastSync(key: string): Date | null {
    if (typeof localStorage === 'undefined') return null;
    const val = localStorage.getItem(key);
    return val ? new Date(val) : null;
  }

  function formatSync(d: Date | null): string {
    if (!d) return 'Nunca';
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Sincronización EasyBroker -> Firebase
  async function syncEasyBroker() {
    if (!db) {
      errorEB = 'Base de datos no inicializada';
      statusEB = 'error';
      return;
    }
    statusEB = 'fetching';
    errorEB = '';
    writeProgress = { saved: 0, total: 0 };

    try {
      const result = await syncEasyBrokerProperties(db, (progress) => {
        if (progress.phase === 'fetching') {
          statusEB = 'fetching';
        } else if (progress.phase === 'reading') {
          statusEB = 'reading';
        } else if (progress.phase === 'writing') {
          statusEB = 'writing';
          if (progress.saved !== undefined && progress.total !== undefined) {
            writeProgress = { saved: progress.saved, total: progress.total };
          }
        }
      });

      syncResultEB = result;

      const now = new Date();
      localStorage.setItem(LS_KEY_EB, now.toISOString());
      lastSyncEB = now;
      statusEB = 'success';

      setTimeout(() => { statusEB = 'idle'; }, 10000);
    } catch (err: any) {
      errorEB = err.message || 'Error durante la sincronización';
      statusEB = 'error';
    }
  }

  // Depuración n8n
  async function triggerCleanup() {
    statusCL = 'loading';
    errorCL = '';
    try {
      if (!WEBHOOK_CLEANUP) {
        throw new Error('El webhook de limpieza no está configurado. Agrega VITE_N8N_WEBHOOK_CLEANUP al archivo .env');
      }
      const res = await fetch(WEBHOOK_CLEANUP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const now = new Date();
      localStorage.setItem(LS_KEY_CL, now.toISOString());
      lastSyncCL = now;
      statusCL = 'success';
      setTimeout(() => { statusCL = 'idle'; }, 6000);
    } catch (err: any) {
      errorCL = err.message || 'Error al disparar la depuración';
      statusCL = 'error';
    }
  }
</script>

<svelte:head>
  <title>Herramientas – ATAIR SGI</title>
  <meta name="description" content="Herramientas de sincronización con EasyBroker y mantenimiento del inventario." />
</svelte:head>

<div class="page-container">
  <div class="page-header-row">
    <div class="page-header">
      <div class="header-badge-row">
        <span class="module-tag">Mantenimiento & Sincronización</span>
      </div>
      <h1>Herramientas del Catálogo</h1>
      <p>Acciones de sincronización con EasyBroker, depuración y mantenimiento de propiedades.</p>
    </div>

    <PropertyNavActions current="herramientas" />
  </div>

  <div class="tools-grid">
    <!-- TARJETA EASYBROKER -->
    <div class="tool-card glass">
      <div class="tool-header">
        <div class="tool-icon-wrap" style="background: linear-gradient(135deg, #6366f1, #a78bfa);">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
        <div>
          <h2>Sincronizar EasyBroker</h2>
          <p>Importa, actualiza y sincroniza las propiedades en la colección <code>properties</code></p>
        </div>
      </div>

      <div class="tool-body">
        <div class="info-rows">
          <div class="tool-info-row">
            <span class="info-label">Última sincronización</span>
            <span class="info-value" class:info-never={!lastSyncEB}>{formatSync(lastSyncEB)}</span>
          </div>

          {#if statusEB === 'success'}
            <div class="tool-info-row">
              <span class="info-label">Total en EasyBroker</span>
              <span class="info-value">{syncResultEB.totalFetched}</span>
            </div>
            <div class="tool-info-row">
              <span class="info-label">Nuevas agregadas</span>
              <span class="info-value" style="color: #34d399; font-weight: 700;">+{syncResultEB.added}</span>
            </div>
            <div class="tool-info-row">
              <span class="info-label">Modificadas</span>
              <span class="info-value" style="color: #60a5fa; font-weight: 700;">{syncResultEB.updated}</span>
            </div>
            <div class="tool-info-row">
              <span class="info-label">Eliminadas / Retiradas</span>
              <span class="info-value" style="color: #fbbf24; font-weight: 700;">{syncResultEB.deleted}</span>
            </div>
            <div class="tool-info-row">
              <span class="info-label">Sin cambios</span>
              <span class="info-value" style="color: #64748b;">{syncResultEB.unchanged}</span>
            </div>
          {/if}
        </div>

        {#if statusEB === 'fetching' || statusEB === 'reading' || statusEB === 'writing'}
          <div class="progress-wrap">
            <div class="progress-label">
              <span>
                {#if statusEB === 'fetching'}
                  Consultando catálogo de EasyBroker...
                {:else if statusEB === 'reading'}
                  Comparando diferencias con Firebase...
                {:else}
                  Escribiendo cambios en Firebase ({writeProgress.saved}/{writeProgress.total})...
                {/if}
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: {statusEB === 'writing' && writeProgress.total > 0 ? Math.round(writeProgress.saved / writeProgress.total * 100) : 35}%"
              ></div>
            </div>
          </div>
        {/if}

        {#if statusEB === 'success'}
          <div class="tool-alert success">
            ✅ Sincronización completada: <strong>{syncResultEB.added} agregadas</strong>, <strong>{syncResultEB.updated} modificadas</strong>, <strong>{syncResultEB.deleted} eliminadas</strong> en <code>properties</code>.
          </div>
        {:else if statusEB === 'error'}
          <div class="tool-alert error">❌ {errorEB}</div>
        {/if}

        <div class="collection-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          Colección unificada Firebase: <code>properties</code>
        </div>

        <button
          class="btn-tool btn-eb"
          on:click={syncEasyBroker}
          disabled={statusEB === 'fetching' || statusEB === 'reading' || statusEB === 'writing'}
        >
          {#if statusEB === 'fetching' || statusEB === 'reading' || statusEB === 'writing'}
            <span class="btn-spinner"></span>
            Sincronizando...
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Sincronizar EasyBroker → Firebase
          {/if}
        </button>
      </div>
    </div>

    <!-- TARJETA DEPURACIÓN -->
    <div class="tool-card glass">
      <div class="tool-header">
        <div class="tool-icon-wrap" style="background: linear-gradient(135deg, #f59e0b, #ef4444);">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </div>
        <div>
          <h2>Depurar Base de Datos</h2>
          <p>Elimina propiedades duplicadas o con datos incompletos vía n8n</p>
        </div>
      </div>

      <div class="tool-body">
        <div class="tool-info-row">
          <span class="info-label">Última ejecución</span>
          <span class="info-value" class:info-never={!lastSyncCL}>{formatSync(lastSyncCL)}</span>
        </div>

        <div class="warning-banner">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Esta acción puede modificar datos en n8n. Asegúrate de tener respaldo antes de ejecutar.
        </div>

        {#if statusCL === 'success'}
          <div class="tool-alert success">✅ Proceso de depuración iniciado en n8n.</div>
        {:else if statusCL === 'error'}
          <div class="tool-alert error">❌ {errorCL}</div>
        {/if}

        <button
          class="btn-tool btn-cl"
          on:click={triggerCleanup}
          disabled={statusCL === 'loading'}
        >
          {#if statusCL === 'loading'}
            <span class="btn-spinner" style="border-top-color: #f59e0b;"></span>
            Procesando...
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Iniciar Depuración en n8n
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Enlaces Rápidos a Captura -->
  <div class="actions-hint-row">
    <a href="/subir-propiedad" class="hint-card glass">
      <span class="hint-icon">📝</span>
      <div>
        <strong>Subir Propiedad Manual</strong>
        <p>Alta con selector de sinergia, teléfono obligatorio y redacción con IA.</p>
      </div>
    </a>

    <a href="/subir-link" class="hint-card glass">
      <span class="hint-icon">🔗</span>
      <div>
        <strong>Subir por Link (Scraper)</strong>
        <p>Importar automáticamente una ficha desde cualquier portal inmobiliario.</p>
      </div>
    </a>
  </div>
</div>

<style>
  .page-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
  }

  .header-badge-row {
    margin-bottom: 0.5rem;
  }

  .module-tag {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
  }

  .page-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }

  .page-header {
    margin-bottom: 0;
    flex: 1;
    min-width: 280px;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 0.4rem 0;
    background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .page-header p {
    color: #94a3b8;
    font-size: 0.95rem;
    margin: 0;
  }

  .glass {
    background: rgba(30, 30, 53, 0.65);
    border: 1px solid rgba(99, 102, 241, 0.2);
    backdrop-filter: blur(16px);
    border-radius: 1.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .tools-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 860px) {
    .tools-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .tool-card {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .tool-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .tool-header h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.2rem 0;
  }

  .tool-header p {
    color: #94a3b8;
    font-size: 0.82rem;
    margin: 0;
    line-height: 1.35;
  }

  .tool-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.85rem 1.15rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .tool-info-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
  }

  .info-label { color: #94a3b8; }
  .info-value { color: #f1f5f9; font-weight: 600; }
  .info-never { color: #64748b; font-weight: 400; }

  .progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .progress-label {
    font-size: 0.78rem;
    color: #818cf8;
  }

  .progress-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a78bfa);
    border-radius: 9999px;
    transition: width 0.3s ease;
  }

  .tool-alert {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .tool-alert.success {
    background: rgba(52, 211, 153, 0.12);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .tool-alert.error {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .warning-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    padding: 0.65rem 0.85rem;
    border-radius: 0.5rem;
    font-size: 0.78rem;
    color: #fbbf24;
    line-height: 1.35;
  }

  .collection-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  .collection-badge code {
    background: rgba(255, 255, 255, 0.08);
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    color: #cbd5e1;
  }

  .btn-tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.8rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    color: white;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  .btn-eb {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  }

  .btn-eb:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
  }

  .btn-cl {
    background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
  }

  .btn-cl:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
  }

  .btn-tool:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  @keyframes spin { to { transform: rotate(360deg); } }

  .actions-hint-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  @media (min-width: 768px) {
    .actions-hint-row {
      grid-template-columns: 1fr 1fr;
    }
  }

  .hint-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .hint-card:hover {
    transform: translateY(-2px);
    border-color: rgba(99, 102, 241, 0.45);
  }

  .hint-icon {
    font-size: 1.75rem;
  }

  .hint-card strong {
    font-size: 0.92rem;
    color: #f8fafc;
    display: block;
    margin-bottom: 0.15rem;
  }

  .hint-card p {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }
</style>
