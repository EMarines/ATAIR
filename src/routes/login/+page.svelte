<script lang="ts">
  // Importamos lo necesario directamente aquí
  import { auth } from '$lib/firebase';
  import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
  import { goto } from '$app/navigation';
  import { writable, get } from 'svelte/store';
  import { onMount } from 'svelte';
  
  // Variables para depuración
  let isSubmitClicked = false;
  let testButtonClicked = false;
  
  // Creamos stores locales para el formulario
  const email = writable('');
  const password = writable('');
  const isLoading = writable(false);
  const error = writable(null);
  const isRegisterMode = writable(false);
  
  onMount(() => {
    console.log("Componente montado - Auth disponible:", !!auth);
  });
  
  // Funciones de prueba separadas
  function handleNormalSubmit(event) {
    event.preventDefault(); // Aseguramos prevenir el comportamiento por defecto
    isSubmitClicked = true;
    console.log("Submit normal presionado");
    doAuthentication();
    return false; // Para asegurarnos que no haga submit
  }
  
  function handleTestButtonClick() {
    testButtonClicked = true;
    console.log("Botón de prueba presionado");
    $email = 'matchhome@hotmail.com';
    $password = '12VEntAS12';
    doAuthentication();
  }
  
  // Función principal de autenticación
  async function doAuthentication() {
    // Obtenemos los valores actuales de los stores
    const emailValue = get(email);
    const passwordValue = get(password);
    let userCredential;
    userCredential = await signInWithEmailAndPassword(auth, emailValue, passwordValue);
    console.log("AUTENTICACIÓN INICIADA:", { 
      email: emailValue, 
      password: passwordValue.substring(0, 3) + '***',
      isRegisterMode: $isRegisterMode,
      buttonClicked: isSubmitClicked ? "Submit" : "Prueba Directa"
    });
    
    // Verificación básica
    if (!emailValue || !passwordValue) {
      alert("Por favor ingresa email y contraseña");
      return;
    }
    
    try {
      $isLoading = true;
      $error = null;
      
      console.log(`Intentando ${$isRegisterMode ? 'REGISTRO' : 'LOGIN'} con Firebase...`);
      
      // Verificamos el objeto auth
      if (!auth) {
        throw new Error("Objeto de autenticación no disponible");
      }
      
      
      
      if ($isRegisterMode) {
        userCredential = await createUserWithEmailAndPassword(auth, emailValue, passwordValue);
      } else {
        console.log("ya entraste");
        // userCredential = await signInWithEmailAndPassword(auth, emailValue, passwordValue);
      }
      
      console.log("Autenticación exitosa:", userCredential.user.uid);
      
      // Pequeña pausa antes de redirigir para asegurarnos que todo se actualiza
      setTimeout(async () => {
        try {
          console.log("Intentando redireccionar...");
          await goto('/');
        } catch (navErr) {
          console.error("Error en redirección:", navErr);
          // Intento alternativo de redirección
          window.location.href = '/';
        }
      }, 500);
      
    } catch (err: any) {
      console.error("ERROR DE AUTENTICACIÓN:", err.code, err.message);
      alert(`Error: ${err.code}\n${err.message}`);
      $error = { message: getErrorMessage(err.code) };
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
    <form on:submit={handleNormalSubmit}>
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

      <button 
        type="submit" 
        disabled={$isLoading}
      >
        {$isLoading ? 'Procesando...' : 'Submit'}
      </button>
      
      <!-- Botón de prueba directo -->
      <button 
        type="button" 
        class="test-button"
        on:click={handleTestButtonClick}
        disabled={$isLoading}
      >
        Prueba Directa
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
</style>
