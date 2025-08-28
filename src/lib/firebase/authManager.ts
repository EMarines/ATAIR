// Gestor de autenticación de Firebase con manejo de tokens
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '$lib/firebase_toggle';
import { writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

// Store para el estado del usuario
export const userStore = writable(null);
export const authInitialized = writable(false);

// Variable para rastrear si el usuario está autenticado
let isAuthenticated = false;

/**
 * Inicializa el gestor de autenticación
 * Configura la persistencia y escucha cambios de estado
 */
export async function initializeAuthManager() {
  try {
    // Solo ejecutar en el navegador
    if (!browser || !auth) {
      console.log('⚠️ Auth no disponible o no estamos en el navegador');
      authInitialized.set(true);
      return;
    }

    console.log('🔄 Inicializando gestor de autenticación...');

    // Escuchar cambios en el estado de autenticación
    onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Estado de autenticación cambió:', user ? user.email : 'No autenticado');
      
      if (user) {
        isAuthenticated = true;
        
        // Actualizar store del usuario
        userStore.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        });

        console.log('✅ Usuario autenticado:', user.email);
        
      } else {
        isAuthenticated = false;
        userStore.set(null);
        console.log('👋 Usuario no autenticado');
      }
      
      authInitialized.set(true);
    });

  } catch (error) {
    console.error('❌ Error inicializando gestor de autenticación:', error);
    authInitialized.set(true); // Marcar como inicializado aunque haya error
  }
}

/**
 * Maneja errores relacionados con tokens
 */
function handleTokenError(error: Error | { code?: string; message?: string }) {
  console.error('Token error details:', error);
  
  // Códigos de error comunes de tokens
  const errorCode = 'code' in error ? error.code : undefined;
  const errorMessage = error.message || '';
  
  if (errorCode === 'auth/user-token-expired' || 
      errorCode === 'auth/invalid-user-token' ||
      errorMessage.includes('403') ||
      errorMessage.includes('token')) {
    
    console.warn('⚠️ Token expirado o inválido, cerrando sesión...');
    handleLogout();
  }
}

/**
 * Verifica si el usuario está autenticado y obtiene un token válido
 */
export async function ensureValidToken() {
  if (!auth?.currentUser) {
    throw new Error('Usuario no autenticado');
  }

  try {
    // Obtener token sin forzar renovación inicialmente
    const token = await auth.currentUser.getIdToken(false);
    return token;
  } catch (error) {
    console.warn('⚠️ Token no válido, el usuario será desconectado');
    handleTokenError(error);
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
 */
export function checkPersistedSession() {
  return new Promise((resolve) => {
    if (!browser || !auth) {
      resolve(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Solo necesitamos verificar una vez
      if (user) {
        console.log('🔄 Sesión persistente encontrada:', user.email);
        resolve(user);
      } else {
        console.log('👤 No hay sesión persistente');
        resolve(null);
      }
    });
  });
}

/**
 * Verifica si el usuario está autenticado
 */
export function isUserAuthenticated(): boolean {
  return isAuthenticated && auth?.currentUser !== null;
}

/**
 * Hook para components que necesitan autenticación
 */
export function requireAuth() {
  if (!isUserAuthenticated()) {
    console.warn('⚠️ Acceso no autorizado, redirigiendo al login...');
    goto('/login');
    return false;
  }
  return true;
}
