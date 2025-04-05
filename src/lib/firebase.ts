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
    
    // Configuración de Firebase
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
