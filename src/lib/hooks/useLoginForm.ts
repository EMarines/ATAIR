import { writable, derived, get } from 'svelte/store'
import type { LoginFormData, FormState } from '../types/auth.types'
import { auth } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth'
import { goto } from '$app/navigation'

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

  // Validación del formulario
  const isValid = derived(
    [formData, formState],
    ([formData, formState]) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const isEmailValid = emailRegex.test(formData.email)
      const isPasswordValid = formData.password.length >= 6

      if (!isEmailValid || !isPasswordValid) return false
      
      if (formState.isRegisterMode) {
        return formData.password === formData.confirmPassword
      }

      return true
    }
  )

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
      const err = error as { code: string }
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
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres'
  }

  return errorMessages[code] || 'Ha ocurrido un error'
}