import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { app, db, auth } from './init';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword // <-- Importado para el registro
} from 'firebase/auth';

// Store para controlar qué base de datos usamos
const createDbToggleStore = () => {
  const initialValue = browser ?
    localStorage.getItem('useTestDb') === 'true' :
    false;

  const { subscribe, update } = writable<boolean>(initialValue);

  return {
    subscribe,
    toggle: () => {
      update(value => {
        const newValue = !value;
        if (browser) {
          localStorage.setItem('useTestDb', String(newValue));
          window.location.reload();
        }
        return newValue;
      });
    }
  };
};

export const useTestDb = createDbToggleStore();
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

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user, error: null, code: null, message: null }; // Añadido code y message null para consistencia
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error,
      code: error.code, // Código de error de Firebase
      message: error.message // Mensaje de error de Firebase
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

    const userCredential = await createUserWithEmailAndPassword(auth, email, password); // <-- Usa la función de registro
    return { success: true, user: userCredential.user, error: null, code: null, message: null }; // Añadido code y message null para consistencia
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error,
      code: error.code, // <-- Asegúrate de devolver el código de error
      message: error.message // <-- Y el mensaje
    };
  }
}

// Removed redundant initialization logic

export { app, db, auth };
