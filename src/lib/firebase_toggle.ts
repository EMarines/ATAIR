// src/lib/firebase_toggle.ts
// Configuración con Switch de Entorno (Sandbox curso-svelte-58c5d vs Producción matchhome-crm-46de4)

import { browser } from '$app/environment';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const devConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_DEV_API_KEY || "AIzaSyCkuw82zTqtiPDp3eS2qwGr8UUQFDBBglM",
  authDomain: import.meta.env.VITE_FIREBASE_DEV_AUTH_DOMAIN || "curso-svelte-58c5d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_DEV_PROJECT_ID || "curso-svelte-58c5d",
  storageBucket: import.meta.env.VITE_FIREBASE_DEV_STORAGE_BUCKET || "curso-svelte-58c5d.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_DEV_MESSAGING_SENDER_ID || "1067367490239",
  appId: import.meta.env.VITE_FIREBASE_DEV_APP_ID || "1:1067367490239:web:8a8aeae384fa8319515c0a"
};

const prodConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_PROD_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCPSB4ynujCJ7B8TFmJQFEiXSj3LpGzE9A",
  authDomain: import.meta.env.VITE_FIREBASE_PROD_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "matchhome-crm-46de4.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROD_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || "matchhome-crm-46de4",
  storageBucket: import.meta.env.VITE_FIREBASE_PROD_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "matchhome-crm-46de4.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_PROD_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "73269189317",
  appId: import.meta.env.VITE_FIREBASE_PROD_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || "1:73269189317:web:f90e43bb2806b813ddaeac"
};

const isLocalhost = browser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const activeEnv = import.meta.env.VITE_FIREBASE_ENV || (isLocalhost ? 'dev' : 'prod');

export const isSandbox = activeEnv === 'dev';
const firebaseConfig = isSandbox ? devConfig : prodConfig;
export const currentProjectId = firebaseConfig.projectId;

console.log(`[Firebase ATAIR] Conectado a: ${firebaseConfig.projectId} (${isSandbox ? '🧪 SANDBOX / PRUEBAS' : '🏢 PRODUCCIÓN OFICIAL'})`);

let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;  
let auth: ReturnType<typeof getAuth> | null = null;     

try {
    if (getApps().length > 0) {
        app = getApp(); 
    } else {
        app = initializeApp(firebaseConfig);
    }
    
    db = getFirestore(app);
    auth = getAuth(app);

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
    } catch (retryError) {
        console.error("Falló la recuperación:", retryError);
        app = null; 
        db = null; 
        auth = null;
    }
}

const propertiesDb = db;

export { app, db, auth, propertiesDb };

