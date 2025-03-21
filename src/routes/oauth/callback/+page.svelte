<!-- Página de callback para autenticación de Google -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { getTokens } from '$lib/services/googleService';
    import { goto } from '$app/navigation';
    import { notifications } from '$lib/stores/notificationStore';

    let isLoading = true;
    let error = '';
    let debugInfo = '';

    onMount(async () => {
        try {
            // Obtener el código de autorización de la URL
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const errorParam = urlParams.get('error');
            
            // Registrar para depuración
            console.log('URL de callback completa:', window.location.href);
            console.log('Código de autorización recibido:', code);
            console.log('Error recibido en parámetros:', errorParam);
            
            // Guardar información de depuración
            debugInfo = `URL: ${window.location.href}\nCódigo: ${code || 'No recibido'}\nError: ${errorParam || 'Ninguno'}`;

            if (errorParam) {
                error = `Error de Google: ${errorParam}`;
                isLoading = false;
                
                notifications.add({
                    type: 'error',
                    message: `Error de autenticación de Google: ${errorParam}`,
                    duration: 8000
                });
                return;
            }

            if (code) {
                // Obtener tokens con el código
                const tokens = await getTokens(code);
                
                // Asegurarse de que tengamos una fecha de expiración
                if (!tokens.expiry_date) {
                    tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
                }
                
                // Guardar tokens
                localStorage.setItem('googleTokens', JSON.stringify(tokens));
                
                // Mostrar notificación de éxito
                notifications.add({
                    type: 'success',
                    message: 'Conectado a Google Contacts correctamente',
                    duration: 5000
                });
                
                // Recuperar la página de redirección guardada o ir a contactos
                const redirectPath = localStorage.getItem('googleAuthRedirect') || '/contacts';
                localStorage.removeItem('googleAuthRedirect'); // Limpiar después de usar
                
                // Redirigir de vuelta a la página correspondiente
                goto(redirectPath);
            } else {
                error = 'No se recibió código de autorización';
                isLoading = false;
                
                // Mostrar notificación de error
                notifications.add({
                    type: 'error',
                    message: 'No se recibió código de autorización de Google',
                    duration: 8000
                });
            }
        } catch (err) {
            console.error('Error en la autenticación:', err);
            error = err instanceof Error ? err.message : 'Error al procesar la autenticación con Google';
            isLoading = false;
            
            // Mostrar notificación de error
            notifications.add({
                type: 'error',
                message: 'Error al procesar la autenticación con Google',
                duration: 8000
            });
        }
    });
</script>

<div class="container">
    {#if isLoading}
        <h2>Autenticando...</h2>
        <p>Por favor espera mientras procesamos tu inicio de sesión con Google.</p>
        <div class="loader"></div>
    {:else if error}
        <h2>Error de autenticación</h2>
        <p>{error}</p>
        
        {#if debugInfo}
        <details>
            <summary>Información de depuración</summary>
            <pre>{debugInfo}</pre>
        </details>
        {/if}
        
        <a href="/" class="btn">Volver al inicio</a>
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
