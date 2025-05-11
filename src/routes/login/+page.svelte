<script lang="ts">
  // Importaciones
  import { loginWithEmailPassword, registerWithEmailPassword } from '$lib/firebase/firebase'; // <-- Importa la función de registro
  import { auth } from '$lib/firebase/init';
  import { goto } from '$app/navigation';

  // Creamos variables locales para el formulario
  let email = '';
  let password = '';
  let isLoading = false;
  let error = null;
  let isRegisterMode = false;

  // Función para resetear los campos del formulario
  function resetForm() {
    email = '';
    password = '';
  }

  // Función para manejar tanto el login como el registro
  async function handleAuth(emailValue, passwordValue) {
    // Verificación básica
    if (!emailValue || !passwordValue) {
      error = { message: "Por favor ingresa email y contraseña" };
      return;
    }

    try {
      isLoading = true;
      error = null;

      let result;
      if (isRegisterMode) {
        // --- Lógica de Registro ---
        result = await registerWithEmailPassword(emailValue, passwordValue);
        if (result.success) {
          console.log(result, "Registro exitoso");
          // Podrías redirigir o mostrar un mensaje de éxito antes de redirigir
          // Por ahora, redirigimos igual que en el login
          setTimeout(async () => {
            try { await goto('/'); } catch (navErr) { console.error("Error en redirección:", navErr); window.location.href = '/'; }
          }, 500);
        } else {
          // Asegúrate de que getErrorMessage esté definida y maneje los códigos de error
          error = { message: getErrorMessage(result.code) || `Error de registro: ${result.message}` };
          // Limpiar los campos después de un intento fallido
          resetForm();
        }
      } else {
        // --- Lógica de Login ---
        result = await loginWithEmailPassword(emailValue, passwordValue);
        if (result.success) {
          console.log(result, "Autenticación exitosa");
          // Redirigir al usuario
          setTimeout(async () => {
            try { await goto('/'); } catch (navErr) { console.error("Error en redirección:", navErr); window.location.href = '/'; }
          }, 500);
        } else {
          // Asegúrate de que getErrorMessage esté definida y maneje los códigos de error
          error = { message: getErrorMessage(result.code) || `Error de login: ${result.message}` };
          // Limpiar los campos después de un intento fallido
          resetForm();
        }
      }

    } catch (err) {
      console.error("Error general:", err.message);
      // Asegúrate de que el mensaje de error sea útil
      error = { message: `Error inesperado: ${err.message}` };
      // Limpiar los campos después de un error general
      resetForm();
    } finally {
      isLoading = false;
    }
  }

  // Función para cambiar entre login y registro
  function toggleMode() {
    isRegisterMode = !isRegisterMode;
    error = null; 
    resetForm();
  }

  // Función auxiliar para traducir mensajes de error de Firebase
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
      // Puedes añadir más códigos de error aquí si es necesario
    };

    return errorMessages[code] || `Error desconocido (${code})`;
  }
</script>

<div class="container">
  <div class="authContainer">
    <form on:submit|preventDefault={() => handleAuth(email, password)}> 
      <h1>{isRegisterMode ? "Registrarse" : "Login"}</h1>

      {#if error}
        <p class="error">{error.message}</p>
      {/if}

      <label>
        <p class={email ? 'above' : 'center'}>Email</p>
        <input
          bind:value={email}
          type="email"
          placeholder="email"
          disabled={isLoading}
          autocomplete="email"
        >
      </label>

      <label>
        <p class={password ? 'above' : 'center'}>Password</p>
        <input
          bind:value={password}
          type="password"
          placeholder="Password"
          disabled={isLoading}
          autocomplete={isRegisterMode ? "new-password" : "current-password"} 
        >
      </label>

      <!-- Botón de envío -->
      <button
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? 'Procesando...' : (isRegisterMode ? 'Registrarse' : 'Iniciar Sesión')} 
    </form>

    <div class="options">
      {#if isRegisterMode}
        <div>
          <p>¿Tienes Cuenta?</p>
          <button on:click={toggleMode} disabled={isLoading}>Login</button>
        </div>
      {:else}
        <div>
          <p>¿No Tienes Cuenta?</p>
          <button on:click={toggleMode} disabled={isLoading}>Registrate</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Estilos (sin cambios) -->
<style>
  /* ... tus estilos ... */
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
    /* Añade un fondo o borde para verlo mejor si es necesario */
    background-color: #222;
    border: 1px solid #444;
    border-radius: 8px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem; /* Espacio entre elementos del form */
  }

  label {
    display: flex;
    flex-direction: column;
    position: relative; /* Para posicionar el <p> */
    margin-bottom: 0.5rem; /* Espacio extra debajo de cada label */
  }

  label p {
    position: absolute;
    top: -0.7em; /* Ajusta para que quede encima del borde */
    left: 0.5rem; /* Un poco de padding izquierdo */
    background-color: #222; /* Fondo para que tape el borde del input (ajusta a tu color de fondo) */
    padding: 0 0.3rem;
    font-size: 0.8em;
    color: #aaa; /* Color del texto del label */
    transition: all 0.2s ease; /* Transición suave */
    pointer-events: none; /* Para que no interfiera con el click al input */
  }

  /* Style <p> inside focused <label> */
  label:focus-within p {
     color: lightblue; /* Cambia color al estar activo */
  }

  input {
    padding: 0.8rem 0.5rem 0.4rem 0.5rem; /* Más padding arriba para dejar espacio al label */
    border: 1px solid #ccc;
    border-radius: 4px;
    background: transparent;
    color: white;
    font-size: 1em; /* Tamaño de fuente base */
  }

  /* Ocultar placeholder nativo si usamos el label flotante */
  input::placeholder {
    color: transparent;
  }


  button {
    padding: 0.7rem; /* Un poco más de padding */
    background: blue;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.2s ease; /* Transición al hacer hover */
  }

  button:hover:not(:disabled) {
     background-color: darkblue; /* Color al pasar el ratón */
  }


  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .options {
    margin-top: 1.5rem; /* Más espacio arriba */
    text-align: center;
  }

  .options div {
      display: flex; /* Para alinear texto y botón */
      justify-content: center;
      align-items: center;
      gap: 0.5rem; /* Espacio entre el texto y el botón */
  }

  .options p {
      margin: 0; /* Quitar margen por defecto del párrafo */
      color: #ccc; /* Color más suave para el texto */
  }

  .options button {
      background: none; /* Sin fondo */
      border: none;
      color: lightblue; /* Color tipo enlace */
      padding: 0.2rem 0.5rem; /* Menos padding */
      cursor: pointer;
      font-size: 0.9em; /* Un poco más pequeño */
      text-decoration: underline; /* Subrayado para parecer enlace */
  }

  .options button:hover:not(:disabled) {
      color: cyan; /* Cambio de color al pasar el ratón */
      background: none; /* Asegurar que no cambie el fondo */
  }


  .error {
    color: #ff4d4d; /* Rojo más visible */
    background-color: #4d0000; /* Fondo oscuro para el error */
    padding: 0.5rem;
    border-radius: 4px;
    text-align: center;
    margin-bottom: 1rem; /* Espacio debajo del error */
  }
</style>
