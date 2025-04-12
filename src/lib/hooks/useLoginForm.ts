import { writable, get } from 'svelte/store'
import type { LoginFormData, FormState } from '../types/auth.types'
import { auth } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, // Usando type para importar solo el tipo, no la implementación
  // FirebaseError is imported from firebase/app
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
    isRegisterMode: true    // lo cambié a true de false
  })

  // El botón estará siempre habilitado
  const isValid = writable(true);

  const handleSubmit = async () => {
    console.log("Submit iniciado - Verificando modo actual");
    const $formData = get(formData)
    const $formState = get(formState)
    console.log("Submit iniciado - Verificando modo actual2", $formState);
    
    // Log para verificar el estado antes de proceder
    console.log("Estado del formulario:", { 
      email: $formData.email,
      isRegisterMode: $formState.isRegisterMode,
      confirmPassword: $formData.confirmPassword || 'no establecido'
    });
    
    formState.update(state => ({ 
      ...state, 
      isLoading: true, 
      error: null 
    }))

    try {      
      // Forzamos la verificación de modo de registro basándonos también en confirmPassword
      const isRegistering = $formState.isRegisterMode || !!$formData.confirmPassword;
      console.log("¿Está registrando?", isRegistering);
      
      if (isRegistering) {
        // Modo registro
        console.log("Ejecutando registro con:", $formData.email);
        await createUserWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        );
        console.log("Registro exitoso");
      } else {
        // Modo login
        console.log("Ejecutando login con:", $formData.email);
        await signInWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        );
        console.log("Login exitoso");
      }
      
      // Si llegamos aquí, la autenticación fue exitosa
      formData.set({ email: '', password: '', confirmPassword: '' })
      console.log("Redirigiendo a página principal");
      await goto('/');

    } catch (error) {
      // Tipando correctamente el error
      const err = error as FirebaseError;
      console.error("Error de autenticación:", err);
      
      const errorMessage = getAuthErrorMessage(err.code);
      
      formState.update(state => ({
        ...state,
        error: {
          code: err.code,
          message: errorMessage
        }
      }));
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