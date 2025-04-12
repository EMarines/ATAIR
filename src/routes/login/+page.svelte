<script lang="ts">
  import { useLoginForm } from '$lib/hooks/useLoginForm'
  
  const { 
    formData, 
    formState, 
    isValid, 
    handleSubmit, 
    toggleMode
  } = useLoginForm()
</script>

<div class="container">
  <div class="authContainer">  
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
        disabled={$formState.isLoading}
      >
        {$formState.isLoading ? 'Procesando...' : 'Submit'}
      </button>
    </form>

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
</style>
