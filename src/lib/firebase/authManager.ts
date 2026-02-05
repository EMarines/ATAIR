// Gestor de autenticación de Firebase - VERSIÓN SIMPLIFICADA
// Firebase maneja TODA la persistencia automáticamente con browserLocalPersistence
// Este archivo solo escucha cambios de estado y provee funciones auxiliares

import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User
} from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '$lib/firebase_toggle';
import { writable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

// Store para el estado del usuario
export const userStore = writable<User | null>(null);
export const userProfile = writable<any>(null);
export const authInitialized = writable(false);
export const authLoading = writable(true);

// Listener para el perfil del usuario
let profileUnsubscribe: (() => void) | null = null;

/**
 * Inicializa el gestor de autenticación
 * Firebase automáticamente restaura sesiones gracias a browserLocalPersistence
 */
/**
 * Carga o crea el perfil del usuario en Firestore
 */
async function handleUserProfile(user: User) {
  try {
    if (!db) return;

    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      const isAdmin = user.email === 'matchhome@hotmail.com' || user.email === 'marines.enrique@gmail.com'; 
      const newProfile = {
        email: user.email,
        role: isAdmin ? 'admin' : 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        uid: user.uid
      };
      await setDoc(userDocRef, newProfile);
    } else {
      await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
    }

    // Suscribirse a cambios en el perfil
    if (profileUnsubscribe) profileUnsubscribe();
    profileUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        userProfile.set(data);
      }
    });

  } catch (error) {
    console.error('Error en handleUserProfile:', error);
    // Fallback preventivo
    userProfile.set({ role: 'user', email: user.email });
  }
}

/**
 * Inicializa el gestor de autenticación
 */
export async function initializeAuthManager() {
  if (get(authInitialized) || !browser) return;

  if (!auth) {
    console.error('initializeAuthManager: Auth no disponible');
    authLoading.set(false);
    authInitialized.set(true);
    return;
  }

  // Inicializando listener...

  onAuthStateChanged(auth, async (user) => {
    console.log('🔥 [AuthManager] Estado cambiado:', user ? `Usuario: ${user.email}` : 'Sin usuario');
    
    if (profileUnsubscribe) {
      profileUnsubscribe();
      profileUnsubscribe = null;
    }

    if (user) {
      console.log('🔥 [AuthManager] Usuario detectado, actualizando stores...');
      userStore.set(user);
      await handleUserProfile(user);
    } else {
      console.log('🔥 [AuthManager] Usuario nulo (logout o inicial)');
      userStore.set(null);
      userProfile.set(null);
    }
    
    authLoading.set(false);
    authInitialized.set(true);
  });
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
    // Redirigir al login
    goto('/login');
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    
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

