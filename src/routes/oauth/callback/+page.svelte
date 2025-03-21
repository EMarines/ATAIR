<!-- Página de callback para autenticación de Google -->
<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { getTokens, hasRequiredScopes } from '$lib/services/googleService';
    import { notifications } from '$lib/stores/notificationStore';
    import { GOOGLE_CONFIG } from '$lib/config/google';
    
    let loading = true;
    let error = null;
    let debugInfo = {
        code: null,
        error: null,
        errorDescription: null,
        state: null,
        redirectUri: GOOGLE_CONFIG.redirectUri,
        clientId: GOOGLE_CONFIG.clientId ? GOOGLE_CONFIG.clientId.substring(0, 8) + '...' : 'No disponible'
    };
    
    onMount(async () => {
        try {
            // Obtener parámetros de la URL
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const errorParam = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');
            const state = urlParams.get('state');
            
            // Guardar información de depuración
            debugInfo.code = code ? 'Presente (valor oculto)' : 'No presente';
            debugInfo.error = errorParam;
            debugInfo.errorDescription = errorDescription;
            debugInfo.state = state;
            
            // Si hay un error en la respuesta de Google
            if (errorParam) {
                error = `Error de Google: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`;
                loading = false;
                return;
            }
            
            // Si no hay código de autorización
            if (!code) {
                error = 'No se recibió código de autorización. Por favor, intenta nuevamente.';
                loading = false;
                return;
            }
            
            console.log('Código de autorización recibido, obteniendo tokens...');
            
            // Obtener tokens con el código
            const tokens = await getTokens(code);
            
            // Verificar si se obtuvieron todos los permisos necesarios
            if (!hasRequiredScopes(tokens)) {
                notifications.add({
                    type: 'warning',
                    message: 'No se concedieron todos los permisos necesarios. Algunas funciones de sincronización podrían no estar disponibles.',
                    duration: 8000
                });
            } else {
                // Notificar éxito
                notifications.add({
                    type: 'success',
                    message: 'Conexión con Google Contacts establecida correctamente',
                    duration: 5000
                });
            }
            
            // Redirigir a la página principal
            goto('/');
            
        } catch (err) {
            console.error('Error en el proceso de autenticación:', err);
            error = err.message || 'Error desconocido durante la autenticación';
            loading = false;
        }
    });
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Autenticación con Google</h1>
    
    {#if loading}
        <div class="bg-blue-100 p-4 rounded mb-4">
            <p class="text-blue-800">Procesando autenticación con Google...</p>
            <div class="mt-2 w-full bg-blue-200 rounded-full h-2.5">
                <div class="bg-blue-600 h-2.5 rounded-full animate-pulse w-full"></div>
            </div>
        </div>
    {:else if error}
        <div class="bg-red-100 p-4 rounded mb-4">
            <h2 class="text-xl font-semibold text-red-800 mb-2">Error de autenticación</h2>
            <p class="text-red-700">{error}</p>
            
            <div class="mt-4">
                <a href="/" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Volver al inicio
                </a>
                <button 
                    class="ml-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    on:click={() => window.location.href = GOOGLE_CONFIG.authUrl}
                >
                    Reintentar autenticación
                </button>
            </div>
        </div>
        
        <div class="mt-6 bg-gray-100 p-4 rounded">
            <h3 class="text-lg font-semibold mb-2">Información de depuración</h3>
            <pre class="bg-gray-200 p-2 rounded text-sm overflow-x-auto">
{JSON.stringify(debugInfo, null, 2)}
            </pre>
            
            <div class="mt-4">
                <h4 class="font-semibold">Posibles soluciones:</h4>
                <ul class="list-disc pl-5 mt-2">
                    <li>Verifica que las credenciales de Google estén correctamente configuradas</li>
                    <li>Asegúrate de que la URI de redirección ({debugInfo.redirectUri}) esté autorizada en la consola de Google Cloud</li>
                    <li>Limpia los tokens almacenados y vuelve a intentar</li>
                    <li>Verifica que la cuenta de Google tenga permisos para acceder a la API de Contacts</li>
                </ul>
            </div>
            
            <div class="mt-4">
                <a 
                    href="/static/clear-tokens.html" 
                    target="_blank"
                    class="text-blue-600 hover:text-blue-800 underline"
                >
                    Limpiar tokens almacenados
                </a>
            </div>
        </div>
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        padding: 2rem;
        text-align: center;
    }
    
    .loader {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .btn {
        display: inline-block;
        background-color: #3498db;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        text-decoration: none;
        margin-top: 1rem;
    }
    
    .btn:hover {
        background-color: #2980b9;
    }
    
    details {
        margin: 1rem 0;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        max-width: 100%;
        text-align: left;
    }
    
    summary {
        cursor: pointer;
        font-weight: bold;
    }
    
    pre {
        white-space: pre-wrap;
        word-break: break-all;
        background-color: #f5f5f5;
        padding: 0.5rem;
        border-radius: 4px;
        max-width: 100%;
        overflow-x: auto;
    }
</style>
