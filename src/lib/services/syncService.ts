import { db } from '$lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAccessToken, syncContact, eliminarContacto, getContacts } from './googleService';
import { notifications } from '$lib/stores/notificationStore';
import type { Contact } from '$lib/types';

// Configuración para la sincronización automática
const AUTO_SYNC_ENABLED = true;
const SYNC_DEBOUNCE_TIME = 2000; // ms para esperar antes de sincronizar después de un cambio

// Variables para el debounce
let syncTimeout: NodeJS.Timeout | null = null;
let pendingChanges: {
    added: Contact[];
    updated: Contact[];
    deleted: string[];
} = {
    added: [],
    updated: [],
    deleted: []
};

/**
 * Inicializa los listeners para sincronización automática
 */
export function initSyncListeners() {
    if (!AUTO_SYNC_ENABLED) return;
    
    // Escuchar cambios en la colección de contactos
    const contactsRef = collection(db, 'contacts');
    
    // Obtener el estado actual de los contactos para comparar
    let currentContacts: Record<string, Contact> = {};
    
    onSnapshot(contactsRef, (snapshot) => {
        // Procesar cambios
        snapshot.docChanges().forEach((change) => {
            const contactData = change.doc.data() as Contact;
            
            if (change.type === 'added' && !currentContacts[change.doc.id]) {
                // Nuevo contacto
                pendingChanges.added.push(contactData);
            } else if (change.type === 'modified') {
                // Contacto actualizado
                pendingChanges.updated.push(contactData);
            } else if (change.type === 'removed') {
                // Contacto eliminado
                pendingChanges.deleted.push(change.doc.id);
            }
            
            // Actualizar el estado actual
            if (change.type === 'added' || change.type === 'modified') {
                currentContacts[change.doc.id] = contactData;
            } else if (change.type === 'removed') {
                delete currentContacts[change.doc.id];
            }
        });
        
        // Debounce para evitar múltiples sincronizaciones
        if (syncTimeout) {
            clearTimeout(syncTimeout);
        }
        
        syncTimeout = setTimeout(() => {
            processPendingChanges();
        }, SYNC_DEBOUNCE_TIME);
    });
}

/**
 * Procesa los cambios pendientes para sincronización
 */
