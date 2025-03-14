<!-- Página de callback para autenticación de Google -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { getTokens } from '$lib/services/googleService';
    import { goto } from '$app/navigation';

    let isLoading = true;
    let error = '';

    onMount(async () => {
        try {
            // Obtener el código de autorización de la URL
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');

            if (code) {
                // Obtener tokens con el código
                const tokens = await getTokens(code);
                
                // Asegurarse de que tengamos una fecha de expiración
                if (!tokens.expiry_date) {
                    tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
                }
                
                // Guardar tokens
                localStorage.setItem('googleTokens', JSON.stringify(tokens));
                
                // Recuperar la página de redirección guardada o ir a contactos
                const redirectPath = localStorage.getItem('googleAuthRedirect') || '/contacts';
                localStorage.removeItem('googleAuthRedirect'); // Limpiar después de usar
                
                // Redirigir de vuelta a la página correspondiente
                goto(redirectPath);
            } else {
                error = 'No se recibió código de autorización';
                isLoading = false;
            }
        } catch (err) {
            console.error('Error en la autenticación:', err);
            error = 'Error al procesar la autenticación con Google';
            isLoading = false;
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
        <p class="error">{error}</p>
        <button on:click={() => goto('/contacts')}>Volver a contactos</button>
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        text-align: center;
        padding: 0 2rem;
    }
    
    .error {
        color: #d32f2f;
        background-color: #ffebee;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #ffcdd2;
        margin: 1rem 0;
    }
    
    button {
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        margin-top: 1rem;
    }
    
    button:hover {
        background-color: #3367d6;
    }
    
    .loader {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #4285f4;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 1rem 0;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
