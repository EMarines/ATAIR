<script lang="ts">
  // Importaciones
  import { loginWithEmailPassword, firebaseInitialized, firebaseError, initializeFirebase } from '$lib/firebase/firebase';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { writable, get } from 'svelte/store';
  import { onMount } from 'svelte';
  
  // Variables para depuración
  let diagnosticMessages = [];
  let errorMessages = [];
  
  // Creamos stores locales para el formulario
  const email = writable('');
  const password = writable('');
  const isLoading = writable(false);
  const error = writable(null);
  const isRegisterMode = writable(false);
  
  // Referencias a elementos del DOM
  let formElement;
  let emailInput;
  let passwordInput;
  
  // Función para añadir mensajes de diagnóstico
  function addDiagnostic(message) {
    console.log("DIAGNÓSTICO:", message);
    diagnosticMessages = [...diagnosticMessages, message];
  }
  
  // Función para añadir errores
  function addError(message) {
    console.error("ERROR:", message);
    errorMessages = [...errorMessages, message];
  }
  
  onMount(async () => {
    addDiagnostic("Componente montado");
    
    // Inicializamos Firebase explícitamente
    try {
      addDiagnostic("Inicializando Firebase explícitamente");
      const { app, auth } = await initializeFirebase();
      addDiagnostic("Firebase inicializado: " + (!!app && !!auth));
    } catch (e) {
      addError("Error al inicializar Firebase: " + e.message);
    }
    
    // Configuramos valores predeterminados para pruebas
    if (window.location.search.includes('autotest')) {
      addDiagnostic("Modo de prueba automática activado");
      $email = 'matchhome@hotmail.com';
      $password = '12VEntAS12';
    }
  });
  
  // Función simplificada de autenticación que usa nuestro nuevo helper
  async function doAuthentication(emailValue, passwordValue) {
    addDiagnostic("AUTENTICACIÓN INICIADA");
    
    // Verificación básica
    if (!emailValue || !passwordValue) {
      addError("Email y contraseña son obligatorios");
      alert("Por favor ingresa email y contraseña");
      return;
    }
    
    try {
      $isLoading = true;
      $error = null;
      
      addDiagnostic(`Modo: ${$isRegisterMode ? 'REGISTRO' : 'LOGIN'}`);
      addDiagnostic(`Intentando login con: ${emailValue.substring(0, 3)}...`);
      
      // Usar nuestra nueva función de login
      const result = await loginWithEmailPassword(emailValue, passwordValue);
      
      if (result.success) {
        addDiagnostic(`Autenticación exitosa, UID: ${result.user.uid}`);
        
        // Redirigir al usuario
        addDiagnostic("Redirigiendo a página principal");
        setTimeout(async () => {
          try {
            await goto('/');
          } catch (navErr) {
            addError(`Redirección con goto falló: ${navErr}`);
            window.location.href = '/';
          }
        }, 1000);
      } else {
        // Manejar errores
        addError(`Error de autenticación: ${result.code}`);
        alert(`Error: ${result.code}\n${result.message}`);
        $error = { 
          message: getErrorMessage(result.code) || `Error: ${result.message}` 
        };
      }
    } catch (err) {
      addError(`Error general: ${err.message}`);
      alert(`Error general: ${err.message}`);
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
    <form bind:this={formElement} on:submit|preventDefault={() => false} action="javascript:void(0);">
      <h1>{$isRegisterMode ? "Registrarse" : "Login"}</h1>
      
      {#if $error}
        <p class="error">{$error.message}</p>        
      {/if}

      <label>
        <p class={$email ? 'above' : 'center'}>Email</p>
        <input 
          bind:this={emailInput}
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
          bind:this={passwordInput}
          bind:value={$password} 
          type="password" 
          placeholder="Password"
          disabled={$isLoading}
          autocomplete="current-password"
        >
      </label>

      <!-- Botón de login directo simplificado -->
      <button 
        type="button" 
        disabled={$isLoading}
        on:click={() => {
          addDiagnostic("Botón de login clickeado");
          const emailValue = $email || (emailInput ? emailInput.value : '');
          const passwordValue = $password || (passwordInput ? passwordInput.value : '');
          doAuthentication(emailValue, passwordValue);
        }}
      >
        {$isLoading ? 'Procesando...' : 'Iniciar Sesión'}
      </button>
      
      <!-- Botón de prueba directo simplificado -->
      <button 
        type="button" 
        class="test-button"
        disabled={$isLoading}
        on:click={() => {
          addDiagnostic("Botón de prueba clickeado");
          const testEmail = 'matchhome@hotmail.com';
          const testPassword = '12VEntAS12';
          
          // Establecer valores manualmente
          $email = testEmail;
          $password = testPassword;
          if (emailInput) emailInput.value = testEmail;
          if (passwordInput) passwordInput.value = testPassword;
          
          // Intentar autenticar
          doAuthentication(testEmail, testPassword);
        }}
      >
        Login Automático
      </button>

      <!-- Sección de diagnóstico siempre visible -->
      <div class="diagnostic-panel">
        <h3>Información de diagnóstico</h3>
        
        <div class="diagnostic-section">
          <h4>Estado:</h4>
          <ul>
            <li>Firebase inicializado: {$firebaseInitialized}</li>
            <li>Error de Firebase: {$firebaseError ? $firebaseError.message : 'ninguno'}</li>
            <li>En navegador: {browser}</li>
            <li>Formulario cargado: {!!formElement}</li>
          </ul>
        </div>
        
        <div class="diagnostic-section">
          <h4>Mensajes ({diagnosticMessages.length}):</h4>
          <ul>
            {#each diagnosticMessages as msg}
              <li>{msg}</li>
            {/each}
          </ul>
        </div>
        
        <div class="error-section">
          <h4>Errores ({errorMessages.length}):</h4>
          <ul>
            {#each errorMessages as err}
              <li>{err}</li>
            {/each}
          </ul>
        </div>
      </div>
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
  
  .test-button {
    background: #ff3e00;
    margin-top: 0.5rem;
  }

  .options {
    margin-top: 1rem;
    text-align: center;
  }

  .error {
    color: red;
    text-align: center;
  }
  
  .diagnostic-panel {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: rgba(0,0,0,0.1);
    font-size: 0.8rem;
  }
  
  .diagnostic-panel h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
  
  .diagnostic-section {
    margin-bottom: 1rem;
  }
  
  .error-section {
    color: #f44336;
  }
  
  .diagnostic-panel ul {
    margin: 0;
    padding-left: 1.5rem;
  }
</style>
