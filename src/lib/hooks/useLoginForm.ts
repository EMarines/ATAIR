import { writable, get } from 'svelte/store'
import type { LoginFormData, FormState } from '../types/auth.types'
import { auth } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { goto } from '$app/navigation'
// import { browser } from '$app/environment'

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
    console.log("Estas en la funcion de useLoginForm", get(formData), get(formState));
    const $formData = get(formData)
    const $formState = get(formState)
    console.log("Estas en la funcion de useLoginForm 2", $formData, $formState);

    // Verificar que auth está correctamente inicializado
    console.log("Estado de auth:", auth ? "Disponible" : "No disponible", auth);

    formState.update(state => ({ 
      ...state, 
      isLoading: true, 
      error: null 
    }))
    console.log("Estado actualizado a isLoading=true");

    try {
      console.log("Entrando al bloque try");
      
      if ($formState.isRegisterMode) {
        console.log("Intentando registro con:", $formData.email);
        await createUserWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        )
        console.log("Registro exitoso");
      } else {
        console.log("Intentando login con:", $formData.email);
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth, 
            $formData.email, 
            $formData.password
          );
          console.log("Login exitoso, usuario:", userCredential.user.uid);
        } catch (loginError: any) {
          console.error("Error específico de login:", loginError.code, loginError.message);
          throw loginError; // Re-lanzar para que sea manejado por el catch exterior
        }
      }
      
      console.log("Autenticación exitosa, preparando redirección");
      // Limpiar formulario y redirigir
      formData.set({ email: '', password: '', confirmPassword: '' })
      
      try {
        console.log("Iniciando redirección a '/'");
        await goto('/');
        console.log("Redirección completada");
      } catch (navError: any) {
        console.error("Error en la redirección:", navError);
      }

    } catch (error: unknown) {
      const err = error as { code: string, message?: string }
      const errorMessage = getAuthErrorMessage(err.code)
      
      console.error("Error capturado:", err.code, err.message, errorMessage);
      
      formState.update(state => ({
        ...state,
        error: {
          code: err.code,
          message: errorMessage
        }
      }))
      console.log("Estado actualizado con error:", err.code);
    } finally {
      formState.update(state => ({ 
        ...state, 
        isLoading: false 
      }))
      console.log("Proceso finalizado, isLoading=false");
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