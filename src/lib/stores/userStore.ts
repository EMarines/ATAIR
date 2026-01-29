import { writable, derived } from 'svelte/store'
import type { User } from 'firebase/auth'
import { auth } from '../firebase'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'
// Eliminamos getIdToken ya que estamos usando el método del objeto user directamente
import { browser } from '$app/environment'

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  tokenRefreshed: boolean;
  lastTokenRefresh: number | null;
}

function createUserStore() {
  const { subscribe, set, update } = writable<UserState>({
    user: null,
    loading: true,
    error: null,
    displayName: null,
    email: null,
    photoURL: null,
    tokenRefreshed: false,
    lastTokenRefresh: null
  })

  // Mejorar el manejo de tokens con mejores estrategias contra errores
  const handleTokenRefresh = async (user: User) => {
    // Solo ejecutar en el navegador
    if (!browser) {
      return {
        tokenRefreshed: false,
        lastTokenRefresh: null
      };
    }
    
    try {
      // Verificar si hace poco se renovó el token para evitar solicitudes excesivas
      const lastRefreshStr = localStorage.getItem('last-token-refresh');
      const now = Date.now();
      
      // Si se refrescó hace menos de 15 minutos, no volver a intentarlo
      if (lastRefreshStr) {
        const lastRefresh = parseInt(lastRefreshStr);
        if (now - lastRefresh < 15 * 60 * 1000) {
          return {
            tokenRefreshed: true,
            lastTokenRefresh: lastRefresh
          };
        }
      }
      
      // Intentar obtener token sin forzar renovación, usando el método del objeto usuario
      const token = await user.getIdToken(false);
      
      // Almacenar el token y actualizar timestamp
      sessionStorage.setItem('firebase-token', token);
      localStorage.setItem('user-logged-in', 'true');
      localStorage.setItem('last-token-refresh', now.toString());
      
      return {
        tokenRefreshed: true,
        lastTokenRefresh: now
      };
    } catch (error) {
      console.error('Error al renovar token en userStore:', error);
      
      // A pesar del error, mantener el estado de autenticación si tenemos usuario
      if (user) {
        localStorage.setItem('user-logged-in', 'true');
        return {
          tokenRefreshed: false,
          lastTokenRefresh: null
        };
      }
      
      return {
        tokenRefreshed: false,
        lastTokenRefresh: null
      };
    }
  };

  // Variable para guardar la función de limpieza
  let unsubscribe = () => {};
  
  // Solo configurar listener en el navegador
  if (browser) {
    unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          // Obtener estado de token
          const tokenState = await handleTokenRefresh(user);
          
          update(state => ({ 
            ...state, 
            user,
            displayName: user?.displayName || null,
            email: user?.email || null,
            photoURL: user?.photoURL || null,
            loading: false,
            tokenRefreshed: tokenState.tokenRefreshed,
            lastTokenRefresh: tokenState.lastTokenRefresh
          }));
        } else {
          // No hay usuario autenticado
          update(state => ({ 
            ...state, 
            user: null,
            displayName: null,
            email: null,
            photoURL: null,
            loading: false,
            tokenRefreshed: false,
            lastTokenRefresh: null
          }));
        }
      },
      (error) => update(state => ({ 
        ...state, 
        error: error.message, 
        loading: false 
      }))
    );
  } else {
    // En servidor, establecer loading a false
    update(state => ({ ...state, loading: false }));
  }

  return {
    subscribe,
    reset: () => set({ 
      user: null, 
      loading: false, 
      error: null,
      displayName: null,
      email: null,
      photoURL: null,
      tokenRefreshed: false,
      lastTokenRefresh: null
    }),
    destroy: () => unsubscribe(),
    // Método para actualizar el displayName
    updateProfile: async (displayName: string) => {
      if (browser && auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName })
          update(state => ({ ...state, displayName }))
        } catch (error) {
          console.error('Error updating profile:', error)
        }
      }
    },
    // Método para refrescar manualmente el token con manejo de errores mejorado
    refreshToken: async () => {
      if (browser && auth.currentUser) {
        try {
          const now = Date.now();
          const lastRefreshStr = localStorage.getItem('last-token-refresh');
          
          // Solo refrescar si no se ha hecho en los últimos 15 minutos
          if (!lastRefreshStr || (now - parseInt(lastRefreshStr) > 15 * 60 * 1000)) {
            const token = await auth.currentUser.getIdToken(false);
            sessionStorage.setItem('firebase-token', token);
            localStorage.setItem('user-logged-in', 'true');
            localStorage.setItem('last-token-refresh', now.toString());
            
            update(state => ({ 
              ...state, 
              tokenRefreshed: true,
              lastTokenRefresh: now
            }));
            return true;
          }
          return true; // Considerar éxito si no fue necesario refrescar
        } catch (error) {
          console.warn('Error al refrescar token manualmente, pero la sesión continúa:', error);
          return true; // Seguir considerando que el usuario está autenticado
        }
      }
      return !!auth.currentUser; // Devolver true si hay usuario, false si no
    }
  }
}

const userStore = createUserStore()
const isAuthenticated = derived(userStore, $store => !!$store.user)
const userLoading = derived(userStore, $store => $store.loading)

export { 
  userStore,
  isAuthenticated,
  userLoading
}
