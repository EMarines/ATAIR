import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Importar la configuración de Firebase desde el archivo principal
import { db, auth } from '$lib/firebase_toggle';

/**
 * Obtiene las instancias de Firebase necesarias para interactuar con los servicios
 * @returns Objeto con las instancias de Firebase
 */
export function getFirebase() {
    try {
        // Obtener la aplicación existente
        const app = getApp();
        
        // Obtener instancias de servicios
        const firestore = db || getFirestore(app);
        const functions = getFunctions(app);
        
        return {
            app,
            auth,
            firestore,
            functions,
            httpsCallable
        };
    } catch (error) {
        console.error('Error al obtener instancias de Firebase:', error);
        throw error;
    }
}
