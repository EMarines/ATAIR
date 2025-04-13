<script lang="ts">
  // Importaciones
  import { loginWithEmailPassword, initializeFirebase } from '$lib/firebase/firebase';
  import { goto } from '$app/navigation';
  import { writable, get } from 'svelte/store';
  import { onMount } from 'svelte';
  
  // Creamos stores locales para el formulario
  const email = writable('');
  const password = writable('');
  const isLoading = writable(false);
  const error = writable(null);
  const isRegisterMode = writable(false);
  
  onMount(async () => {
    // Inicializamos Firebase explícitamente
    try {
      const { app, auth } = await initializeFirebase();
      console.log("Firebase inicializado correctamente");
    } catch (e) {
      console.error("Error al inicializar Firebase:", e.message);
    }
  });
  
  // Función simplificada de autenticación que usa nuestro nuevo helper
  async function doAuthentication(emailValue, passwordValue) {
    // Verificación básica
    if (!emailValue || !passwordValue) {
      $error = { message: "Por favor ingresa email y contraseña" };
      return;
    }
    
    try {
      $isLoading = true;
      $error = null;
      
      // Usar nuestra función de login
      const result = await loginWithEmailPassword(emailValue, passwordValue);
      
      if (result.success) {
        console.log("Autenticación exitosa");
        
        // Redirigir al usuario
        setTimeout(async () => {
          try {
            await goto('/');
          } catch (navErr) {
            console.error("Error en redirección:", navErr);
            window.location.href = '/';
          }
        }, 500);
      } else {
        // Manejar errores
        $error = { 
          message: getErrorMessage(result.code) || `Error: ${result.message}` 
        };
      }
    } catch (err) {
      console.error("Error general:", err.message);
      $error = { message: `Error general: ${err.message}` };
    } finally {
      $isLoading = false;
    }
  }
  
  // Función para cambiar entre login y registro
  function toggleMode() {
    $isRegisterMode = !$isRegisterMode;
    $error = null;
  }
  
  // Función auxiliar para traducir mensajes de error
  function getErrorMessage(code: string): string {
    const errorMessages: {[key: string]: string} = {
      'auth/email-already-in-use': 'Este email ya está registrado',
      'auth/invalid-email': 'Email inválido',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
      'auth/network-request-failed': 'Error de red. Verifica tu conexión',
      'auth/unauthorized-domain': 'Este dominio no está autorizado para operaciones de Firebase'
    };
    
    return errorMessages[code] || `Error desconocido (${code})`;
  }
</script>

<div class="container">
  <div class="authContainer">  
    <form on:submit|preventDefault={() => doAuthentication($email, $password)}>
      <h1>{$isRegisterMode ? "Registrarse" : "Login"}</h1>
      
      {#if $error}
        <p class="error">{$error.message}</p>        
      {/if}

      <label>
        <p class={$email ? 'above' : 'center'}>Email</p>
        <input 
          bind:value={$email} 
          type="email" 
          placeholder="email"
          disabled={$isLoading}
          autocomplete="email"
        >
      </label>

      <label>
        <p class={$password ? 'above' : 'center'}>Password</p>
        <input
          bind:value={$password} 
          type="password" 
          placeholder="Password"
          disabled={$isLoading}
          autocomplete="current-password"
        >
      </label>

      <!-- Botón de login -->
      <button 
        type="submit" 
        disabled={$isLoading}
      >
        {$isLoading ? 'Procesando...' : 'Iniciar Sesión'}
      </button>
    </form>

    <div class="options">
      {#if $isRegisterMode}
        <div>
          <p>¿Tienes Cuenta?</p>
          <button on:click={toggleMode}>Login</button>
        </div>
      {:else}
        <div>
          <p>¿No Tienes Cuenta?</p>
          <button on:click={toggleMode}>Registrate</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .authContainer {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: transparent;
    color: white;
  }

  button {
    padding: 0.5rem;
    background: blue;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .options {
    margin-top: 1rem;
    text-align: center;
  }

  .error {
    color: red;
    text-align: center;
  }
</style>