async function processPendingChanges() {
    if (!pendingChanges.added.length && !pendingChanges.updated.length && !pendingChanges.deleted.length) {
        return;
    }
    
    console.log('Procesando cambios pendientes:', pendingChanges);
    
    try {
        // Obtener token de acceso
        const accessToken = await getAccessToken();
        if (!accessToken) {
            console.error('No se pudo obtener un token de acceso válido para Google');
            // No mostramos notificación aquí para evitar spam, ya que getAccessToken ya muestra una notificación
            // Guardamos los cambios pendientes para procesarlos cuando el usuario se autentique
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        // Procesar adiciones
        for (const contact of pendingChanges.added) {
            try {
                await syncContact(contact, accessToken);
                console.log(`Contacto añadido a Google: ${contact.name} ${contact.lastname}`);
                successCount++;
            } catch (error) {
                console.error(`Error al añadir contacto a Google: ${contact.id}`, error);
                errorCount++;
            }
        }
        
        // Procesar actualizaciones
        for (const contact of pendingChanges.updated) {
            try {
                await syncContact(contact, accessToken);
                console.log(`Contacto actualizado en Google: ${contact.name} ${contact.lastname}`);
                successCount++;
            } catch (error) {
                console.error(`Error al actualizar contacto en Google: ${contact.id}`, error);
                errorCount++;
            }
        }
        
        // Procesar eliminaciones
        for (const contactId of pendingChanges.deleted) {
            try {
                // Buscar el contacto en los datos actuales (puede que ya no exista)
                const contactRef = doc(db, 'contacts', contactId);
                const contactSnap = await getDoc(contactRef);
                
                if (contactSnap.exists()) {
                    const contactData = contactSnap.data() as Contact;
                    await eliminarContacto(contactData, accessToken);
                    console.log(`Contacto eliminado de Google: ${contactId}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`Error al eliminar contacto de Google: ${contactId}`, error);
                errorCount++;
            }
        }
        
        // Mostrar notificación de resumen si hubo cambios
        const totalChanges = pendingChanges.added.length + pendingChanges.updated.length + pendingChanges.deleted.length;
        if (totalChanges > 0) {
            if (errorCount === 0) {
                notifications.success(`Sincronización automática completada: ${successCount} contactos procesados`);
            } else if (successCount > 0) {
                notifications.warning(`Sincronización parcial: ${successCount} contactos procesados, ${errorCount} errores`);
            } else {
                notifications.error(`Error en la sincronización automática: ${errorCount} errores`);
            }
        }
        
        // Actualizar información de sincronización
        const systemDocRef = doc(db, 'system', 'googleContactsSync');
        await setDoc(systemDocRef, {
            lastSyncTime: Timestamp.fromDate(new Date()),
            lastSyncDirection: 'to-google',
            lastSyncChanges: {
                added: pendingChanges.added.length,
                updated: pendingChanges.updated.length,
                deleted: pendingChanges.deleted.length
            },
            lastSyncResults: {
                success: successCount,
                errors: errorCount
            }
        }, { merge: true });
        
        // Limpiar cambios pendientes solo si se procesaron correctamente
        if (errorCount === 0) {
            pendingChanges = {
                added: [],
                updated: [],
                deleted: []
            };
        } else {
            // Mantener solo los cambios que fallaron para reintentar después
            // Esto requeriría un seguimiento más detallado de qué contactos específicos fallaron
            // Por ahora, simplemente mantenemos todos los cambios para simplicidad
            console.log('Algunos cambios no se procesaron correctamente. Se reintentarán en la próxima sincronización.');
        }
        
    } catch (error) {
        console.error('Error al procesar cambios pendientes:', error);
        notifications.error(`Error en la sincronización: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

/**
 * Sincroniza todos los contactos de Firebase a Google
 */
export async function syncAllContactsToGoogle() {
    try {
        // Obtener token de acceso
        const accessToken = await getAccessToken();
        if (!accessToken) {
            throw new Error('No se pudo obtener un token de acceso válido para Google. Por favor, conéctate a Google Contacts primero.');
        }
        
        // Obtener todos los contactos de Firebase
        const contactsRef = collection(db, 'contacts');
        const snapshot = await getDocs(contactsRef);
        const contacts = snapshot.docs.map(doc => doc.data() as Contact);
        
        if (contacts.length === 0) {
            notifications.add({
                type: 'info',
                message: 'No hay contactos para sincronizar',
                duration: 3000
            });
            return {
                success: true,
                total: 0,
                successful: 0,
                failed: 0
            };
        }
        
        // Notificar inicio de sincronización
        notifications.add({
            type: 'info',
            message: `Sincronizando ${contacts.length} contactos a Google...`,
            duration: 3000
        });
        
        // Sincronizar cada contacto
        let successCount = 0;
        let errorCount = 0;
        let failedContacts = [];
        
        for (const contact of contacts) {
            try {
                // Verificar que el contacto tenga ID válido
                if (!contact.id) {
                    console.error('Contacto sin ID válido:', contact);
                    errorCount++;
                    failedContacts.push({
                        name: `${contact.name || ''} ${contact.lastname || ''}`.trim() || 'Contacto sin nombre',
                        reason: 'ID inválido'
                    });
                    continue;
                }
                
                await syncContact(contact, accessToken);
                successCount++;
            } catch (error) {
                console.error(`Error al sincronizar contacto ${contact.id}:`, error);
                errorCount++;
                failedContacts.push({
                    name: `${contact.name || ''} ${contact.lastname || ''}`.trim() || 'Contacto sin nombre',
                    reason: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        // Actualizar información de sincronización
        const systemDocRef = doc(db, 'system', 'googleContactsSync');
        await setDoc(systemDocRef, {
            lastSyncTime: Timestamp.fromDate(new Date()),
            lastSyncDirection: 'to-google',
            contactsCount: {
                firebase: contacts.length,
                google: successCount
            },
            lastSyncResults: {
                success: successCount,
                errors: errorCount,
                failedContacts: failedContacts.slice(0, 10) // Guardar solo los primeros 10 para no sobrecargar Firestore
            }
        }, { merge: true });
        
        // Notificar resultado
        if (errorCount === 0) {
            notifications.add({
                type: 'success',
                message: `${successCount} contactos sincronizados a Google correctamente`,
                duration: 3000
            });
        } else if (successCount > 0) {
            notifications.add({
                type: 'warning',
                message: `Sincronización parcial: ${successCount} contactos sincronizados, ${errorCount} errores`,
                duration: 5000
            });
        } else {
            notifications.add({
                type: 'error',
                message: `Error en la sincronización: Ningún contacto sincronizado (${errorCount} errores)`,
                duration: 5000
            });
        }
        
        return {
            success: errorCount === 0,
            total: contacts.length,
            successful: successCount,
            failed: errorCount,
            failedContacts: failedContacts
        };
    } catch (error) {
        console.error('Error al sincronizar todos los contactos:', error);
        
        notifications.add({
            type: 'error',
            message: `Error al sincronizar contactos: ${error instanceof Error ? error.message : String(error)}`,
            duration: 5000
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            total: 0,
            successful: 0,
            failed: 0
        };
    }
}

/**
 * Maneja la sincronización automática de un contacto específico
 */
export async function handleContactSync(contact: Contact, operation: 'add' | 'update' | 'delete') {
    if (!AUTO_SYNC_ENABLED) return;
    
    try {
        // Verificar que el contacto tenga ID válido
        if (!contact.id && operation !== 'delete') {
            console.error('Contacto sin ID válido:', contact);
            return;
        }
        
        // Obtener token de acceso
        const accessToken = await getAccessToken();
        if (!accessToken) {
            console.error('No se pudo obtener un token de acceso válido para Google');
            // No mostramos notificación aquí para evitar spam, ya que getAccessToken ya muestra una notificación
            return;
        }
        
        // Realizar la operación correspondiente
        switch (operation) {
            case 'add':
            case 'update':
                await syncContact(contact, accessToken);
                console.log(`Contacto ${operation === 'add' ? 'añadido a' : 'actualizado en'} Google: ${contact.name} ${contact.lastname}`);
                break;
            case 'delete':
                await eliminarContacto(contact, accessToken);
                console.log(`Contacto eliminado de Google: ${contact.id}`);
                break;
        }
        
        // Actualizar información de sincronización
        const systemDocRef = doc(db, 'system', 'googleContactsSync');
        await setDoc(systemDocRef, {
            lastSyncTime: Timestamp.fromDate(new Date()),
            lastSyncDirection: 'to-google',
            lastSyncOperation: operation,
            lastSyncContact: {
                id: contact.id,
                name: `${contact.name || ''} ${contact.lastname || ''}`.trim(),
                operation
            }
        }, { merge: true });
        
        // Solo mostrar notificación en caso de operaciones manuales o errores
        // Para mantener el sistema no intrusivo según las preferencias del usuario
        
    } catch (error) {
        console.error(`Error al sincronizar contacto (${operation}):`, error);
        
        // Solo mostrar notificación de error si es grave, para no interrumpir al usuario
        if (error instanceof Error && 
            (error.message.includes('token') || error.message.includes('autenticación') || error.message.includes('autorización'))) {
            notifications.error(`Error de autenticación con Google: ${error.message}`);
        }
    }
}
