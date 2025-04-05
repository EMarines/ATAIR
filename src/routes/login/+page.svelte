<script lang="ts">
  import { useLoginForm } from '$lib/hooks/useLoginForm'
  import { onMount } from 'svelte';

  const { 
    formData, 
    formState, 
    isValid, 
    handleSubmit, 
    toggleMode 
  } = useLoginForm()

  let isSubmitting = false;

  const handleFormSubmit = async () => {
    if (isSubmitting) return;
    isSubmitting = true;
    try {
      await handleSubmit();
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    // Limpiar cualquier estado anterior del formulario
    formData.set({ email: '', password: '', confirmPassword: '' });
    formState.set({
      isLoading: false,
      error: null,
      isRegisterMode: false
    });
  });
</script>

<div class="container">
  <div class="authContainer">  
    <form on:submit|preventDefault={handleFormSubmit}>
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
          disabled={$formState.isLoading || isSubmitting}
          autocomplete="email"
        >
      </label>

      <label>
        <p class={$formData.password ? 'above' : 'center'}>Password</p>
        <input  
          bind:value={$formData.password} 
          type="password" 
          placeholder="Password"
          disabled={$formState.isLoading || isSubmitting}
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
            disabled={$formState.isLoading || isSubmitting}
            autocomplete="new-password"
          >
        </label>
      {/if}

      <button 
        type="submit" 
        disabled={!$isValid || $formState.isLoading || isSubmitting}
        class:loading={$formState.isLoading || isSubmitting}
      >
        {$formState.isLoading || isSubmitting ? 'Procesando...' : ($formState.isRegisterMode ? 'Registrarse' : 'Iniciar Sesión')}
      </button>
    </form>

    <div class="options">
      {#if $formState.isRegisterMode}
        <div>
          <p>¿Ya tienes una cuenta?</p>
          <button 
            on:click={toggleMode}
            disabled={$formState.isLoading || isSubmitting}
          >
            Iniciar Sesión
          </button>
        </div>
      {:else}
        <div>
          <p>¿No tienes una cuenta?</p>
          <button 
            on:click={toggleMode}
            disabled={$formState.isLoading || isSubmitting}
          >
            Registrarse
          </button>
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
    background-color: var(--bg-color);
    color: var(--text-color);
  }

  .authContainer {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    background-color: var(--surface-2);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
    position: relative;
  }

  input {
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background-color: var(--surface-1);
    color: var(--text-color);
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
  }

  input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  button {
    padding: 0.75rem;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: var(--primary-color-dark);
  }

  button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  button.loading {
    position: relative;
    color: transparent;
  }

  button.loading::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .options {
    margin-top: 1.5rem;
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .options button {
    background: none;
    color: var(--primary-color);
    padding: 0.5rem;
    margin-top: 0.5rem;
  }

  .options button:hover:not(:disabled) {
    background: none;
    text-decoration: underline;
  }

  .error {
    color: var(--error);
    background-color: var(--error-light);
    padding: 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    text-align: center;
  }

  h1 {
    text-align: center;
    margin-bottom: 1.5rem;
    color: var(--text-color);
  }
</style>
