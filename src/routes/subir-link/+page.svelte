<script lang="ts">
  import PropertyNavActions from '$lib/components/PropertyNavActions.svelte';

  const N8N_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_LINK ?? '';

  let url = '';
  let status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  let errorMsg = '';
  let lastUrl = '';

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!url.trim()) return;

    status = 'sending';
    errorMsg = '';
    lastUrl = url.trim();

    try {
      if (!N8N_WEBHOOK) {
        throw new Error('El webhook de n8n no está configurado. Agrega la URL en VITE_N8N_WEBHOOK_LINK en el archivo .env');
      }

      const res = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);

      status = 'success';
      url = '';
      setTimeout(() => { status = 'idle'; }, 8000);
    } catch (err: any) {
      errorMsg = err.message || 'Error al conectar con el webhook de n8n';
      status = 'error';
    }
  }

  function reset() {
    status = 'idle';
    url = '';
    errorMsg = '';
    lastUrl = '';
  }
</script>

<svelte:head>
  <title>Subir por Link – ATAIR SGI</title>
  <meta name="description" content="Importa una propiedad desde un enlace externo usando automatización con n8n." />
</svelte:head>

<div class="page-container">
  <div class="page-header-row">
    <div class="page-header">
      <div class="header-badge-row">
        <span class="module-tag">Automatización & Scraping</span>
      </div>
      <h1>Subir por Link</h1>
      <p>Pega el enlace de una propiedad de cualquier portal y el flujo de automatización en n8n la extraerá automáticamente.</p>
    </div>

    <PropertyNavActions current="subir-link" />
  </div>

  <div class="link-grid">
    <!-- Card Principal -->
    <div class="link-card glass">
      {#if status === 'success'}
        <!-- Estado Exitoso -->
        <div class="result-state success-state">
          <div class="result-icon">✅</div>
          <h2>¡Enviado correctamente!</h2>
          <p>El enlace fue enviado al webhook de n8n para su procesamiento y extracción.</p>
          <div class="sent-url">
            <span class="sent-label">Enlace enviado:</span>
            <a href={lastUrl} target="_blank" rel="noopener noreferrer" class="sent-link">{lastUrl}</a>
          </div>
          <p class="hint-text">El proceso de extracción toma unos instantes. La propiedad se registrará automáticamente en el catálogo.</p>
          <div class="success-actions">
            <a href="/properties" class="btn-secondary">
              📊 Ver en Propiedades
            </a>
            <button class="btn-primary" on:click={reset}>
              ➕ Importar otro enlace
            </button>
          </div>
        </div>
      {:else if status === 'error'}
        <!-- Estado Error -->
        <div class="result-state error-state">
          <div class="result-icon">❌</div>
          <h2>Error al enviar</h2>
          <p class="error-detail">{errorMsg}</p>
          <button class="btn-primary" on:click={reset}>
            Intentar de nuevo
          </button>
        </div>
      {:else}
        <!-- Formulario Inicial -->
        <div class="link-form-wrapper">
          <div class="link-icon-header">
            <div class="link-icon-circle">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            </div>
            <div>
              <h2>Importar desde enlace</h2>
              <p>El enlace será procesado por el robot extractor de n8n</p>
            </div>
          </div>

          <form on:submit={handleSubmit} class="link-form">
            <div class="url-input-wrapper">
              <span class="url-icon">🔗</span>
              <input
                type="url"
                id="property-url"
                bind:value={url}
                placeholder="https://www.inmuebles24.com/propiedad/..."
                required
                disabled={status === 'sending'}
                class="url-input"
              />
            </div>

            <button
              type="submit"
              class="btn-primary btn-import"
              disabled={status === 'sending' || !url.trim()}
            >
              {#if status === 'sending'}
                <span class="btn-spinner"></span>
                Enviando a n8n...
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Importar Propiedad
              {/if}
            </button>
          </form>
        </div>
      {/if}
    </div>

    <!-- Panel de Información Lateral -->
    <div class="info-panel">
      <div class="info-card glass">
        <h3>¿Cómo funciona?</h3>
        <ol class="steps-list">
          <li>
            <span class="step-num">1</span>
            <div>
              <strong>Pega el enlace</strong>
              <p>Copia la URL de la propiedad desde cualquier portal inmobiliario.</p>
            </div>
          </li>
          <li>
            <span class="step-num">2</span>
            <div>
              <strong>n8n procesa</strong>
              <p>El flujo extrae fotos, precio, recámaras, m² y ubicación de forma automática.</p>
            </div>
          </li>
          <li>
            <span class="step-num">3</span>
            <div>
              <strong>Guardado en Firebase</strong>
              <p>La propiedad se guarda en Firestore y aparece de inmediato en el catálogo de ATAIR.</p>
            </div>
          </li>
        </ol>
      </div>

      <div class="info-card glass portals-card">
        <h3>Portales compatibles</h3>
        <div class="portals-list">
          <span class="portal-tag">Inmuebles24</span>
          <span class="portal-tag">Lamudi</span>
          <span class="portal-tag">Propiedades.com</span>
          <span class="portal-tag">MercadoLibre</span>
          <span class="portal-tag">Vivanuncios</span>
          <span class="portal-tag">EasyBroker</span>
        </div>
        <p class="portals-note">La compatibilidad depende del scraper configurado en tu instancia de n8n.</p>
      </div>
    </div>
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

  .link-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  @media (min-width: 860px) {
    .link-grid {
      grid-template-columns: 1fr 340px;
    }
  }

  .glass {
    background: rgba(30, 30, 53, 0.65);
    border: 1px solid rgba(99, 102, 241, 0.2);
    backdrop-filter: blur(16px);
    border-radius: 1.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .link-card {
    padding: 2.25rem;
  }

  .link-icon-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .link-icon-circle {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  }

  .link-icon-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.2rem 0;
  }

  .link-icon-header p {
    color: #94a3b8;
    font-size: 0.85rem;
    margin: 0;
  }

  .link-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .url-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .url-icon {
    position: absolute;
    left: 1rem;
    font-size: 1rem;
    pointer-events: none;
    z-index: 1;
  }

  .url-input {
    width: 100%;
    padding: 0.85rem 1rem 0.85rem 2.85rem !important;
    font-size: 0.95rem;
    background-color: #1e1e35;
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 0.5rem;
    color: #f1f5f9;
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .url-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 0.85rem 1.75rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    text-decoration: none;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.07);
    color: #f1f5f9;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(99, 102, 241, 0.3);
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
  }

  .btn-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .result-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    padding: 1rem 0;
  }

  .result-icon { font-size: 3rem; line-height: 1; }
  .success-state h2 { color: #34d399; margin: 0; }
  .success-state p { color: #94a3b8; font-size: 0.95rem; margin: 0; }
  .error-state h2 { color: #f87171; margin: 0; }
  .error-detail { color: #f87171; font-size: 0.9rem; }

  .sent-url {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: rgba(52,211,153,0.08);
    border: 1px solid rgba(52,211,153,0.25);
    border-radius: 0.5rem;
    padding: 0.85rem 1.25rem;
    width: 100%;
    text-align: left;
    box-sizing: border-box;
  }

  .sent-label {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
  }

  .sent-link {
    font-size: 0.85rem;
    color: #34d399;
    word-break: break-all;
    text-decoration: none;
  }

  .hint-text {
    font-size: 0.85rem;
    color: #64748b;
  }

  .success-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 0.5rem;
  }

  /* Info Panel */
  .info-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .info-card {
    padding: 1.5rem;
    border-radius: 1.25rem;
  }

  .info-card h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: #cbd5e1;
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .steps-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .steps-list li {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.25);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .steps-list strong {
    font-size: 0.88rem;
    color: #f1f5f9;
    display: block;
    margin-bottom: 0.15rem;
  }

  .steps-list p {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }

  .portals-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }

  .portal-tag {
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.2rem 0.55rem;
    border-radius: 0.35rem;
    color: #cbd5e1;
  }

  .portals-note {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
  }
</style>
