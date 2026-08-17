// src/lib/firebase_toggle.ts
// Configuración única de Firebase - Proyecto: matchhome-crm-46de4

import { browser } from '$app/environment';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// --- Configuración Firebase ---
function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
}

// --- Inicializar Firebase ---
const firebaseConfig = getFirebaseConfig();

// Verificar configuración
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const allConfigPresent = requiredKeys.every(key => {
    const value = firebaseConfig[key as keyof typeof firebaseConfig];
    return value !== undefined && value !== null && value !== '';
});

// --- Variables Firebase ---
let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;  
let auth: ReturnType<typeof getAuth> | null = null;     

if (allConfigPresent) {
    try {
        if (getApps().length > 0) {
            app = getApp(); 
            console.log("Usando instancia de Firebase existente");
        } else {
            app = initializeApp(firebaseConfig);
            console.log("Inicializada nueva instancia de Firebase (matchhome-crm-46de4)");
        }
        
        db = getFirestore(app);
        auth = getAuth(app);

        // Configurar persistencia
        if (browser && auth) {
            setPersistence(auth, browserLocalPersistence)
                .then(() => console.log('Persistencia (BrowserLocal) configurada'))
                .catch(err => console.error('Error configurando persistencia:', err));
        }
    } catch (initError) {
         console.error("Error Crítico inicializando Firebase:", initError);
         try {
            app = getApp();
            db = getFirestore(app);
            auth = getAuth(app);
            console.log("Recuperado de error de inicialización usando app existente");
         } catch (retryError) {
            console.error("Falló la recuperación:", retryError);
            app = null; 
            db = null; 
            auth = null;
         }
    }
} else {
    console.error("¡Error Crítico! Faltan variables de configuración de Firebase. Revisa las variables de entorno.");
}

// propertiesDb es un alias de db para compatibilidad con código existente
const propertiesDb = db;

// Exportar las instancias
export { app, db, auth, propertiesDb };
