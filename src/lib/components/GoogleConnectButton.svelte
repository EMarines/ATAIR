<!-- <script lang="ts">
    import { getAuthUrl, tieneTokenValido } from '$lib/services/googleService';
    import { onMount } from 'svelte';
    import { notifications } from '$lib/stores/notificationStore';

    export let buttonText = 'Conectar con Google Contacts';
    export let showStatus = true;
    export let small = false;
    export let iconOnly = false;

    let isConnected = false;
    let isLoading = false;

    onMount(() => {
        checkConnectionStatus();
        
        // Escuchar cambios en localStorage
        window.addEventListener('storage', checkConnectionStatus);
        
        return () => {
            window.removeEventListener('storage', checkConnectionStatus);
        };
    });

    function checkConnectionStatus() {
        isConnected = tieneTokenValido();
    }

    function connectToGoogle() {
        if (isLoading) return;
        
        isLoading = true;
        
        try {
            const authUrl = getAuthUrl();
            window.location.href = authUrl;
        } catch (err) {
            console.error('Error al iniciar conexión con Google:', err);
            notifications.error(`Error al conectar con Google: ${err instanceof Error ? err.message : String(err)}`);
            isLoading = false;
        }
    }

    function disconnectFromGoogle() {
        if (confirm('¿Estás seguro de que deseas desconectar de Google Contacts?')) {
            localStorage.removeItem('googleTokens');
            localStorage.removeItem('googleContactsMap');
            isConnected = false;
            notifications.info('Desconectado de Google Contacts');
        }
    }
</script>

{#if !isConnected}
    <button 
        class="google-connect-button {small ? 'small' : ''} {iconOnly ? 'icon-only' : ''}"
        on:click={connectToGoogle}
        disabled={isLoading}
    >
        <span class="google-icon">
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
        </span>
        {#if !iconOnly}
            <span class="button-text">{buttonText}</span>
        {/if}
    </button>
{:else if showStatus}
    <div class="status-container">
        <div class="status connected">
            <span class="status-icon">✓</span>
            <span class="status-text">Conectado a Google Contacts</span>
        </div>
        <button class="disconnect-button" on:click={disconnectFromGoogle}>
            Desconectar
        </button>
    </div>
{/if}

<style>
    .google-connect-button {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: white;
        color: #757575;
        border: 1px solid #dadce0;
        border-radius: 4px;
        padding: 10px 16px;
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.3s, box-shadow 0.3s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    .google-connect-button:hover {
        background-color: #f8f9fa;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .google-connect-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .google-connect-button.small {
        padding: 6px 12px;
        font-size: 12px;
    }

    .google-connect-button.icon-only {
        padding: 8px;
        border-radius: 50%;
    }

    .google-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 8px;
    }

    .icon-only .google-icon {
        margin-right: 0;
    }

    .status-container {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .status {
        display: flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 13px;
    }

    .status.connected {
        background-color: #e6f4ea;
        color: #137333;
    }

    .status-icon {
        margin-right: 6px;
        font-weight: bold;
    }

    .disconnect-button {
        background-color: transparent;
        color: #d93025;
        border: 1px solid #d93025;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .disconnect-button:hover {
        background-color: rgba(217, 48, 37, 0.04);
    }
</style> -->
