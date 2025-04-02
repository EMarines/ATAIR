<script lang="ts">
    import { useAuth } from '../hooks/useAuth'
    import { useLogout } from '../hooks/useLogout'
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Moon from "./icons/moon.svelte";
    import Sun from "./icons/sun.svelte";
    // import GoogleConnectButton from './GoogleConnectButton.svelte';
    // import { isLoggedIn, user } from '../store';

  let currentTheme = "";
    let nav__links = "wide"

    const { isAuthenticated } = useAuth()
    const { logout, loading: logoutLoading } = useLogout()

    onMount(() => {
    // currentTheme = document.documentElement.dataset.theme;
    const userPrefersDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const hasUserSetDarkModeManually =
      document.documentElement.dataset.theme == "dark";
    if (!hasUserSetDarkModeManually) {
      setTheme(userPrefersDarkMode ? "dark" : "light");
    }
  });

    const setTheme = (theme) => {
        document.documentElement.dataset.theme = theme;
        document.cookie = `siteTheme = ${theme}; max-age=31536000;path="/"`;
        currentTheme = theme;
    };

    $: routeId = $page.route.id;
    $: url = $page.url.href

    function showHide() {
     if(nav__links === "small"){
      nav__links = "wide"
     } else {
      nav__links = "small"
     }
    } 

</script>


<nav>
  <div class="container">
    <!-- <div class="nav__bugger"> -->
      <h1>MatchHome</h1>  
      <button 
        class="nav__target" 
        on:click={showHide}
        aria-label="Abrir menú de navegación"
      >
        <i class="fa-solid fa-bars nav__icon"></i>
      </button>
    <!-- </div> -->

      <ul>
          <div 
            class={nav__links} 
            id="menu" 
            on:click={showHide} 
            on:keypress={showHide}
            role="menu"
            tabindex="0"
          >
            
            <li><a href="/">Home</a></li>
            {#if $isAuthenticated}
              <li><a href="/contacts" class="nav__link">Contacto</a></li>
              <li><a href="/properties" class="nav__link">Propiedades</a></li>
              <li><a href="/agenda" class="nav__link">Agenda</a></li>
              <!-- <li><a href="/(app)/profile">Profile</a></li> -->
              <li><a href="/tramites">Trámites</a></li>
              <li><a href="/actions">Acciones</a></li>
              <!-- <li class="google-connect-container">
                <GoogleConnectButton buttonText="Google Contacts" small={true} />
              </li> -->
              <li>
                <a 
                    href="/" 
                    class="nav__link" 
                    on:click={logout}
                    class:disabled={$logoutLoading}
                >
                    {$logoutLoading ? 'Cerrando sesión...' : 'Logout'}
                </a>
              </li> 
            {:else}
              <li><a href="/login" class="nav__link">Login</a></li>
            {/if}
            <li class="relative">
              {#if currentTheme == "light"}
                <a 
                  class="moon" 
                  href={"#"} 
                  on:click={() => setTheme("dark")}
                  aria-label="Cambiar a modo oscuro"
                >
                  <Moon />
                </a>
              {:else}
                <a 
                  class="sun" 
                  href={"#"} 
                  on:click={() => setTheme("light")}
                  aria-label="Cambiar a modo claro"
                >
                  <Sun />
                </a>
              {/if}
            </li>

          </div>
      </ul>
  </div>
</nav>

<style>
    nav {
        position: sticky;
        top: 0;
        padding: 0.5em;
        width: 100%;
        z-index: 1000;
        background: var(--surface-1);
    }

    .container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
    }

    ul {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
        gap: 1.5rem;
    }

    .wide, .small {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    h1 {
        margin: 0;
        font-size: 1.3em;
        font-weight: 600;
    }

    a {
        text-decoration: none;
        color: var(--text-1);
        transition: color 0.2s;
    }

    a:hover {
        color: var(--brand);
    }

    .nav__target {
        display: none;
        padding: 0.5rem;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--text-1);
    }

    /* Tablet */
    @media (max-width: 800px) {
        .container {
            padding: 0 2rem;
        }

        ul {
            gap: 1rem;
        }
    }

    /* Mobile */
    @media (max-width: 600px) {
        nav {
            position: sticky;
            height: 60px;
        }

        .container {
            padding: 0 1rem;
        }

        .nav__target {
            display: block;
        }

        .wide {
            display: none;
        }

        .small {
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--surface-1);
            flex-direction: column;
            align-items: flex-start;
            padding: 2rem;
            gap: 1.5rem;
            overflow-y: auto;
            z-index: 1000;
            height: calc(100vh - 60px); /* Altura total menos la altura del nav */
        }

        ul {
            width: 100%;
        }

        li {
            width: 100%;
            padding: 0.5rem 0;
        }

        .nav__link {
            display: block;
            width: 100%;
            padding: 0.5rem 0;
        }
    }

    /* Animaciones */
    .small {
        animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(0);
        }
    }

    /* Accesibilidad */
    .nav__target,
    a {
        outline: 2px solid var(--brand);
        outline-offset: 2px;
    }

    /* Estado deshabilitado */
    .disabled {
        opacity: 0.5;
        pointer-events: none;
    }
    
    .google-connect-container {
        display: flex;
        align-items: center;
        margin: 0 10px;
    }
    
    @media (max-width: 768px) {
        .google-connect-container {
            margin: 10px 0;
        }
    }
</style>