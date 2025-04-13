<script lang="ts">
  // Importaciones
  import { auth } from '$lib/firebase';
  import { signInWithEmailAndPassword, createUserWithEmailAndPassword, browserLocalPersistence, setPersistence, getAuth, initializeAuth } from 'firebase/auth';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { writable, get } from 'svelte/store';
  import { onMount, afterUpdate } from 'svelte';
  import { app } from '$lib/firebase/firebase';
  
  // Variables para depuración
  let isSubmitClicked = false;
  let testButtonClicked = false;
  let firebaseInitialized = false;
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
  
  onMount(() => {
    addDiagnostic("Componente montado");
    addDiagnostic("Auth disponible: " + (!!auth));
    addDiagnostic("App disponible: " + (!!app));
    addDiagnostic("Ejecutándose en navegador: " + browser);
    
    try {
      addDiagnostic("Intentando configurar persistencia de autenticación");
      const authInstance = auth || getAuth(app);
      if (authInstance) {
        setPersistence(authInstance, browserLocalPersistence)
          .then(() => {
            addDiagnostic("Persistencia configurada correctamente");
            firebaseInitialized = true;
          })
          .catch((error) => {
            addError("Error al configurar persistencia: " + error.message);
          });
      } else {
        addError("No se pudo obtener una instancia de auth");
      }
    } catch (e) {
      addError("Error al intentar configurar Firebase: " + e.message);
    }
    
    // Configurar listener directo del DOM
    if (formElement) {
      addDiagnostic("Configurando listener directo del DOM para el formulario");
      formElement.addEventListener('submit', function(e) {
        addDiagnostic("Evento submit capturado directamente por el DOM");
        e.preventDefault();
        handleFormSubmit(e);
        return false;
      });
    } else {
      addError("No se pudo acceder al elemento del formulario");
    }
    
    // Configuramos valores predeterminados para pruebas
    if (window.location.search.includes('autotest')) {
      addDiagnostic("Modo de prueba automática activado");
      $email = 'matchhome@hotmail.com';
      $password = '12VEntAS12';
    }
  });
  
  afterUpdate(() => {
    // Verificar si tenemos referencias a los elementos del DOM después de la actualización
    if (!formElement) {
      addError("Formulario no disponible después de update");
    }
  });
  
  // Manejadores de formulario
  function handleFormSubmit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    addDiagnostic("Formulario enviado mediante manejador");
    isSubmitClicked = true;
    
    // Usar valores directamente de los inputs del DOM como respaldo
    const emailValue = emailInput ? emailInput.value : get(email);
    const passwordValue = passwordInput ? passwordInput.value : get(password);
    
    addDiagnostic(`Intentando autenticar con: ${emailValue.substring(0, 3)}...`);
    
    doAuthentication(emailValue, passwordValue);
    return false;
  }
  
  function handleTestButtonClick() {
    testButtonClicked = true;
    addDiagnostic("Botón de prueba presionado");
    
    // Establecemos valores directamente
    const testEmail = 'matchhome@hotmail.com';
    const testPassword = '12VEntAS12';
    
    if (emailInput) emailInput.value = testEmail;
    if (passwordInput) passwordInput.value = testPassword;
    
    $email = testEmail;
    $password = testPassword;
    
    addDiagnostic(`Intentando autenticar con credenciales de prueba`);
    doAuthentication(testEmail, testPassword);
  }
  
  // Función alternativa de autenticación que intenta diferentes métodos
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
      
      // Intentar diferentes métodos de autenticación
      let success = false;
      let errorMsg = null;
      
      // Método 1: Usando la instancia de auth existente
      if (auth && !success) {
        addDiagnostic("Intentando método 1: Auth preconfigurado");
        try {
          const userCredential = $isRegisterMode 
            ? await createUserWithEmailAndPassword(auth, emailValue, passwordValue)
            : await signInWithEmailAndPassword(auth, emailValue, passwordValue);
          
          addDiagnostic(`Autenticación exitosa con método 1, UID: ${userCredential.user.uid}`);
          success = true;
        } catch (err) {
          errorMsg = err;
          addError(`Método 1 falló: ${err.code} - ${err.message}`);
        }
      }
      
      // Método 2: Obteniendo una nueva instancia de auth
      if (!success && app) {
        addDiagnostic("Intentando método 2: Nueva instancia de auth");
        try {
          const newAuth = getAuth(app);
          const userCredential = $isRegisterMode 
            ? await createUserWithEmailAndPassword(newAuth, emailValue, passwordValue)
            : await signInWithEmailAndPassword(newAuth, emailValue, passwordValue);
          
          addDiagnostic(`Autenticación exitosa con método 2, UID: ${userCredential.user.uid}`);
          success = true;
        } catch (err) {
          errorMsg = err;
          addError(`Método 2 falló: ${err.code} - ${err.message}`);
        }
      }
      
      // Si tuvimos éxito, redirigir
      if (success) {
        addDiagnostic("Autenticación exitosa, preparando redirección");
        
        // Intentar diferentes métodos de redirección
        setTimeout(async () => {
          try {
            addDiagnostic("Intentando redirección con goto");
            await goto('/');
          } catch (navErr) {
            addError(`Redirección con goto falló: ${navErr}`);
            
            addDiagnostic("Intentando redirección con window.location");
            window.location.href = '/';
          }
        }, 1000);
      } else if (errorMsg) {
        // Si fallamos, mostrar error
        alert(`Error: ${errorMsg.code}\n${errorMsg.message}`);
        $error = { message: getErrorMessage(errorMsg.code) };
      } else {
        // Si no hay conexión con Firebase
        addError("No se pudo conectar con Firebase");
        alert("No se pudo conectar con el servicio de autenticación. Verifica tu conexión a internet.");
        $error = { message: "No se pudo conectar con el servicio de autenticación" };
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
    <form bind:this={formElement} on:submit|preventDefault={handleFormSubmit} action="javascript:void(0);">
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

      <!-- Reemplazando los botones por versiones simplificadas -->
      <button 
        type="button" 
        disabled={$isLoading}
        on:click={() => {
          addDiagnostic("Botón de submit clickeado manualmente");
          const emailValue = get(email) || (emailInput ? emailInput.value : '');
          const passwordValue = get(password) || (passwordInput ? passwordInput.value : '');
          doAuthentication(emailValue, passwordValue);
        }}
      >
        {$isLoading ? 'Procesando...' : 'Submit (Directo)'}
      </button>
      
      <!-- Botón de prueba directo simplificado -->
      <button 
        type="button" 
        class="test-button"
        disabled={$isLoading}
        on:click={() => {
          addDiagnostic("Botón de prueba directo clickeado");
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
        Prueba Directa
      </button>

      <!-- Sección de diagnóstico siempre visible -->
      <div class="diagnostic-panel">
        <h3>Información de diagnóstico</h3>
        
        <div class="diagnostic-section">
          <h4>Estado:</h4>
          <ul>
            <li>Auth disponible: {!!auth}</li>
            <li>Firebase app: {!!app}</li>
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
