import { userStore, userProfile } from '../firebase/authManager'
import { derived } from 'svelte/store'

export function useUser() {
  const isAuthenticated = derived(userStore, $user => !!$user)
  const isAdmin = derived(userProfile, $profile => $profile?.role === 'admin')

  return {
    userStore,
    userProfile,
    isAuthenticated,
    isAdmin
  }
} 