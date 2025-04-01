<!-- Página de callback para autenticación de Google
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
            const stateParam = urlParams.get('state');
            
            // Parsear el estado si existe
            let parsedState = null;
            let returnPath = '/';
            
            if (stateParam) {
                try {
                    parsedState = JSON.parse(stateParam);
                    if (parsedState && parsedState.returnTo) {
                        returnPath = parsedState.returnTo;
                    }
                } catch (e) {
                    console.warn('Error al parsear el estado:', e);
                }
            }
            
            // Guardar información de depuración
            debugInfo.code = code ? 'Presente (valor oculto)' : 'No presente';
            debugInfo.error = errorParam;
            debugInfo.errorDescription = errorDescription;
            debugInfo.state = stateParam;
            
            // Si hay un error en la respuesta de Google
            if (errorParam) {
                if (errorParam === 'access_denied') {
                    error = 'Has cancelado el acceso a Google Contacts. No se ha establecido la conexión.';
                } else {
                    error = `Error de Google: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`;
                }
                
                // Si el error es relacionado con la verificación de la app
                if (errorParam === 'admin_policy_enforced' || errorDescription?.includes('unverified')) {
                    notifications.add({
                        type: 'info',
                        message: 'Puedes ver instrucciones sobre cómo manejar la advertencia de "App no verificada" en la página de ayuda.',
                        duration: 8000
                    });
                    
                    // Añadir botón para ir a la página de ayuda
                    setTimeout(() => {
                        const helpButton = document.createElement('a');
                        helpButton.href = '/oauth/help';
                        helpButton.className = 'ml-2 bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded';
                        helpButton.textContent = 'Ver instrucciones de ayuda';
                        document.querySelector('.error-actions')?.appendChild(helpButton);
                    }, 100);
                }
                
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
            
            // Redirigir a la página de retorno o a la principal
            goto(returnPath);
            
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
            
            <div class="mt-4 error-actions">
                <a href="/" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Volver al inicio
                </a>
                <button 
                    class="ml-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    on:click={() => window.location.href = '/'}
                >
                    Intentar nuevamente
                </button>
            </div>
            
            <div class="mt-6">
                <details>
                    <summary class="cursor-pointer text-blue-600 hover:text-blue-800">Información de depuración</summary>
                    <pre class="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto">
{JSON.stringify(debugInfo, null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    {/if}
</div> -->
