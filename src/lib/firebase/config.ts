// src/lib/firebase/config.ts
// Inicialización unificada de Firebase con soporte Sandbox y Producción

import { browser } from '$app/environment';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	getFirestore,
	type Firestore
} from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const devConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_DEV_API_KEY || "AIzaSyCkuw82zTqtiPDp3eS2qwGr8UUQFDBBglM",
	authDomain: import.meta.env.VITE_FIREBASE_DEV_AUTH_DOMAIN || "curso-svelte-58c5d.firebaseapp.com",
	projectId: import.meta.env.VITE_FIREBASE_DEV_PROJECT_ID || "curso-svelte-58c5d",
	storageBucket: import.meta.env.VITE_FIREBASE_DEV_STORAGE_BUCKET || "curso-svelte-58c5d.appspot.com",
	messagingSenderId: import.meta.env.VITE_FIREBASE_DEV_MESSAGING_SENDER_ID || "1067367490239",
	appId: import.meta.env.VITE_FIREBASE_DEV_APP_ID || "1:1067367490239:web:8a8aeae384fa8319515c0a"
};

const prodConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_PROD_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCPSB4ynujCJ7B8TFmJQFEiXSj3LpGzE9A",
	authDomain: import.meta.env.VITE_FIREBASE_PROD_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "matchhome-crm-46de4.firebaseapp.com",
	projectId: import.meta.env.VITE_FIREBASE_PROD_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || "matchhome-crm-46de4",
	storageBucket: import.meta.env.VITE_FIREBASE_PROD_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "matchhome-crm-46de4.firebasestorage.app",
	messagingSenderId: import.meta.env.VITE_FIREBASE_PROD_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "73269189317",
	appId: import.meta.env.VITE_FIREBASE_PROD_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || "1:73269189317:web:f90e43bb2806b813ddaeac"
};

const isLocalhost = browser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const activeEnv = import.meta.env.VITE_FIREBASE_ENV || (isLocalhost ? 'dev' : 'prod');

export const isSandbox = activeEnv === 'dev';
export const firebaseConfig = isSandbox ? devConfig : prodConfig;
export const currentProjectId = firebaseConfig.projectId;

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

try {
	if (getApps().length > 0) {
		app = getApp();
	} else {
		app = initializeApp(firebaseConfig);
	}

	if (browser) {
		try {
			db = initializeFirestore(app, {
				localCache: persistentLocalCache({
					tabManager: persistentMultipleTabManager()
				})
			});
		} catch {
			db = getFirestore(app);
		}
	} else {
		db = getFirestore(app);
	}

	auth = getAuth(app);
	storage = getStorage(app);

	if (browser && auth) {
		setPersistence(auth, browserLocalPersistence).catch((err) =>
			console.warn('[Firebase Auth] Persistencia fallback:', err)
		);
	}
} catch (error) {
	console.error('Error inicializando Firebase:', error);
	app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
	db = getFirestore(app);
	auth = getAuth(app);
	storage = getStorage(app);
}

// Storage siempre apunta a Producción para activos de propiedades
let prodStorage: FirebaseStorage;
try {
	if (isSandbox) {
		const prodApps = getApps().filter((a) => a.name === 'prod-storage');
		const prodApp = prodApps.length > 0 ? prodApps[0] : initializeApp(prodConfig, 'prod-storage');
		prodStorage = getStorage(prodApp, `gs://${prodConfig.storageBucket}`);
	} else {
		prodStorage = storage;
	}
} catch {
	prodStorage = storage;
}

export { app, db, auth, storage, prodStorage };
