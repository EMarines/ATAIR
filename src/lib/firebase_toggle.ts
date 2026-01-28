// src/lib/firebase_toggle.ts

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// --- Store (sin cambios) ---
const createDbToggleStore = () => {
  const initialValue = browser && !import.meta.env.PROD ?
    localStorage.getItem('useTestDb') === 'true' :
    false;
  const { subscribe, set, update } = writable<boolean>(initialValue);
  return {
    subscribe,
    // Las implementaciones de enable/disable/toggle deben verificar !import.meta.env.PROD
    // y potencialmente usar window.location.reload() solo en desarrollo.
    // Ejemplo (asumiendo que ya tienes la lógica):
    enable: () => {
        if (!import.meta.env.PROD && browser) {
            set(true);
            localStorage.setItem('useTestDb', 'true');
            window.location.reload();
        }
     },
    disable: () => {
        if (!import.meta.env.PROD && browser) {
            set(false);
            localStorage.setItem('useTestDb', 'false');
            window.location.reload();
        }
     },
    toggle: () => {
        if (browser) {
            update(value => {
                const newValue = !value;
                console.log("Cambiando base de datos a:", newValue ? "PRUEBA" : "PRODUCCIÓN");
                localStorage.setItem('useTestDb', String(newValue));
                // Agregar pequeño retraso antes de recargar para asegurar que
                // localStorage se actualice completamente
                setTimeout(() => {
                  window.location.reload();
                }, 100);
                return newValue;
            });
        } else {
            console.log("Toggle no disponible en entorno no-browser");
        }
     }
  };
};
export const useTestDb = createDbToggleStore();

// --- Función getFirebaseConfig ---
function getFirebaseConfig() {
  // En producción, siempre usar la configuración principal
  if (import.meta.env.PROD) {
    console.log("Modo producción: usando base de datos principal (Match Home)");
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      databaseURL: import.meta.env.VITE_FIREBASE_DATA_BASE_URL,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
  }

  // En desarrollo, verificar explícitamente localStorage para usar la base de datos apropiada
  let isUsingTestDb = false;
  
  if (browser) {
    // Leer directamente de localStorage con fallback seguro
    isUsingTestDb = localStorage.getItem('useTestDb') === 'true';
    console.log("Modo desarrollo: usando base de datos:", isUsingTestDb ? "TEST (Curso Svelte)" : "PRINCIPAL (Match Home)");
  }

  if (isUsingTestDb) {
    // Configuración Test (SIN databaseURL si no la usas)
    return {
      apiKey: import.meta.env.VITE_TEST_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_TEST_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_TEST_FIREBASE_PROJECT_ID,
      // databaseURL: import.meta.env.VITE_TEST_FIREBASE_DATA_BASE_URL, // <-- ELIMINADO SI NO USAS RTDB
      storageBucket: import.meta.env.VITE_TEST_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_TEST_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_TEST_FIREBASE_APP_ID
    };
  } else {
    // Configuración Principal Dev (SIN databaseURL si no la usas)
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      // databaseURL: import.meta.env.VITE_FIREBASE_DATA_BASE_URL, // <-- ELIMINADO SI NO USAS RTDB
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
  }
}

// --- Inicializar Firebase ---
const firebaseConfig = getFirebaseConfig();

// Verificar si las variables están presentes
// Ajustar la comprobación si eliminaste databaseURL
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']; // Lista sin databaseURL
const allConfigPresent = requiredKeys.every(key => {
    const value = firebaseConfig[key as keyof typeof firebaseConfig];
    return value !== undefined && value !== null && value !== '';
});


// Variables para Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;  
let auth: ReturnType<typeof getAuth> | null = null;     

// Mensaje de diagnóstico
if (browser) {
    console.log(`Estado inicial de useTestDb (localStorage): ${localStorage.getItem('useTestDb')}`);
}

if (allConfigPresent) {
    try {
        if (getApps().length) {
            app = getApp(); // Obtener la app predeterminada existente
            console.log("Usando app de Firebase existente");
        } else {
            // Inicializar la app principal
            app = initializeApp(firebaseConfig);
            console.log("Inicializando nueva app de Firebase");
        }
        
        db = getFirestore(app);
        auth = getAuth(app);

        // Configurar persistencia una sola vez al inicio
        if (browser && auth) {
            setPersistence(auth, browserLocalPersistence)
                .then(() => console.log('✅ Persistencia Local establecida'))
                .catch(err => console.error('❌ Error persistencia:', err));
        }
    } catch (initError) {
         // Mantener este error, es crítico si la inicialización falla
         console.error("¡Error Crítico! Fallo durante la inicialización de Firebase:", initError);
         // Asegurarse que las variables queden null si hay error aquí
         app = null;
         db = null;
         auth = null;
    }
} else {
    // --- ¡MANTENER ESTE ERROR CRÍTICO! Es necesario para diagnóstico ---
    console.error("¡Error Crítico! Faltan variables de configuración de Firebase. Revisa las variables de entorno (VITE_FIREBASE_... o VITE_TEST_FIREBASE_...). La aplicación no puede inicializar Firebase.");
    // Las variables app, db, auth ya son null por defecto
}


// Exportar las instancias (pueden ser null si la configuración/inicialización falló)
export { app, db, auth };
