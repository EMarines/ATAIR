import { onDestroy } from 'svelte'; 
import { writable, derived, type Readable } from 'svelte/store';
import { auth } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth'; // Eliminamos getIdTokenResult
import { browser } from '$app/environment';

// Tiempo en milisegundos para verificar la sesión (cada 30 minutos)
const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000; 

export function useAuth(): {
  user: Readable<User | null>;
  loading: Readable<boolean>;
  error: Readable<string | null>;
  isAuthenticated: Readable<boolean>;
  checkAuth: () => Promise<boolean>;
} {
  const { subscribe: userSubscribe, set: setUser } = writable<User | null>(null);
  const { subscribe: loadingSubscribe, set: setLoading } = writable(true);
  const { subscribe: errorSubscribe, set: setError } = writable<string | null>(null);

  const isAuthenticated = derived(
    { subscribe: userSubscribe },
    ($user) => !!$user
  );
  
  // Referencia al intervalo de verificación de token
  let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

  // Verificar token y configurar renovación periódica con menos frecuencia
  const setupTokenRefresh = (user: User | null) => {
    // Verificar si estamos en el navegador
    if (!browser) return;
    
    // Limpiar intervalo anterior si existe
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
    
    // Si hay un usuario, configurar renovación de token con manejo de errores mejorado
    if (user) {
      // Intentar obtener un token solo si es necesario
      const lastRefresh = localStorage.getItem('last-token-refresh');
      const now = Date.now();
      
      if (!lastRefresh || (now - parseInt(lastRefresh)) > 30 * 60 * 1000) {
        // Solo intentar renovar si han pasado más de 30 minutos desde la última renovación
        user.getIdToken(false) // false para no forzar renovación
          .then(token => {
            if (browser) {
              sessionStorage.setItem('firebase-token', token);
              localStorage.setItem('last-token-refresh', now.toString());
            }
          })
          .catch(err => {
            console.error('Error al renovar token inicial, pero la sesión sigue activa:', err.code || err.message);
            // No interrumpir el flujo por errores de token
          });
      }
        
      // Configurar verificación periódica del token pero con mucha menos frecuencia
      tokenRefreshInterval = setInterval(async () => {
        if (auth.currentUser) {
          try {
            const now = Date.now();
            const lastRefresh = localStorage.getItem('last-token-refresh');
            
            // Solo intentar renovar si han pasado más de 30 minutos
            if (!lastRefresh || (now - parseInt(lastRefresh)) > 30 * 60 * 1000) {
              const newToken = await auth.currentUser.getIdToken(false);
              sessionStorage.setItem('firebase-token', newToken);
              localStorage.setItem('last-token-refresh', now.toString());
              console.log('Token renovado periódicamente');
            }
          } catch (error) {
            // Manejar el error de manera silenciosa para no interrumpir la experiencia
            console.warn('Error en verificación periódica de token, pero la sesión continúa:', 
                        error instanceof Error ? error.message : 'Error desconocido');
          }
        }
      }, SESSION_REFRESH_INTERVAL);
    }
  };

  // Escucha cambios en el estado de autenticación solo en el navegador
  let unsubscribe = () => {};
  
  if (browser) {
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setLoading(false);
        setupTokenRefresh(user);
      },
      (error) => {
        console.error('Error en AuthStateChanged:', error);
        setError(error.message);
        setLoading(false);
      }
    );
  } else {
    // En el servidor, simplemente establecemos loading a false
    setLoading(false);
  }

  // Función para verificar estado de autenticación manualmente sin forzar token
  const checkAuth = async (): Promise<boolean> => {
    if (!browser) return false;
    
    // Si tenemos usuario en auth, considerarlo válido sin forzar renovación de token
    if (auth.currentUser) {
      return true;
    }
    
    // Si tenemos marca de usuario logueado en localStorage, también considerarlo válido
    if (localStorage.getItem('user-logged-in') === 'true') {
      return true;
    }
    
    return false;
  };

  // Limpia el listener y el intervalo al destruir el componente
  onDestroy(() => {
    unsubscribe();
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
    }
  });

  return {
    user: { subscribe: userSubscribe },
    loading: { subscribe: loadingSubscribe },
    error: { subscribe: errorSubscribe },
    isAuthenticated,
    checkAuth
  };
}