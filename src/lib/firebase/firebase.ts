import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword, // <-- Importado para el registro
  type Auth
} from 'firebase/auth';

// Store para controlar qué base de datos usamos
const createDbToggleStore = () => {
  const initialValue = browser ?
    localStorage.getItem('useTestDb') === 'true' :
    false;

  const { subscribe, update } = writable<boolean>(initialValue);

  return {
    subscribe,
    toggle: () => {
      update(value => {
        const newValue = !value;
        if (browser) {
          localStorage.setItem('useTestDb', String(newValue));
          window.location.reload();
        }
        return newValue;
      });
    }
  };
};

export const useTestDb = createDbToggleStore();
export const firebaseInitialized = writable(false);

// Variables para las instancias
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Función para determinar qué configuración de Firebase usar
function getFirebaseConfig() {
  const isUsingTestDb = browser ? localStorage.getItem('useTestDb') === 'true' : false;

  if (isUsingTestDb) {
    // Configuración de base de datos de prueba
    return {
      apiKey: import.meta.env.VITE_TEST_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_TEST_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_TEST_FIREBASE_PROJECT_ID,
      databaseURL: import.meta.env.VITE_TEST_FIREBASE_DATA_BASE_URL,
      storageBucket: import.meta.env.VITE_TEST_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_TEST_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_TEST_FIREBASE_APP_ID
    };
  } else {
    // Configuración de base de datos principal
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
}

// Función de inicialización
export async function initializeFirebase() {
  if (!browser) {
    return { app: null, db: null, auth: null };
  }

  // Obtener configuración
  const firebaseConfig = getFirebaseConfig();

  // Inicializar app
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Inicializar servicios
  db = getFirestore(app);
  auth = getAuth(app);

  // Configurar persistencia
  await setPersistence(auth, browserLocalPersistence);

  // Marcar como inicializado
  firebaseInitialized.set(true);

  return { app, db, auth };
}

// Función de ayuda para la autenticación (Login)
export async function loginWithEmailPassword(email: string, password: string) {
  try {
    // Asegurarse de que Firebase esté inicializado
    if (!auth) {
      const { auth: newAuth } = await initializeFirebase();
      if (!newAuth) {
        throw new Error("No se pudo inicializar Firebase Auth");
      }
      auth = newAuth;
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user, error: null, code: null, message: null }; // Añadido code y message null para consistencia
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error,
      code: error.code, // Código de error de Firebase
      message: error.message // Mensaje de error de Firebase
    };
  }
}

// Función de ayuda para el registro
export async function registerWithEmailPassword(email: string, password: string) {
  try {
    // Asegurarse de que Firebase esté inicializado
    if (!auth) {
      const { auth: newAuth } = await initializeFirebase();
      if (!newAuth) {
        throw new Error("No se pudo inicializar Firebase Auth");
      }
      auth = newAuth;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password); // <-- Usa la función de registro
    return { success: true, user: userCredential.user, error: null, code: null, message: null }; // Añadido code y message null para consistencia
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error,
      code: error.code, // <-- Asegúrate de devolver el código de error
      message: error.message // <-- Y el mensaje
    };
  }
}


// Inicializar si estamos en el navegador
if (browser) {
  initializeFirebase()
    .then(({ app: a, db: d, auth: au }) => {
      // Solo asigna si no son null (ya que initializeFirebase puede devolver null si !browser)
      if (a) app = a;
      if (d) db = d;
      if (au) auth = au;
    }).catch(err => {
      console.error("Error durante la inicialización automática de Firebase:", err);
    });
}

export { app, db, auth };
