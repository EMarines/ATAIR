import { writable, derived, get } from 'svelte/store'
import type { LoginFormData, FormState } from '../types/auth.types'
import { auth } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { goto } from '$app/navigation'
import { browser } from '$app/environment'

export function useLoginForm() {
  const formData = writable<LoginFormData>({
    email: '',
    password: '',
    confirmPassword: ''
  })

  const formState = writable<FormState>({
    isLoading: false,
    error: null,
    isRegisterMode: false
  })

  // El botón estará siempre habilitado
  const isValid = writable(true);

  const handleSubmit = async () => {
    const $formData = get(formData)
    const $formState = get(formState)

    formState.update(state => ({ 
      ...state, 
      isLoading: true, 
      error: null 
    }))

    try {
      if ($formState.isRegisterMode) {
        await createUserWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        )
      } else {
        await signInWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        )
      }
      
      // Limpiar formulario y redirigir
      formData.set({ email: '', password: '', confirmPassword: '' })
      goto('/')

    } catch (error: unknown) {
      const err = error as { code: string, message?: string }
      const errorMessage = getAuthErrorMessage(err.code)
      
      formState.update(state => ({
        ...state,
        error: {
          code: err.code,
          message: errorMessage
        }
      }))
    } finally {
      formState.update(state => ({ 
        ...state, 
        isLoading: false 
      }))
    }
  }

  const toggleMode = () => {
    formState.update(state => ({
      ...state,
      isRegisterMode: !state.isRegisterMode,
      error: null
    }))
    formData.update(data => ({
      ...data,
      password: '',
      confirmPassword: ''
    }))
  }

  return {
    formData,
    formState,
    isValid,
    handleSubmit,
    toggleMode
  }
}

// Función auxiliar para mensajes de error
function getAuthErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'Este email ya está registrado',
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/network-request-failed': 'Error de red. Verifica tu conexión',
    'auth/invalid-api-key': 'Error de configuración. API Key inválida',
    'auth/app-deleted': 'La instancia de Firebase fue eliminada',
    'auth/invalid-user-token': 'Su sesión expiró. Por favor inicie sesión nuevamente',
    'auth/unauthorized-domain': 'Este dominio no está autorizado para operaciones de Firebase',
  }

  return errorMessages[code] || `Error desconocido (${code})`
}