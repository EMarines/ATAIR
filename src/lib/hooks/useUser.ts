import { userStore } from '../stores/userStore'
import { derived } from 'svelte/store'

export function useUser() {
  const isAuthenticated = derived(userStore, $store => !!$store.user)

  return {
    userStore,
    isAuthenticated
  }
} 