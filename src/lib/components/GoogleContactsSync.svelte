<!-- Componente para sincronización con Google Contacts -->
<script lang="ts">
    import { getAuthUrl, getContacts, syncContact, tieneTokenValido, deleteGoogleContact, updateGoogleContact, getAccessToken } from '$lib/services/googleService';
    import { contactsStore } from '$lib/stores/dataStore';
    import type { Contact } from '$lib/types';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { firebase } from '$lib/stores/firebaseStores';

    export let contact: Contact | null = null;

    let isLoading = false;
    let error = '';
    let progress = { current: 0, total: 0 };
    let estaConectado = false;
    let googleResourceName = ''; // ID del contacto en Google
    let googleContactsMap = {};
    let isBrowser = false;

    onMount(() => {
        // En onMount ya estamos en el navegador
        isBrowser = true;
        estaConectado = tieneTokenValido();
        
        // Cargar el mapa de contactos de Google
        const storedMap = localStorage.getItem('googleContactsMap');
        if (storedMap) {
            googleContactsMap = JSON.parse(storedMap);
            
            // Verificar si el contacto actual está sincronizado
            if (contact && contact.id) {
                googleResourceName = googleContactsMap[contact.id] || '';
            }
        }
        
        // Escuchar cambios en localStorage
        window.addEventListener('storage', () => {
            estaConectado = tieneTokenValido();
            
            const updatedMap = localStorage.getItem('googleContactsMap');
            if (updatedMap) {
                googleContactsMap = JSON.parse(updatedMap);
                
                if (contact && contact.id) {
                    googleResourceName = googleContactsMap[contact.id] || '';
                }
            }
        });
    });

    // Iniciar autenticación con Google
    async function iniciarSincronizacion() {
        if (!isBrowser) return;
        
        try {
            const authUrl = getAuthUrl();
            window.location.href = authUrl;
        } catch (err: any) {
            console.error('Error al iniciar sincronización:', err);
            error = 'Error al conectar con Google Contacts';
        }
    }

    // Desconectar de Google
    function desconectar() {
        if (!isBrowser) return;
        
        if (confirm('¿Estás seguro de que deseas desconectarte de Google Contacts?')) {
            localStorage.removeItem('googleTokens');
            estaConectado = false;
        }
    }

    // Eliminar contacto de Google
    async function eliminarContactoGoogle() {
        if (!isBrowser || !contact || !contact.id) return;
        
        // Obtener el resourceName del contacto en Google
        const resourceName = googleContactsMap[contact.id];
        
        if (!resourceName) {
            error = 'Este contacto no está sincronizado con Google Contacts';
            return;
        }
        
        isLoading = true;
        error = '';
        
        try {
            // Obtener el token de acceso
            const accessToken = getAccessToken();
            if (!accessToken) {
                iniciarSincronizacion();
                return;
            }
            
            await deleteGoogleContact(resourceName, accessToken);
            
            // Eliminar la asociación
            delete googleContactsMap[contact.id];
            localStorage.setItem('googleContactsMap', JSON.stringify(googleContactsMap));
            googleResourceName = '';
            
            // Eliminar automáticamente de Firebase sin preguntar
            try {
                const result = await firebase.delete("contacts", contact.id);
                if (result?.success) {
                    alert('Contacto eliminado exitosamente de Google Contacts y de la base de datos local');
                    // Redirigir a la lista de contactos
                    goto("/contacts");
                } else {
                    console.error("Error al eliminar el contacto de Firebase:", result?.error);
                    alert("Error al eliminar el contacto de la base de datos local: " + (result?.error || "Error desconocido"));
                }
            } catch (error) {
                console.error("Error al eliminar el contacto de Firebase:", error);
                alert("Error al eliminar el contacto de la base de datos local: " + error);
            }
        } catch (err: any) {
            console.error('Error al eliminar contacto de Google:', err);
            error = 'Error al eliminar el contacto de Google';
            
            if (err.message?.includes('auth') || err.message?.includes('token')) {
                localStorage.removeItem('googleTokens');
                estaConectado = false;
                iniciarSincronizacion();
            }
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="google-sync">
    {#if error}
        <p class="error">{error}</p>
    {/if}

    {#if isLoading && progress.total > 0}
        <p class="progress">Sincronizando contactos: {progress.current} de {progress.total}</p>
    {/if}

    {#if isBrowser}
        {#if contact && contact.id}
            <!-- Botones específicos para el contacto -->
            <div class="google-actions">
                {#if !estaConectado}
                    <button 
                        class="sync-button"
                        on:click={iniciarSincronizacion}
                        disabled={isLoading}
                    >
                        Conectar con Google Contacts
                    </button>
                {/if}
            </div>
        {:else}
            <!-- Botones para sincronización general -->
            <div class="buttons-container">
                {#if !estaConectado}
                    <button 
                        class="sync-button"
                        on:click={iniciarSincronizacion}
                        disabled={isLoading}
                    >
                        Conectar con Google Contacts
                    </button>
                {:else}
                    <div class="status-container">
                        <button 
                            class="disconnect-button"
                            on:click={desconectar}
                            title="Desconectar de Google Contacts"
                            aria-label="Desconectar de Google Contacts"
                        >
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
    {:else}
        <div class="ssr-placeholder">
            Cargando...
        </div>
    {/if}
</div>

<style>
    .google-sync {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
    }

    .buttons-container, .contact-buttons, .google-actions {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
    }

    .google-actions {
        width: 100%;
    }

    .status-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background-color: #e8f5e9;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #c8e6c9;
    }

    .disconnect-button {
        background: none;
        border: none;
        color: #d32f2f;
        cursor: pointer;
        padding: 0.25rem;
        font-size: 0.9rem;
        transition: color 0.2s;
    }

    .disconnect-button:hover {
        color: #b71c1c;
    }

    .sync-button {
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;
    }

    .sync-button:hover {
        background-color: #3367d6;
    }

    .sync-button:disabled {
        background-color: #a5c2f7;
        cursor: not-allowed;
    }

    .sync-button.delete {
        background-color: #ea4335;
    }

    .sync-button.delete:hover {
        background-color: #d32f2f;
    }

    .error {
        color: #d32f2f;
        background-color: #ffebee;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #ffcdd2;
        font-size: 0.9rem;
        width: 100%;
        text-align: center;
    }

    .progress {
        color: #1976d2;
        background-color: #e3f2fd;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #bbdefb;
        font-size: 0.9rem;
        width: 100%;
        text-align: center;
    }
    
    .ssr-placeholder {
        color: #757575;
        font-size: 0.9rem;
        padding: 1rem;
        text-align: center;
        border: 1px dashed #bdbdbd;
        border-radius: 4px;
        width: 100%;
    }
</style>
