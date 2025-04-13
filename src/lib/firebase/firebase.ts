import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence, 
  signInWithEmailAndPassword,
  type Auth
} from 'firebase/auth';

// Store para controlar qué base de datos usamos
const createDbToggleStore = () => {
  // Inicializar desde localStorage si está disponible
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

// Exportamos un store para el estado de inicialización
export const firebaseInitialized = writable(false);
export const firebaseError = writable<Error | null>(null);

// Variables para las instancias
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Función para determinar qué configuración de Firebase usar
function getFirebaseConfig() {
  // Verificar si estamos usando la base de datos de prueba
  const isUsingTestDb = browser ? localStorage.getItem('useTestDb') === 'true' : false;
  
  try {
    if (isUsingTestDb) {
      // Configuración de base de datos de prueba (Curso Svelte)
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
      // Configuración de base de datos principal (Match Home)
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
  } catch (error) {
    console.error("Error al cargar configuración de Firebase:", error);
    firebaseError.set(error as Error);
    
    // Configuración de fallback
    return {
      apiKey: "",
      authDomain: "",
      projectId: "",
      databaseURL: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };
  }
}

// Función de inicialización explícita
export async function initializeFirebase() {
  if (!browser) {
    console.log("Saltando inicialización de Firebase en el servidor");
    return { app: null, db: null, auth: null };
  }
  
  try {
    console.log("Inicializando Firebase...");
    
    // Obtener configuración
    const firebaseConfig = getFirebaseConfig();
    console.log("Configuración obtenida:", 
      Object.keys(firebaseConfig).map(k => `${k}: ${firebaseConfig[k] ? 'configurado' : 'vacío'}`).join(', ')
    );
    
    // Inicializar app
    if (!getApps().length) {
      console.log("Creando nueva app de Firebase");
      app = initializeApp(firebaseConfig);
    } else {
      console.log("Usando app de Firebase existente");
      app = getApp();
    }
    
    // Inicializar servicios
    console.log("Inicializando Firestore");
    db = getFirestore(app);
    
    console.log("Inicializando Auth");
    auth = getAuth(app);
    
    // Configurar persistencia
    console.log("Configurando persistencia de autenticación");
    await setPersistence(auth, browserLocalPersistence);
    
    // Mostrar información
    const dbName = localStorage.getItem('useTestDb') === 'true' ? 
      'Curso Svelte (Gratuita)' : 
      'Match Home (Producción)';
    console.log(`Firebase inicializado usando base de datos: ${dbName}`);
    
    // Marcar como inicializado
    firebaseInitialized.set(true);
    firebaseError.set(null);
    
    return { app, db, auth };
  } catch (error) {
    console.error("Error crítico al inicializar Firebase:", error);
    firebaseError.set(error as Error);
    firebaseInitialized.set(false);
    
    // Crear versiones mock para evitar errores
    if (!app) app = {} as FirebaseApp;
    if (!db) db = {
      collection: () => ({ get: async () => ({ docs: [] }) })
    } as unknown as Firestore;
    if (!auth) auth = { currentUser: null } as unknown as Auth;
    
    return { app, db, auth };
  }
}

// Función de ayuda para la autenticación con manejo explícito de errores
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
    
    console.log(`Intentando login con email: ${email.substring(0, 3)}...`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login exitoso:", userCredential.user.uid);
    return { success: true, user: userCredential.user, error: null };
  } catch (error) {
    console.error("Error en login:", error);
    return { 
      success: false, 
      user: null, 
      error: error,
      code: error.code,
      message: error.message
    };
  }
}

// Inicializar si estamos en el navegador
if (browser) {
  console.log("Inicializando Firebase automáticamente en el navegador");
  initializeFirebase()
    .then(({ app: a, db: d, auth: au }) => {
      app = a;
      db = d;
      auth = au;
    })
    .catch(err => {
      console.error("Error en inicialización automática:", err);
    });
} else {
  console.log("Firebase no se inicializará en el servidor");
}

export { app, db, auth };
