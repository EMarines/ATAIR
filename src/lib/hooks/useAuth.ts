import { onDestroy } from 'svelte';
import { writable, derived, type Readable } from 'svelte/store';
import { auth } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

export function useAuth(): {
  user: Readable<User | null>;
  loading: Readable<boolean>;
  error: Readable<string | null>;
  isAuthenticated: Readable<boolean>;
} {
  const { subscribe: userSubscribe, set: setUser } = writable<User | null>(null);
  const { subscribe: loadingSubscribe, set: setLoading } = writable(true);
  const { subscribe: errorSubscribe, set: setError } = writable<string | null>(null);

  const isAuthenticated = derived(
    { subscribe: userSubscribe },
    ($user) => !!$user
  );

  // Escucha cambios en el estado de autenticación
  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      setUser(user);
      setLoading(false);
    },
    (error) => {
      console.error('Error en AuthStateChanged:', error);
      setError(error.message);
      setLoading(false);
    }
  );

  // Limpia el listener al destruir el componente
  onDestroy(() => unsubscribe());

  return {
    user: { subscribe: userSubscribe },
    loading: { subscribe: loadingSubscribe },
    error: { subscribe: errorSubscribe },
    isAuthenticated,
  };
}