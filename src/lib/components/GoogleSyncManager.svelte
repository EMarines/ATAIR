<!-- <script lang="ts">
    import { onMount } from 'svelte';
    import { notifications } from '$lib/stores/notificationStore';
    import { db } from '$lib/firebase';
    import { collection, doc, getDoc, setDoc, Timestamp, getDocs } from 'firebase/firestore';
    import { getAccessToken, getAuthUrl, isGoogleAuthenticated } from '$lib/services/googleService';
    import { syncAllContactsToGoogle, initSyncListeners } from '$lib/services/syncService';
    
    export let showStatus = true;
    export let small = false;
    export let iconOnly = false;
    
    let isLoading = false;
    let lastSyncTime: Date | null = null;
    let syncStatus: 'idle' | 'syncing' | 'success' | 'error' = 'idle';
    let contactsCount = { firebase: 0, google: 0 };
    let isAuthenticated = false;
    
    onMount(async () => {
        try {
            // Verificar si el usuario está autenticado con Google
            isAuthenticated = await isGoogleAuthenticated();
            
            // Solo inicializar listeners si el usuario está autenticado
            if (isAuthenticated) {
                // Inicializar listeners para sincronización automática
                initSyncListeners();
            }
            
            // Obtener información de la última sincronización
            const systemDocRef = doc(db, 'system', 'googleContactsSync');
            const systemDocSnap = await getDoc(systemDocRef);
            
            if (systemDocSnap.exists()) {
                const data = systemDocSnap.data();
                if (data.lastSyncTime) {
                    lastSyncTime = data.lastSyncTime.toDate();
                }
                if (data.contactsCount) {
                    contactsCount = data.contactsCount;
                }
            }
            
            // Contar contactos en Firebase
            const contactsCollectionRef = collection(db, 'contacts');
            const contactsSnapshot = await getDocs(contactsCollectionRef);
            contactsCount.firebase = contactsSnapshot.size;
            
            // Actualizar el documento de sistema con el conteo actual
            await setDoc(systemDocRef, {
                contactsCount
            }, { merge: true });
        } catch (error) {
            console.error('Error al obtener datos de sincronización:', error);
        }
    });
    
    async function syncToGoogle() {
        try {
            isLoading = true;
            syncStatus = 'syncing';
            
            // Verificar si tenemos un token de acceso válido
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error('No se pudo obtener un token de acceso válido para Google. Por favor, conéctate a Google Contacts primero.');
            }
            
            // Llamar a la función de sincronización de todos los contactos
            const result = await syncAllContactsToGoogle();
            
            if (result.success) {
                // Actualizar estado
                syncStatus = 'success';
                lastSyncTime = new Date();
                
                // Actualizar conteo de contactos
                contactsCount.firebase = result.total;
                contactsCount.google = result.successful;
            } else {
                syncStatus = 'error';
                throw new Error(result.error || 'Error desconocido durante la sincronización');
            }
        } catch (error) {
            console.error('Error al sincronizar contactos a Google:', error);
            syncStatus = 'error';
            notifications.add({
                type: 'error',
                message: `Error al sincronizar contactos a Google: ${error.message || error}`,
                duration: 5000
            });
        } finally {
            isLoading = false;
        }
    }
    
    function connectToGoogle() {
        notifications.add({
            type: 'info',
            message: 'Al conectar con Google, es posible que veas una advertencia de "App no verificada". Esto es normal durante el desarrollo. Haz clic en "Configuración avanzada" y luego en "Ir a ATAIR (no seguro)" para continuar.',
            duration: 10000
        });
        
        // Preguntar si el usuario quiere ver la página de ayuda primero
        if (confirm('¿Deseas ver instrucciones detalladas sobre cómo manejar la advertencia de "App no verificada" antes de continuar?')) {
            window.location.href = '/oauth/help';
        } else {
            const authUrl = getAuthUrl();
            window.location.href = authUrl;
        }
    }
</script>

<div class="google-sync-manager {small ? 'small' : ''} {iconOnly ? 'icon-only' : ''}">
    {#if showStatus}
        <div class="sync-status">
            <div class="status-icon">
                {#if syncStatus === 'syncing'}
                    <div class="spinner"></div>
                {:else if syncStatus === 'success'}
                    <div class="success-icon">✓</div>
                {:else if syncStatus === 'error'}
                    <div class="error-icon">✗</div>
                {:else}
                    <div class="idle-icon">⟳</div>
                {/if}
            </div>
            <div class="status-text">
                {#if isLoading}
                    <span>Sincronizando...</span>
                {:else if lastSyncTime}
                    <span>Última sincronización: {lastSyncTime.toLocaleString()}</span>
                    <span class="count-info">({contactsCount.firebase} contactos en Firebase, {contactsCount.google} en Google)</span>
                {:else}
                    <span>No sincronizado</span>
                {/if}
            </div>
        </div>
    {/if}
    
    <div class="sync-buttons">
        {#if isAuthenticated}
            <button 
                class="sync-button to-google" 
                on:click={syncToGoogle} 
                disabled={isLoading}
                title="Sincronizar contactos a Google"
            >
                {#if !iconOnly}
                    <span>Sincronizar a Google</span>
                {/if}
                <span class="icon">→</span>
            </button>
        {:else}
            <button 
                class="sync-button connect-google" 
                on:click={connectToGoogle}
                title="Conectar con Google Contacts"
            >
                {#if !iconOnly}
                    <span>Conectar con Google</span>
                {/if}
                <span class="icon">🔗</span>
            </button>
        {/if}
    </div>
</div>

<style>
    .google-sync-manager {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 0.25rem;
        background-color: #f9f9f9;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .google-sync-manager.small {
        padding: 0.25rem;
        font-size: 0.85rem;
    }
    
    .google-sync-manager.icon-only .sync-buttons {
        flex-direction: row;
    }
    
    .sync-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .status-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
    }
    
    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-top: 2px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .success-icon {
        color: #2ecc71;
    }
    
    .error-icon {
        color: #e74c3c;
    }
    
    .idle-icon {
        color: #7f8c8d;
    }
    
    .status-text {
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
    }
    
    .count-info {
        font-size: 0.75rem;
        color: #666;
    }
    
    .sync-buttons {
        display: flex;
        gap: 0.5rem;
    }
    
    .sync-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        padding: 0.5rem 0.75rem;
        border: none;
        border-radius: 0.25rem;
        background-color: #3498db;
        color: white;
        cursor: pointer;
        transition: background-color 0.2s;
        width: 100%;
    }
    
    .sync-button:hover {
        background-color: #2980b9;
    }
    
    .sync-button:disabled {
        background-color: #bdc3c7;
        cursor: not-allowed;
    }
    
    .sync-button.to-google {
        background-color: #4285F4;
    }
    
    .sync-button.to-google:hover {
        background-color: #3367D6;
    }
    
    .sync-button.connect-google {
        background-color: #34A853;
    }
    
    .sync-button.connect-google:hover {
        background-color: #2E7D32;
    }
    
    .icon {
        font-weight: bold;
    }
</style> -->
