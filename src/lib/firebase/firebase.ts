import { writable } from 'svelte/store';
import { app, db, auth } from '$lib/firebase_toggle';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

export const firebaseInitialized = writable(false);

// Función de ayuda para la autenticación (Login)
export async function loginWithEmailPassword(email: string, password: string) {
  try {
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

export { app, db, auth };
