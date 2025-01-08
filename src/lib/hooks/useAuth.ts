import { onDestroy } from 'svelte'
import { writable, derived, type Readable } from 'svelte/store'
import { auth } from '../firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): {
  user: Readable<User | null>;
  loading: Readable<boolean>;
  error: Readable<string | null>;
  isAuthenticated: Readable<boolean>;
} {
  const { subscribe: userSubscribe, set: setUser } = writable<User | null>(null)
  const { subscribe: loadingSubscribe, set: setLoading } = writable(true)
  const { subscribe: errorSubscribe, set: setError } = writable<string | null>(null)

  const isAuthenticated = derived(
    { subscribe: userSubscribe },
    $user => !!$user
  )

  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      setUser(user)
      setLoading(false)
    },
    (error) => {
      setError(error.message)
      setLoading(false)
    }
  )

  onDestroy(() => unsubscribe())

  return {
    user: { subscribe: userSubscribe },
    loading: { subscribe: loadingSubscribe },
    error: { subscribe: errorSubscribe },
    isAuthenticated
  }
} 