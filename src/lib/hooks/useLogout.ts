import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { writable } from 'svelte/store'
import { goto } from '$app/navigation'
import { userStore } from '../stores/userStore'

function deleteAllCookies() {
  const cookies = document.cookie.split(';')
  
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i]
    const eqPos = cookie.indexOf('=')
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
    
    // Eliminar cookie estableciendo una fecha pasada y múltiples dominios/paths
    document.cookie = name + 
      '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname
    document.cookie = name + 
      '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + window.location.hostname
    document.cookie = name + 
      '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain='
    document.cookie = name + 
      '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
  }
}

export function useLogout() {
  const loading = writable(false)
  const error = writable<string | null>(null)

  const logout = async () => {
    loading.set(true)
    try {
      await signOut(auth)
      
      // Limpiar stores
      userStore.reset()
      
      // Limpiar todo tipo de almacenamiento
      deleteAllCookies()
      localStorage.clear()
      sessionStorage.clear()
      
      // Forzar limpieza de caché de autenticación
      await auth.signOut()
      
      // Redirigir al login
      goto('/login')
    } catch (err) {
      error.set(err.message)
    } finally {
      loading.set(false)
    }
  }

  return {
    logout,
    loading,
    error
  }
}