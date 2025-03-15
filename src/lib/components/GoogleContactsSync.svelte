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
        
        // Verificar que el contacto tenga un ID válido
        if (!contact || !contact.id || contact.id.trim() === '') {
            console.error('GoogleContactsSync: Contacto sin ID válido', contact);
            return; // No continuar si el contacto no tiene ID válido
        }
        
        estaConectado = tieneTokenValido();
        
        // Cargar el mapa de contactos de Google
        const storedMap = localStorage.getItem('googleContactsMap');
        if (storedMap) {
            try {
                googleContactsMap = JSON.parse(storedMap);
                
                // Verificar si el contacto actual está sincronizado
                if (contact && contact.id) {
                    googleResourceName = googleContactsMap[contact.id] || '';
                }
            } catch (e) {
                console.error('Error al parsear el mapa de contactos de Google:', e);
                // Reiniciar el mapa si hay un error
                googleContactsMap = {};
                localStorage.setItem('googleContactsMap', JSON.stringify({}));
            }
        }
        
        // Escuchar cambios en localStorage
        window.addEventListener('storage', () => {
            estaConectado = tieneTokenValido();
            
            // Verificar que el contacto tenga un ID válido
            if (!contact || !contact.id || contact.id.trim() === '') {
                return; // No continuar si el contacto no tiene ID válido
            }
            
            const updatedMap = localStorage.getItem('googleContactsMap');
            if (updatedMap) {
                try {
                    googleContactsMap = JSON.parse(updatedMap);
                    
                    if (contact && contact.id) {
                        googleResourceName = googleContactsMap[contact.id] || '';
                    }
                } catch (e) {
                    console.error('Error al parsear el mapa actualizado de contactos de Google:', e);
                }
            }
        });
    });

    // Iniciar autenticación con Google
    function iniciarSincronizacion() {
        if (isLoading) return;
        
        // Verificar que el contacto tenga un ID válido
        if (contact && (!contact.id || contact.id.trim() === '')) {
            console.error('No se puede sincronizar: Contacto sin ID válido', contact);
            error = 'No se puede sincronizar: ID de contacto no válido';
            return;
        }
        
        isLoading = true;
        error = '';
        
        try {
            // Redirigir a la página de autenticación de Google
            const authUrl = getAuthUrl();
            window.location.href = authUrl;
        } catch (err) {
            console.error('Error al iniciar sincronización:', err);
            error = err instanceof Error ? err.message : String(err);
            isLoading = false;
        }
    }

    // Desconectar de Google
    function desconectar() {
        if (confirm('¿Estás seguro de que deseas desconectar de Google Contacts?')) {
            localStorage.removeItem('googleTokens');
            localStorage.removeItem('googleContactsMap');
            estaConectado = false;
            googleResourceName = '';
            googleContactsMap = {};
            window.location.reload();
        }
    }

    // Eliminar contacto de Google
    async function eliminarContactoGoogle() {
        // Verificar que el contacto tenga un ID válido
        if (isLoading || !contact || !contact.id || contact.id.trim() === '') {
            console.error('No se puede eliminar de Google: Contacto sin ID válido', contact);
            error = 'No se puede eliminar: ID de contacto no válido';
            return;
        }
        
        if (!googleResourceName) {
            console.error('No se puede eliminar: Contacto no sincronizado con Google', contact);
            error = 'Este contacto no está sincronizado con Google Contacts';
            return;
        }
        
        isLoading = true;
        error = '';
        
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error('No hay un token de acceso válido');
            }
            
            await deleteGoogleContact(googleResourceName, accessToken);
            
            // Actualizar el mapa de contactos
            const updatedMap = { ...googleContactsMap };
            delete updatedMap[contact.id];
            localStorage.setItem('googleContactsMap', JSON.stringify(updatedMap));
            googleContactsMap = updatedMap;
            googleResourceName = '';
            
            console.log('Contacto eliminado de Google Contacts');
            isLoading = false;
        } catch (err) {
            console.error('Error al eliminar contacto de Google:', err);
            error = err instanceof Error ? err.message : String(err);
            isLoading = false;
        }
    }
</script>

<!-- Componente invisible que solo maneja la sincronización en segundo plano -->
<div style="display: none;"></div>
