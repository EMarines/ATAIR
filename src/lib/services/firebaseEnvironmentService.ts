import { browser } from '$app/environment';
import { writable, get, derived } from 'svelte/store';
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

// Clase para manejar Firebase
class FirebaseEnvironmentService {
    private mainApp: FirebaseApp | null = null;
    private mainAuth: Auth | null = null;
    private mainDb: Firestore | null = null;

    // Store para las instancias activas
    private instancesStore = writable<FirebaseInstances>({
        app: null,
        auth: null,
        db: null
    });
    
    private isInitialized = false;
    
    constructor() {
        if (browser) {
            this.initializeFirebaseApps();
        }
    }
    
    private initializeFirebaseApps() {
        try {
            if (this.isInitialized) {
                return;
            }
            
            // Configuración Firebase (matchhome-crm-46de4)
            const mainConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID
            };
            
            // Inicializar app
            const apps = getApps();
            this.mainApp = apps.length > 0 ? getApp() : initializeApp(mainConfig);
            this.mainAuth = getAuth(this.mainApp);
            this.mainDb = getFirestore(this.mainApp);
            
            // Configurar persistencia
            if (this.mainAuth) {
                setPersistence(this.mainAuth, browserLocalPersistence)
                    .catch(error => console.error("Error configurando persistencia:", error));
            }
            
            // Establecer instancias
            this.instancesStore.set({
                app: this.mainApp,
                auth: this.mainAuth,
                db: this.mainDb
            });
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error("Error al inicializar Firebase:", error);
        }
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

// Verificar si Firestore está inicializado
export function isFirestoreReady(): boolean {
  const instances = firebaseEnvironment.getCurrentInstances();
  return instances && instances.db !== null;
}

// Asegurar que Firestore esté listo
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
