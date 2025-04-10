<script lang="ts">
    import { useAuth } from '../hooks/useAuth'
    import { useLogout } from '../hooks/useLogout'
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Moon from "./icons/moon.svelte";
    import Sun from "./icons/sun.svelte";
    import { writable } from 'svelte/store';
    import { browser } from '$app/environment';

    let currentTheme = "";
    let nav__links = "wide"

    const { isAuthenticated } = useAuth()
    const { logout, loading: logoutLoading } = useLogout()

    onMount(() => {
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
        if (nav__links === "small") {
            nav__links = "wide"
        } else {
            nav__links = "small"
        }
    }

    // Store para controlar qué base de datos usamos
    const createDbToggleStore = () => {
        const initialValue = browser ?
            localStorage.getItem('useTestDb') === 'true' :
            false;

        const { subscribe, set, update } = writable<boolean>(initialValue);

        return {
            subscribe,
            toggle: () => {
                update(value => {
                    const newValue = !value;
                    if (browser) {
                        localStorage.setItem('useTestDb', String(newValue));
                        window.location.reload();
                    }
                    return newValue;
                });
            }
        };
    };

    const useTestDb = createDbToggleStore();

    $: dbLabel = $useTestDb ? 'Curso Svelte' : 'Match Home';
    $: dbIcon = $useTestDb ? '🔄' : '🔥';
</script>


<nav>
  <div class="container">
      <h1>MatchHome</h1>  
      <button 
        class="nav__target" 
        on:click={showHide}
        aria-label="Abrir menú de navegación"
      >
        <i class="fa-solid fa-bars nav__icon"></i>
      </button>

    <ul 
      class={nav__links} 
      id="menu" 
      on:click={showHide} 
      on:keypress={showHide}
      role="menu"
    >
      <li role="menuitem"><a href="/">Home</a></li>
      {#if $isAuthenticated}
        <li role="menuitem"><a href="/contacts" class="nav__link">Contacto</a></li>
        <li role="menuitem"><a href="/properties" class="nav__link">Propiedades</a></li>
        <li role="menuitem"><a href="/agenda" class="nav__link">Agenda</a></li>
        <li role="menuitem"><a href="/tramites">Trámites</a></li>
        <li role="menuitem"><a href="/actions">Acciones</a></li>
        <li role="menuitem">
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
        <li role="menuitem"><a href="/login" class="nav__link">Login</a></li>
      {/if}
      <li class="relative" role="menuitem">
        {#if currentTheme == "light"}
          <a 
            class="moon" 
            href={"#"} 
            on:click={() => setTheme("dark")}
            aria-label="Cambiar a modo oscuro"
            tabindex="-1"
          >
            <Moon />
          </a>
        {:else}
          <a 
            class="sun" 
            href={"#"} 
            on:click={() => setTheme("light")}
            aria-label="Cambiar a modo claro"
            tabindex="-1"
          >
            <Sun />
          </a>
        {/if}
      </li>
    </ul>
    
    <div class="db-toggle">
      <button on:click={() => useTestDb.toggle()} class="toggle-btn">
        <span class="db-icon">{dbIcon}</span>
        <span class="db-label">{dbLabel}</span>
      </button>
    </div>
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

    /* Estilos para el botón de toggle de base de datos */
    .db-toggle {
        margin-left: 15px;
        display: flex;
        align-items: center;
    }
  
    .toggle-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: none;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 4px 8px;
        cursor: pointer;
        transition: background-color 0.3s;
    }
  
    .toggle-btn:hover {
        background-color: #f0f0f0;
    }
  
    .db-icon {
        font-size: 16px;
        margin-bottom: 2px;
    }
  
    .db-label {
        font-size: 10px;
        color: #555;
    }
</style>