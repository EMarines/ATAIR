import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_STORAGE_BUCKET, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, PUBLIC_FIREBASE_APP_ID, PUBLIC_DATA_BASE_URL } from '$env/static/public';

const firebaseConfig = {
    apiKey: PUBLIC_FIREBASE_API_KEY,
    authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: PUBLIC_FIREBASE_PROJECT_ID,
    databaseURL: PUBLIC_DATA_BASE_URL,
    storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: PUBLIC_FIREBASE_APP_ID
};

// const firebaseConfig = {
//     apiKey: "AIzaSyCkuw82zTqtiPDp3eS2qwGr8UUQFDBBglM",
//     authDomain: "curso-svelte-58c5d.firebaseapp.com",
//     projectId: "curso-svelte-58c5d",
//     storageBucket: "curso-svelte-58c5d.appspot.com",
//     messagingSenderId: "1067367490239",
//     appId: "1:1067367490239:web:8a8aeae384fa8319515c0a"
//   };


// Inicializar Firebase solo si no existe una instancia
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app)
