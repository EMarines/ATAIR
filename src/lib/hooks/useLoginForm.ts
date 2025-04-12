import { writable, derived, get } from 'svelte/store'
import type { LoginFormData, FormState } from '../types/auth.types'
import { auth } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { goto } from '$app/navigation'
import { browser } from '$app/environment'

// Interface para el estado de validación (diagnóstico)
interface ValidationStatus {
  emailValid: boolean;
  passwordValid: boolean;
  passwordsMatch: boolean;
  formComplete: boolean;
}

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

  // Crear un store dedicado para el estado de validación
  const validationStatus = derived(
    [formData, formState],
    ([formData, formState]): ValidationStatus => {
      // Corregido: Simplificar la validación del email para que sea más permisiva
      // Aceptamos cualquier texto que tenga un @ y al menos un punto después
      const isEmailValid = formData.email.includes('@') && formData.email.includes('.');
      
      // Corregido: Simplificar la validación de la contraseña
      const isPasswordValid = formData.password.length > 0;
      
      const passwordsMatch = formData.password === formData.confirmPassword;
      
      if (browser) {
        console.log('Validando formulario:', {
          email: formData.email,
          emailValid: isEmailValid,
          passwordLength: formData.password.length,
          passwordValid: isPasswordValid
        });
      }
      
      return {
        emailValid: isEmailValid,
        passwordValid: isPasswordValid,
        passwordsMatch: passwordsMatch,
        formComplete: formData.email !== '' && formData.password !== ''
      };
    }
  );

  // Validación del formulario con diagnóstico detallado
  const isValid = derived(
    validationStatus,
    ($validationStatus) => {
      const { emailValid, passwordValid, passwordsMatch } = $validationStatus;
      
      // Diagnóstico detallado de la validación
      if (browser) {
        console.log('Estado de validación del formulario:', $validationStatus);
      }

      if (!emailValid || !passwordValid) return false;
      
      const $formState = get(formState);
      if ($formState.isRegisterMode) {
        return passwordsMatch;
      }

      return true;
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
      console.log('Iniciando proceso de autenticación:', $formState.isRegisterMode ? 'Registro' : 'Login');
      
      if ($formState.isRegisterMode) {
        console.log('Intentando crear nuevo usuario con email:', $formData.email);
        await createUserWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        )
      } else {
        console.log('Intentando iniciar sesión con email:', $formData.email);
        await signInWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        )
      }

      console.log('Autenticación exitosa, redirigiendo a la página principal');
      
      // Limpiar formulario y redirigir
      formData.set({ email: '', password: '', confirmPassword: '' })
      goto('/')

    } catch (error: unknown) {
      const err = error as { code: string, message?: string }
      const errorMessage = getAuthErrorMessage(err.code)
      
      console.error('Error de autenticación:', { 
        code: err.code, 
        message: err.message, 
        friendlyMessage: errorMessage 
      });
      
      // Diagnóstico adicional
      if (err.code === 'auth/network-request-failed') {
        console.warn('Posible problema de red o CORS con el dominio. Verifica que el dominio esté autorizado en Firebase Console.');
      }
      
      if (err.code === 'auth/invalid-api-key') {
        console.warn('API Key inválida. Verifica las variables de entorno en Vercel.');
      }
      
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
    toggleMode,
    validationStatus // Exponemos el estado de validación para diagnóstico
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