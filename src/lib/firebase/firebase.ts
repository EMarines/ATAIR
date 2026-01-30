import { writable } from 'svelte/store';
import { app, db, auth } from '$lib/firebase_toggle';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

// Importamos useTestDb desde firebase_toggle.ts en lugar de definirlo aquí
import { useTestDb } from '$lib/firebase_toggle';

// Re-exportamos para mantener compatibilidad
export { useTestDb };
export const firebaseInitialized = writable(false);

// Variables para las instancias
// Removed redundant initialization logic

// Removed initializeFirebase function and related code

// Función de ayuda para la autenticación (Login)
export async function loginWithEmailPassword(email: string, password: string) {
  try {
    // Asegurarse de que Firebase esté inicializado
    if (!auth) {
      throw new Error("No se pudo inicializar Firebase Auth");
    }

    // CRÍTICO: Configurar persistencia ANTES del login
    await setPersistence(auth, browserLocalPersistence);

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user, error: null, code: null, message: null };
  } catch (error) {
    console.error('Error en login:', error);
    return {
      success: false,
      user: null,
      error: error,
      code: error.code,
      message: error.message
    };
  }
}

// Función de ayuda para el registro
export async function registerWithEmailPassword(email: string, password: string) {
  try {
    // Asegurarse de que Firebase esté inicializado
    if (!auth) {
      throw new Error("No se pudo inicializar Firebase Auth");
    }

    // CRÍTICO: Configurar persistencia ANTES del registro
    await setPersistence(auth, browserLocalPersistence);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user, error: null, code: null, message: null };
  } catch (error) {
    console.error('Error en registro:', error);
    return {
      success: false,
      user: null,
      error: error,
      code: error.code,
      message: error.message
    };
  }
}

// Removed redundant initialization logic

export { app, db, auth };
