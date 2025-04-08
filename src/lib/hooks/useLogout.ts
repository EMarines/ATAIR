import { writable } from 'svelte/store'
import { goto } from '$app/navigation'
import { userStore } from '../stores/userStore'
import { authService } from '../services/authService'
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
      // Usar el servicio centralizado para logout
      await authService.logout()
      
      // Limpiar stores
      userStore.reset()
      
      // Limpiar todo tipo de almacenamiento si estamos en el navegador
      if (browser) {
        deleteAllCookies()
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Redirigir al login
      goto('/login')
    } catch (err: unknown) {
      // Manejar el error de tipo unknown de manera segura
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