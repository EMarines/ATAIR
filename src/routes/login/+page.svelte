<script lang="ts">
  import { useLoginForm } from '$lib/hooks/useLoginForm'
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation'; // Añadida importación para la redirección

  const { 
    formData, 
    formState, 
    isValid, 
    handleSubmit, 
    toggleMode,
    validationStatus // Añadido para diagnosticar el problema del botón
  } = useLoginForm()

  let hostName = "";
  let isLoading = true;
  
  onMount(() => {
    if (browser) {
      hostName = window.location.hostname;
      isLoading = false;
      
      // Diagnosticar problema del botón deshabilitado
      console.log('Diagnóstico completo del formulario de login:', {
        formData: {
          email: $formData.email || '(vacío)',
          passwordLength: ($formData.password || '').length,
          confirmPasswordLength: ($formData.confirmPassword || '').length
        },
        formState: {
          isLoading: $formState.isLoading,
          isRegisterMode: $formState.isRegisterMode,
          hasError: !!$formState.error
        },
        isValid: $isValid,
        validationDetails: $validationStatus || '(no disponible)'
      });
    }
  });

  // Función para intentar login directamente, sin validación del cliente
  async function forceTryLogin() {
    try {
      console.log('Forzando intento de login con:', $formData.email, 'y contraseña de longitud', $formData.password?.length || 0);
      
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('$lib/firebase');
      
      await signInWithEmailAndPassword(
        auth, 
        $formData.email, 
        $formData.password
      );
      
      console.log('Autenticación forzada exitosa, redirigiendo a la página principal');
      goto('/');
    } catch (error: any) {
      console.error('Error en autenticación forzada:', error.code, error.message);
      alert(`Error en autenticación: ${error.code}\n${error.message}`);
    }
  }
</script>

<div class="container">
  <div class="authContainer">  
    <!-- Añadiendo información de diagnóstico -->
    {#if hostName}
      <div class="diagnostic">
        <p><strong>Dominio actual:</strong> {hostName}</p>
        <p class="note">Si estás en Vercel, verifica que este dominio esté autorizado en Firebase Console</p>
      </div>
    {/if}
    
    <!-- Añadiendo más información de diagnóstico visible -->
    <div class="validation-status">
      <p><strong>Estado de Validación:</strong></p>
      <ul>
        <li>Email válido: <span class={$validationStatus?.emailValid ? 'valid' : 'invalid'}>
          {$validationStatus?.emailValid ? '✓' : '✗'}</span>
          {#if !$validationStatus?.emailValid}<span class="note">(Debe ser un email válido)</span>{/if}
        </li>
        <li>Contraseña válida: <span class={$validationStatus?.passwordValid ? 'valid' : 'invalid'}>
          {$validationStatus?.passwordValid ? '✓' : '✗'}</span>
          {#if !$validationStatus?.passwordValid}<span class="note">(Debe tener al menos 6 caracteres)</span>{/if}
        </li>
        {#if $formState.isRegisterMode}
          <li>Contraseñas coinciden: <span class={$validationStatus?.passwordsMatch ? 'valid' : 'invalid'}>
            {$validationStatus?.passwordsMatch ? '✓' : '✗'}</span>
          </li>
        {/if}
      </ul>
      <p><strong>Botón Submit {$isValid ? 'habilitado' : 'deshabilitado'}</strong></p>
    </div>
    
    <form on:submit|preventDefault={handleSubmit}>
      <h1>{$formState.isRegisterMode ? "Registrarse" : "Login"}</h1>
      
      {#if $formState.error}
        <p class="error">{$formState.error.message}</p>        
      {/if}

      <label>
        <p class={$formData.email ? 'above' : 'center'}>Email</p>
        <input 
          bind:value={$formData.email} 
          type="email" 
          placeholder="email"
          disabled={$formState.isLoading}
          autocomplete="email"
        >
      </label>

      <label>
        <p class={$formData.password ? 'above' : 'center'}>Password</p>
        <input  
          bind:value={$formData.password} 
          type="password" 
          placeholder="Password"
          disabled={$formState.isLoading}
          autocomplete="current-password"
        >
      </label>

      {#if $formState.isRegisterMode}
        <label>
          <p class={$formData.confirmPassword ? 'above' : 'center'}>Confirmar Password</p>
          <input  
            bind:value={$formData.confirmPassword} 
            type="password" 
            placeholder="Confirmar Password"
            disabled={$formState.isLoading}
            autocomplete="new-password"
          >
        </label>
      {/if}

      <button 
        type="submit" 
        disabled={!$isValid || $formState.isLoading}
      >
        {$formState.isLoading ? 'Procesando...' : 'Submit'}
      </button>
    </form>

    <!-- Botón de diagnóstico para forzar inicio de sesión -->
    <div class="debug-actions">
      <button class="debug-button" on:click={forceTryLogin}>
        Diagnóstico: Forzar intento de login
      </button>
      <p class="note">Este botón intenta iniciar sesión directamente, sin validación del cliente</p>
    </div>

    <div class="options">
      {#if $formState.isRegisterMode}
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
  
  .diagnostic {
    background-color: #1a1a1a;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 15px;
    color: #fff;
  }
  
  .note {
    font-size: 0.8rem;
    color: #aaa;
    margin-left: 8px;
  }
  
  .validation-status {
    background-color: #2a2a2a;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 15px;
    color: #fff;
    font-size: 14px;
  }
  
  .validation-status ul {
    padding-left: 20px;
    margin: 8px 0;
  }
  
  .valid {
    color: #4caf50;
    font-weight: bold;
  }
  
  .invalid {
    color: #ff5252;
    font-weight: bold;
  }

  .debug-actions {
    margin-top: 1rem;
    padding: 10px;
    border: 1px dashed #555;
    border-radius: 5px;
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  .debug-button {
    background-color: #ff3e00;
    padding: 8px 16px;
    width: 100%;
  }
</style>
