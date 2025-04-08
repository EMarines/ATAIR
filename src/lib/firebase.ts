// Implementación simulada para cuando Firebase no está disponible
const mockFirebase = {
    db: {
        collection: () => ({
            doc: () => ({
                get: async () => ({
                    exists: () => false,
                    data: () => ({}),
                    id: 'mock-id'
                }),
                set: async () => {},
                update: async () => {},
                delete: async () => {}
            }),
            where: () => ({
                get: async () => ({
                    docs: [],
                    empty: true
                })
            }),
            add: async () => ({
                id: 'mock-id'
            })
        })
    },
    auth: {
        currentUser: null,
        onAuthStateChanged: (callback) => {
            callback(null);
            return () => {};
        },
        signInWithEmailAndPassword: async () => ({
            user: { uid: 'mock-uid' }
        }),
        signOut: async () => {}
    }
};

let firebaseApp;
let auth;
let db;

try {
    // Intentar importar Firebase
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');
    const { getAuth, setPersistence, browserLocalPersistence, onIdTokenChanged } = await import('firebase/auth');
    
    // Importar browser para detectar entorno de navegador
    const { browser } = await import('$app/environment');
    
    // Usar variables de entorno directamente desde import.meta.env (compatible con Vite)
    // en lugar de $env/static/public que puede dar problemas
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        databaseURL: import.meta.env.VITE_FIREBASE_DATA_BASE_URL,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    // Inicializar Firebase
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    // Configurar persistencia solo en el navegador
    if (browser) {
        setPersistence(auth, browserLocalPersistence)
            .then(() => {
                console.log("Persistencia configurada correctamente");
                
                // Configurar listener para renovación de token con manejo de errores mejorado
                onIdTokenChanged(auth, async (user) => {
                    if (user) {
                        try {
                            // Verificar si ya tenemos un token reciente antes de solicitar uno nuevo
                            const lastTokenTime = localStorage.getItem('last-token-refresh');
                            const now = Date.now();
                            
                            // Solo solicitar un nuevo token si han pasado más de 15 minutos o no hay token
                            if (!lastTokenTime || (now - parseInt(lastTokenTime)) > 15 * 60 * 1000) {
                                const token = await user.getIdToken(false); // Usar false para evitar forzar renovación
                                sessionStorage.setItem('firebase-token', token);
                                localStorage.setItem('user-logged-in', 'true');
                                localStorage.setItem('last-token-refresh', now.toString());
                                console.log('Token actualizado en Firebase.ts');
                            }
                        } catch (tokenError) {
                            console.warn("No se pudo actualizar el token pero la sesión continúa:", tokenError.code);
                            // A pesar del error, mantenemos el estado de autenticación
                            localStorage.setItem('user-logged-in', 'true');
                        }
                    } else {
                        // Limpiar token si no hay usuario
                        sessionStorage.removeItem('firebase-token');
                        localStorage.removeItem('user-logged-in');
                        localStorage.removeItem('last-token-refresh');
                    }
                });
            })
            .catch((error) => {
                console.error("Error configurando persistencia:", error);
            });
    } else {
        console.log("Persistencia no configurada: entorno no-browser");
    }
} catch (error) {
    console.error("Error al cargar Firebase:", error);
    console.log("Usando implementación simulada de Firebase");
    
    // Usar implementación simulada
    firebaseApp = null;
    auth = mockFirebase.auth;
    db = mockFirebase.db;
}

export { firebaseApp, auth, db };
