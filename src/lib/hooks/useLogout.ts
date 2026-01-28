import { writable } from 'svelte/store'
import { handleLogout } from '../firebase/authManager'
import { browser } from '$app/environment'

// Función auxiliar para eliminar todas las cookies
function deleteAllCookies() {
  if (!browser) return;
  
  const cookies = document.cookie.split(";");
  
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  }
}

export function useLogout() {
  const loading = writable(false)
  const error = writable<string | null>(null)

  const logout = async () => {
    loading.set(true)
    try {
      if (browser) {
        deleteAllCookies()
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Usar el gestor unificado para el signOut de Firebase
      await handleLogout()
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        error.set(err.message)
      } else {
        error.set('Error desconocido durante el cierre de sesión')
      }
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