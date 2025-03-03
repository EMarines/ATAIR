import { onDestroy } from 'svelte'
import { writable, derived, type Readable } from 'svelte/store'
import { auth } from '../firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { goto } from '$app/navigation'

export function useAuth(): {
  user: Readable<User | null>;
  loading: Readable<boolean>;
  error: Readable<string | null>;
  isAuthenticated: Readable<boolean>;
  checkAuth: () => Promise<boolean>;
} {
  const { subscribe: userSubscribe, set: setUser } = writable<User | null>(null)
  const { subscribe: loadingSubscribe, set: setLoading } = writable(true)
  const { subscribe: errorSubscribe, set: setError } = writable<string | null>(null)

  const isAuthenticated = derived(
    { subscribe: userSubscribe },
    $user => !!$user
  )

  // Función para verificar el token
  async function checkAuth(): Promise<boolean> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return false;
      }

      // Forzar actualización del token
      const token = await currentUser.getIdToken(true);
      return !!token;
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      return false;
    }
  }

  const unsubscribe = onAuthStateChanged(
    auth,
    async (user) => {
      if (user) {
        try {
          // Verificar token al cambiar el estado de autenticación
          const isValid = await checkAuth();
          if (!isValid) {
            setUser(null);
            setError('Sesión inválida');
            goto('/login');
            return;
          }
        } catch (error) {
          console.error('Error en verificación de token:', error);
        }
      }
      setUser(user);
      setLoading(false);
    },
    (error) => {
      console.error('Error en AuthStateChanged:', error);
      setError(error.message);
      setLoading(false);
    }
  )

  onDestroy(() => unsubscribe())

  return {
    user: { subscribe: userSubscribe },
    loading: { subscribe: loadingSubscribe },
    error: { subscribe: errorSubscribe },
    isAuthenticated,
    checkAuth
  }
} 