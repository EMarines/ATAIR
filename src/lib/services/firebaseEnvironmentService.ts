import { browser } from '$app/environment';
import { writable, get, derived } from 'svelte/store';
// Reemplazando el store eliminado con un store local
const testMode = writable<boolean>(false);
import { initializeApp, getApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

// Define los tipos para las instancias de Firebase
interface FirebaseInstances {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
}

// Clase para manejar cambios entre entornos de Firebase
class FirebaseEnvironmentService {
    // Apps de Firebase
    private mainApp: FirebaseApp | null = null;
    private testApp: FirebaseApp | null = null;
    
    // Instancias de Auth
    private mainAuth: Auth | null = null;
    private testAuth: Auth | null = null;
    
    // Instancias de Firestore
    private mainDb: Firestore | null = null;
    private testDb: Firestore | null = null;

    // Store para las instancias activas
    private instancesStore = writable<FirebaseInstances>({
        app: null,
        auth: null,
        db: null
    });
    
    // Variable para evitar inicialización duplicada
    private isInitialized = false;
    
    constructor() {
        if (browser) {
            // Inicializar las apps y servicios
            this.initializeFirebaseApps();
            
            // Escuchar cambios en el modo de prueba
            testMode.subscribe(isTestMode => {
                if (isTestMode) {
                    this.useTestEnvironment();
                } else {
                    this.useProductionEnvironment();
                }
            });
        }
    }
    
    private initializeFirebaseApps() {
        try {
            // Si ya se inicializó, no hacerlo de nuevo para evitar errores
            if (this.isInitialized) {
                return;
            }
            
            // Configuración de Firebase principal (Match Home - producción)
            const mainConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                databaseURL: import.meta.env.VITE_FIREBASE_DATA_BASE_URL,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID
            };
            
            // Configuración de Firebase de prueba (Curso Svelte - gratuita)
            const testConfig = {
                apiKey: import.meta.env.VITE_TEST_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_TEST_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_TEST_FIREBASE_PROJECT_ID,
                databaseURL: import.meta.env.VITE_TEST_FIREBASE_DATA_BASE_URL,
                storageBucket: import.meta.env.VITE_TEST_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_TEST_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_TEST_FIREBASE_APP_ID
            };
            
            // Inicializar app principal (Match Home)
            const apps = getApps();
            this.mainApp = apps.length > 0 ? getApp() : initializeApp(mainConfig);
            this.mainAuth = getAuth(this.mainApp);
            this.mainDb = getFirestore(this.mainApp);
            
            // Inicializar app de prueba (Curso Svelte)
            this.testApp = initializeApp(testConfig, 'test-environment');
            this.testAuth = getAuth(this.testApp);
            this.testDb = getFirestore(this.testApp);
            
            // Configurar persistencia para ambos Auth
            if (this.mainAuth) {
                setPersistence(this.mainAuth, browserLocalPersistence)
                    .catch(error => console.error("Error configurando persistencia en producción:", error));
            }
                
            if (this.testAuth) {
                setPersistence(this.testAuth, browserLocalPersistence)
                    .catch(error => console.error("Error configurando persistencia en pruebas:", error));
            }
            
            // Por defecto, verificar si estamos en modo prueba
            const isTestMode = get(testMode);
            if (isTestMode) {
                this.useTestEnvironment();
            } else {
                this.useProductionEnvironment();
            }
            
            // Marcar como inicializado
            this.isInitialized = true;
            
        } catch (error) {
            console.error("Error al inicializar entornos de Firebase:", error);
        }
    }
    
    useProductionEnvironment() {
        this.instancesStore.set({
            app: this.mainApp,
            auth: this.mainAuth,
            db: this.mainDb
        });
    }
    
    useTestEnvironment() {
        this.instancesStore.set({
            app: this.testApp,
            auth: this.testAuth,
            db: this.testDb
        });
    }
    
    // Getter para acceder al store de instancias
    get instances() {
        return {
            subscribe: this.instancesStore.subscribe
        };
    }
    
    // Getters para cada instancia individual
    get app() {
        return {
            subscribe: derived(this.instancesStore, $instances => $instances.app).subscribe
        };
    }
    
    get auth() {
        return {
            subscribe: derived(this.instancesStore, $instances => $instances.auth).subscribe
        };
    }
    
    get db() {
        return {
            subscribe: derived(this.instancesStore, $instances => $instances.db).subscribe
        };
    }
    
    // Helper para obtener las instancias actuales directamente
    getCurrentInstances(): FirebaseInstances {
        return get(this.instancesStore);
    }
}

// Exportar una instancia singleton
export const firebaseEnvironment = new FirebaseEnvironmentService();

// Para compatibilidad con el código existente
export const app = {
    subscribe: derived(firebaseEnvironment.instances, $instances => $instances.app).subscribe
};
export const auth = {
    subscribe: derived(firebaseEnvironment.instances, $instances => $instances.auth).subscribe
};
export const db = {
    subscribe: derived(firebaseEnvironment.instances, $instances => $instances.db).subscribe
};

// Helper para obtener las instancias actuales
export function getCurrentFirebase() {
    return firebaseEnvironment.getCurrentInstances();
}

// Agregar una función para verificar si Firestore está inicializado
export function isFirestoreReady(): boolean {
  const instances = firebaseEnvironment.getCurrentInstances();
  return instances && instances.db !== null;
}

// Agregar un nuevo método al servicio para asegurar que Firestore esté listo
export async function waitForFirestore(maxAttempts = 10, delay = 200): Promise<Firestore | null> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const instances = firebaseEnvironment.getCurrentInstances();
    
    if (instances && instances.db) {
      console.log("Firestore está listo para usar");
      return instances.db;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    attempts++;
  }
  
  console.error("No se pudo obtener Firestore después de varios intentos");
  return null;
}
