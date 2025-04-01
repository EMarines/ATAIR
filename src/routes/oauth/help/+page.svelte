<!-- <script lang="ts">
    import { goto } from '$app/navigation';
    import { getAuthUrl } from '$lib/services/googleService';
</script>

<div class="oauth-help-container">
    <div class="help-card">
        <h1>Ayuda para la conexión con Google</h1>
        
        <div class="warning-section">
            <h2>Advertencia de "App no verificada"</h2>
            <p>
                Durante el proceso de conexión con Google Contacts, es posible que veas una advertencia como esta:
            </p>
            <div class="warning-box">
                <h3>Google no verificó esta app</h3>
                <p>La app solicita acceso a información sensible de tu Cuenta de Google. Si el desarrollador aún no verificó esta app con Google, no deberías usarla.</p>
            </div>
            
            <h3>¿Por qué aparece este mensaje?</h3>
            <p>
                Este mensaje aparece porque ATAIR está en fase de desarrollo y aún no ha completado el proceso de verificación formal con Google.
                Esta verificación es un proceso que se realiza cuando la aplicación está lista para producción.
            </p>
            
            <h3>¿Es seguro continuar?</h3>
            <p>
                Sí, es seguro continuar si estás utilizando ATAIR en un entorno controlado. La aplicación solo accede a tus contactos
                para sincronizarlos entre Firebase y Google Contacts, tal como se describe en la funcionalidad de la aplicación.
            </p>
        </div>
        
        <div class="steps-section">
            <h2>Cómo proceder</h2>
            <ol>
                <li>
                    <strong>Paso 1:</strong> Cuando veas la advertencia, haz clic en <strong>"Configuración avanzada"</strong> en la parte inferior del mensaje.
                </li>
                <li>
                    <strong>Paso 2:</strong> Aparecerá un enlace que dice <strong>"Ir a ATAIR (no seguro)"</strong>. Haz clic en ese enlace.
                </li>
                <li>
                    <strong>Paso 3:</strong> Continúa con el proceso de autorización normal, seleccionando la cuenta de Google que deseas utilizar.
                </li>
                <li>
                    <strong>Paso 4:</strong> Revisa y acepta los permisos solicitados para acceder a tus contactos.
                </li>
            </ol>
        </div>
        
        <div class="buttons-section">
            <button class="primary-button" on:click={() => window.location.href = getAuthUrl()}>
                Intentar conectar nuevamente
            </button>
            <button class="secondary-button" on:click={() => goto('/')}>
                Volver al inicio
            </button>
        </div>
        
        <div class="note-section">
            <h3>Nota importante</h3>
            <p>
                Esta advertencia solo aparece durante el desarrollo. En una versión de producción, la aplicación pasaría por el proceso
                de verificación de Google para eliminar esta advertencia.
            </p>
        </div>
    </div>
</div>

<style>
    .oauth-help-container {
        max-width: 800px;
        margin: 2rem auto;
        padding: 0 1rem;
    }
    
    .help-card {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 2rem;
    }
    
    h1 {
        color: #4285F4;
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.8rem;
    }
    
    h2 {
        color: #333;
        font-size: 1.4rem;
        margin-top: 2rem;
        margin-bottom: 1rem;
    }
    
    h3 {
        color: #555;
        font-size: 1.2rem;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
    }
    
    .warning-box {
        background-color: #FEF7E5;
        border-left: 4px solid #FBBC04;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 4px;
    }
    
    .warning-box h3 {
        color: #EA4335;
        margin-top: 0;
    }
    
    .steps-section ol {
        padding-left: 1.5rem;
    }
    
    .steps-section li {
        margin-bottom: 1rem;
        line-height: 1.5;
    }
    
    .buttons-section {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
        flex-wrap: wrap;
    }
    
    button {
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s, transform 0.1s;
        border: none;
    }
    
    button:hover {
        transform: translateY(-1px);
    }
    
    button:active {
        transform: translateY(1px);
    }
    
    .primary-button {
        background-color: #4285F4;
        color: white;
    }
    
    .primary-button:hover {
        background-color: #3367D6;
    }
    
    .secondary-button {
        background-color: #F1F3F4;
        color: #202124;
    }
    
    .secondary-button:hover {
        background-color: #E8EAED;
    }
    
    .note-section {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #E8EAED;
    }
    
    @media (max-width: 600px) {
        .help-card {
            padding: 1.5rem;
        }
        
        .buttons-section {
            flex-direction: column;
        }
        
        button {
            width: 100%;
        }
    }
</style> -->
