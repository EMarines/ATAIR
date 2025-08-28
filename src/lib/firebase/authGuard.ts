// Guard de autenticación para proteger rutas
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { userStore, authInitialized } from './authManager';

/**
 * Protege una ruta verificando si el usuario está autenticado
 * Redirige al login si no está autenticado
 */
export async function requireAuth(): Promise<boolean> {
  // Solo ejecutar en el navegador
  if (!browser) return true;

  // Esperar a que la autenticación esté inicializada
  return new Promise((resolve) => {
    const checkAuth = () => {
      const user = get(userStore);
      const initialized = get(authInitialized);

      if (initialized) {
        if (user) {
          resolve(true);
        } else {
          console.warn('⚠️ Acceso no autorizado, redirigiendo al login...');
          goto('/login');
          resolve(false);
        }
      } else {
        // Si no está inicializado, esperar un poco más
        setTimeout(checkAuth, 100);
      }
    };

    checkAuth();
  });
}

/**
 * Verifica si el usuario ya está autenticado (para páginas como login)
 * Redirige al home si ya está autenticado
 */
export function redirectIfAuthenticated() {
  if (!browser) return;

  const unsubscribe = userStore.subscribe(user => {
    if (user) {
      console.log('👤 Usuario ya autenticado, redirigiendo al home...');
      goto('/');
    }
  });

  // Cleanup después de 5 segundos para evitar memory leaks
  setTimeout(() => {
    unsubscribe();
  }, 5000);
}
