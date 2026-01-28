// Gestor de autenticación de Firebase - VERSIÓN SIMPLIFICADA
// Firebase maneja TODA la persistencia automáticamente con browserLocalPersistence
// Este archivo solo escucha cambios de estado y provee funciones auxiliares

import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '$lib/firebase_toggle';
import { writable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

// Store para el estado del usuario
export const userStore = writable<any>(null);
export const authInitialized = writable(false);
export const authLoading = writable(true);

/**
 * Inicializa el gestor de autenticación
 * Firebase automáticamente restaura sesiones gracias a browserLocalPersistence
 */
export async function initializeAuthManager() {
  try {
    // Solo ejecutar en el navegador
    if (!browser || !auth) {
      console.log('⚠️ Auth no disponible o no estamos en el navegador');
      authLoading.set(false);
      authInitialized.set(true);
      return;
    }

    console.log('🔄 Inicializando gestor de autenticación...');

    // Escuchar cambios en el estado de autenticación
    // Firebase AUTOMÁTICAMENTE restaura la sesión si existe
    onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Estado de autenticación cambió:', user ? user.email : 'No autenticado');
      
      if (user) {
        // Actualizar store del usuario con datos básicos
        userStore.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          photoURL: user.photoURL
        });

        console.log('✅ Usuario autenticado:', user.email);
      } else {
        userStore.set(null);
        console.log('👋 Usuario no autenticado');
      }
      
      authLoading.set(false);
      authInitialized.set(true);
    });

  } catch (error) {
    console.error('❌ Error inicializando gestor de autenticación:', error);
    authLoading.set(false);
    authInitialized.set(true);
  }
}

/**
 * Verifica si el usuario está autenticado y obtiene un token válido
 * Firebase maneja la renovación de tokens automáticamente
 */
export async function ensureValidToken() {
  if (!auth?.currentUser) {
    throw new Error('Usuario no autenticado');
  }

  try {
    // Firebase renueva el token automáticamente si es necesario
    const token = await auth.currentUser.getIdToken(false);
    return token;
  } catch (error) {
    console.warn('⚠️ Token no válido, el usuario será desconectado');
    throw error;
  }
}

/**
 * Cierra la sesión del usuario
 */
export async function handleLogout() {
  try {
    await signOut(auth);
    console.log('👋 Sesión cerrada exitosamente');
    
    // Redirigir al login
    goto('/login');
  } catch (error) {
    console.error('❌ Error cerrando sesión:', error);
    
    // Forzar limpieza manual si falla el signOut
    userStore.set(null);
    goto('/login');
  }
}

/**
 * Verifica si hay una sesión persistente y la restaura
 * NOTA: Esto ya NO es necesario - Firebase lo hace automáticamente
 * Se mantiene solo por compatibilidad con código existente
 */
export function checkPersistedSession() {
  return new Promise((resolve) => {
    if (!browser || !auth) {
      resolve(null);
      return;
    }

    // Firebase ya restauró la sesión automáticamente via onAuthStateChanged
    // Solo devolvemos el usuario actual
    resolve(auth.currentUser);
  });
}

/**
 * Verifica si el usuario está autenticado
 */
export function isUserAuthenticated(): boolean {
  return auth?.currentUser !== null;
}

/**
 * Hook para components que necesitan autenticación
 * Espera a que la autenticación esté inicializada antes de verificar
 */
export async function requireAuth() {
  if (!browser) return true;

  // Si no está inicializado, esperamos a que el store authInitialized cambie a true
  if (!get(authInitialized)) {
    await new Promise<void>((resolve) => {
      const unsubscribe = authInitialized.subscribe((val) => {
        if (val) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  if (!isUserAuthenticated()) {
    console.warn('⚠️ Acceso no autorizado, redirigiendo al login...');
    goto('/login');
    return false;
  }
  return true;
}

/**
 * Función de ayuda para el login con email y contraseña
 * La persistencia ya está configurada en la inicialización
 */
export async function loginWithEmailPassword(email: string, password: string) {
    try {
        if (!auth) {
            throw new Error("No se pudo inicializar Firebase Auth");
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Login exitoso');
        return { success: true, user: userCredential.user, error: null, code: null, message: null };
    } catch (error: any) {
        console.error('❌ Error en login:', error);
        return {
            success: false,
            user: null,
            error: error,
            code: error.code,
            message: error.message
        };
    }
}

/**
 * Función de ayuda para el registro con email y contraseña
 * La persistencia ya está configurada en la inicialización
 */
export async function registerWithEmailPassword(email: string, password: string) {
    try {
        if (!auth) {
            throw new Error("No se pudo inicializar Firebase Auth");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Registro exitoso');
        return { success: true, user: userCredential.user, error: null, code: null, message: null };
    } catch (error: any) {
        console.error('❌ Error en registro:', error);
        return {
            success: false,
            user: null,
            error: error,
            code: error.code,
            message: error.message
        };
    }
}

