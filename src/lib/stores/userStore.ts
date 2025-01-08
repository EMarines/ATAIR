import { writable, derived } from 'svelte/store'
import type { User } from 'firebase/auth'
import { auth } from '../firebase'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

function createUserStore() {
  const { subscribe, set, update } = writable<UserState>({
    user: null,
    loading: true,
    error: null,
    displayName: null,
    email: null,
    photoURL: null
  })

  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => update(state => ({ 
      ...state, 
      user,
      displayName: user?.displayName || null,
      email: user?.email || null,
      photoURL: user?.photoURL || null,
      loading: false 
    })),
    (error) => update(state => ({ 
      ...state, 
      error: error.message, 
      loading: false 
    }))
  )

  return {
    subscribe,
    reset: () => set({ 
      user: null, 
      loading: false, 
      error: null,
      displayName: null,
      email: null,
      photoURL: null
    }),
    destroy: () => unsubscribe(),
    // Método para actualizar el displayName
    updateProfile: async (displayName: string) => {
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName })
          update(state => ({ ...state, displayName }))
        } catch (error) {
          console.error('Error updating profile:', error)
        }
      }
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
