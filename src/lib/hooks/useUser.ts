import { userStore } from '../firebase/authManager'
import { derived } from 'svelte/store'

export function useUser() {
  const isAuthenticated = derived(userStore, $user => !!$user)

  return {
    userStore,
    isAuthenticated
  }
} 