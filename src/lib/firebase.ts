import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_STORAGE_BUCKET, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, PUBLIC_FIREBASE_APP_ID } from '$env/static/public';

const firebaseConfig = {
    apiKey: PUBLIC_FIREBASE_API_KEY,
    authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: PUBLIC_FIREBASE_PROJECT_ID,
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

// Agrega este console.log para debug
// console.log('Variables de entorno:', {
//     apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ? 'Existe' : 'No existe',
//     authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Existe' : 'No existe',
//     projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ? 'Existe' : 'No existe'
// });

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app)
