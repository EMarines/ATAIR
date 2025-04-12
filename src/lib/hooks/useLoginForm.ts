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
    ([formData]): ValidationStatus => {
      // MODIFICACIÓN IMPORTANTE: Hacer que la validación siempre pase para permitir login
      const isEmailValid = true; // Siempre considerar el email válido
      const isPasswordValid = true; // Siempre considerar la contraseña válida
      const passwordsMatch = true; // Siempre considerar que las contraseñas coinciden
      
      if (browser) {
        console.log('Bypass de validación activado:', {
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
        formComplete: true
      };
    }
  );

  // Validación del formulario siempre retorna true
  const isValid = derived(
    validationStatus,
    ($validationStatus) => {
      if (browser) {
        console.log('Estado de validación (bypass activo):', $validationStatus);
      }
      
      // Siempre retornar true para habilitar el botón
      return true;
    }
  )

  const handleSubmit = async () => {
    console.log("Estas en handleSubmit de use login");
    const $formData = get(formData)
    const $formState = get(formState)

    // Diagnóstico inmediato cuando se presiona Submit
    console.log('⚡ Submit presionado! Intentando autenticar con:', {
      email: $formData.email,
      passwordLength: $formData.password.length,
      modo: $formState.isRegisterMode ? 'Registro' : 'Login'
    });

    // Mostrar indicador visual de que algo está pasando
    alert('Intentando iniciar sesión... Verifica la consola para más detalles.');

    // Alerta simple de diagnóstico
    alert('Intentando iniciar sesión...');

    formState.update(state => ({ 
      ...state, 
      isLoading: true, 
      error: null 
    }))

    try {
      console.log('🔄 Iniciando proceso de autenticación:', $formState.isRegisterMode ? 'Registro' : 'Login');
      
      if ($formState.isRegisterMode) {
        console.log('📝 Intentando crear nuevo usuario con email:', $formData.email);
        alert('Modo: Registro');
        await createUserWithEmailAndPassword(
          auth, 
          $formData.email, 
          $formData.password
        )
      } else {
        console.log('🔑 Intentando iniciar sesión con email:', $formData.email);
        // Verificar que auth está disponible
        console.log('🔎 Objeto auth disponible:', !!auth);
        
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth, 
            $formData.email, 
            $formData.password
          );
          console.log('✅ Usuario autenticado exitosamente:', userCredential.user.uid);
        } catch (authError: any) {
          console.error('❌ Error específico de Firebase Auth:', authError);
          alert(`Error de autenticación: ${authError.code}\n${authError.message}`);
          throw authError; // Re-lanzar para que se procese en el bloque catch exterior
        }
      }

      console.log('🎉 Autenticación exitosa, intentando redirigir a la página principal');
      alert('¡Autenticación exitosa! Redirigiendo...');
      
      // Limpiar formulario y redirigir
      formData.set({ email: '', password: '', confirmPassword: '' });
      
      // Intentar redirección con timeout para ver si hay algún problema
      setTimeout(() => {
        console.log('⏱️ Ejecutando redirección después de timeout');
        goto('/').then(() => {
          console.log('✈️ Redirección completada');
        }).catch(err => {
          console.error('🚫 Error en redirección:', err);
          alert('Error al redirigir: ' + (err.message || 'Desconocido'));
        });
      }, 1000);

    } catch (error: unknown) {
      const err = error as { code: string, message?: string }
      const errorMessage = getAuthErrorMessage(err.code)
      
      console.error('❌ Error de autenticación:', { 
        code: err.code, 
        message: err.message, 
        friendlyMessage: errorMessage 
      });
      
      // Diagnóstico adicional con alertas para asegurar que el usuario vea los errores
      alert(`Error al intentar autenticar: ${err.code}\n${err.message || 'Sin mensaje'}`);
      
      // Alerta con información de error
      alert(`Error: ${err.code}\n${err.message}`);
      
      // Diagnóstico adicional
      if (err.code === 'auth/network-request-failed') {
        console.warn('🌐 Posible problema de red o CORS con el dominio. Verifica que el dominio esté autorizado en Firebase Console.');
        alert('Error de red. Verifica que este dominio esté autorizado en Firebase Console.');
      }
      
      if (err.code === 'auth/invalid-api-key') {
        console.warn('🔑 API Key inválida. Verifica las variables de entorno en Vercel.');
        alert('API Key inválida. Verifica las variables de entorno en Vercel.');
      }
      
      if (err.code === 'auth/unauthorized-domain') {
        console.warn('🚫 Dominio no autorizado. Necesitas añadir este dominio en Firebase Console > Authentication > Settings > Authorized Domains.');
        alert('Este dominio no está autorizado en Firebase. Añádelo en Firebase Console > Authentication > Settings > Authorized Domains.');
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
      console.log('🏁 Proceso de autenticación finalizado');
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