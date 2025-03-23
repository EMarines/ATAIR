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
    const { getAuth, setPersistence, browserLocalPersistence } = await import('firebase/auth');
    
    // Importar variables de entorno
    const { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, 
            PUBLIC_FIREBASE_STORAGE_BUCKET, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, 
            PUBLIC_FIREBASE_APP_ID, PUBLIC_DATA_BASE_URL } = await import('$env/static/public');
    
    // Configuración de Firebase
    const firebaseConfig = {
        apiKey: PUBLIC_FIREBASE_API_KEY,
        authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: PUBLIC_FIREBASE_PROJECT_ID,
        databaseURL: PUBLIC_DATA_BASE_URL,
        storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: PUBLIC_FIREBASE_APP_ID
    };

    // Inicializar Firebase
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    // Configurar persistencia
    setPersistence(auth, browserLocalPersistence)
        .catch((error) => {
            console.error("Error configurando persistencia:", error);
        });
} catch (error) {
    console.error("Error al cargar Firebase:", error);
    console.log("Usando implementación simulada de Firebase");
    
    // Usar implementación simulada
    firebaseApp = null;
    auth = mockFirebase.auth;
    db = mockFirebase.db;
}

export { firebaseApp, auth, db };
