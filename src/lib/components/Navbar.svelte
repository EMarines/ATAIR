<script lang="ts">
    import "../../styles/main.css"
    import { useAuth } from '../hooks/useAuth'
    import { handleLogout, userStore } from '$lib/firebase/authManager';
    import { onMount } from 'svelte';
    import Moon from "./icons/moon.svelte";
    import Sun from "./icons/sun.svelte";
    import { useTestDb } from '$lib/firebase_toggle';
    import { empresa } from '$lib/config/empresa';

    let currentTheme = "";
    let nav__links = "wide";
    let menuOpen = false;
    let logoutLoading = false;

    const { isAuthenticated } = useAuth()

    // Función de logout mejorada
    async function logout() {
        logoutLoading = true;
        try {
            await handleLogout();
            console.log('✅ Logout exitoso');
        } catch (error) {
            console.error('❌ Error durante logout:', error);
        } finally {
            logoutLoading = false;
        }
    }

    onMount(() => {
        const userPrefersDarkMode = window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;
        const hasUserSetDarkModeManually =
            document.documentElement.dataset.theme == "dark";
        if (!hasUserSetDarkModeManually) {
            setTheme(userPrefersDarkMode ? "dark" : "light");
        } else {
            currentTheme = document.documentElement.dataset.theme;
        }
    });

    const setTheme = (theme) => {
        document.documentElement.dataset.theme = theme;
        document.cookie = `siteTheme = ${theme}; max-age=31536000;path="/"`;
        currentTheme = theme;
    };

    // $: routeId = $page.route.id;
    // $: url = $page.url.href

    function toggleMenu() {
        menuOpen = !menuOpen;
        nav__links = menuOpen ? "small" : "wide";

        // Evitar scroll cuando el menú está abierto
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }

    // Cerrar menú al hacer clic en un enlace
    function handleLinkClick() {
        if (menuOpen) {
            toggleMenu();
        }
    }

    $: dbIcon = $useTestDb ? '🔄' : '🔥';

</script>


<nav>
  <div class="container">
      <h1 class="title">{empresa.companyName}</h1>  
      <button 
        class="nav__target" 
        on:click={toggleMenu}
        aria-label="Abrir menú de navegación"
        aria-expanded={menuOpen}
      >
        <img 
          src="/menu.svg" 
          alt="Menú" 
          class="menu-icon" 
          class:hidden={menuOpen}
        />
        <!-- <span class="hamburger" class:open={menuOpen}>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </span> -->
      </button>

    {#if menuOpen}
      <div class="menu-overlay" on:click={toggleMenu} aria-hidden="true"></div>
    {/if}
    
    <ul 
      class={nav__links} 
      id="menu" 
      role="menu"
    >
      <li role="menuitem"><a href="/" on:click={handleLinkClick}>Home</a></li>
      {#if $isAuthenticated}
        <li role="menuitem"><a href="/contacts" class="nav__link" on:click={handleLinkClick}>Contacto</a></li>
        <li role="menuitem"><a href="/properties" class="nav__link" on:click={handleLinkClick}>Propiedades</a></li>
        <li role="menuitem"><a href="/agenda" class="nav__link" on:click={handleLinkClick}>Agenda</a></li>
        <li role="menuitem"><a href="/tramites" on:click={handleLinkClick}>Trámites</a></li>
        <li role="menuitem"><a href="/actions" on:click={handleLinkClick}>Acciones</a></li>
        <li role="menuitem"><a href="/filtros" on:click={handleLinkClick}>Filtros</a></li>
        <li role="menuitem">
          <a 
            href="/" 
            class="nav__link" 
            on:click={(e) => {
              e.preventDefault();
              handleLinkClick();
              logout();
            }}
            class:disabled={logoutLoading}
          >
            {logoutLoading ? 'Cerrando sesión...' : 'Logout'}
          </a>
        </li>
      {:else}
        <li role="menuitem"><a href="/login" class="nav__link" on:click={handleLinkClick}>Login</a></li>
      {/if}
      <li class="theme-toggle" role="menuitem">
        {#if currentTheme == "light"}
          <a 
            class="moon" 
            href={"#"} 
            on:click|preventDefault={() => setTheme("dark")}
            aria-label="Cambiar a modo oscuro"
          >
            <Moon />
            <span class="theme-text">Modo oscuro</span>
          </a>
        {:else}
          <a 
            class="sun" 
            href={"#"} 
            on:click|preventDefault={() => setTheme("light")}
            aria-label="Cambiar a modo claro"
          >
            <Sun />
            <span class="theme-text">Modo claro</span>
          </a>
        {/if}
      </li>
    </ul>
    
    <div class="db-toggle">
      <button on:click={() => useTestDb.toggle()} class="toggle-btn">
        <span class="db-icon">{dbIcon}</span>
        <!-- <span class="db-label">{dbLabel}</span> -->
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
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        /* align-items: center; */
    }

    .container {
        display: flex;
        align-items: center;
        justify-content: space-between;       
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

    .title {
        color: antiquewhite;
        font-size: 1.5em;
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

    .theme-toggle {
        display: flex;
        align-items: center;
    }

    .theme-text {
        display: none;
    }

    /* .hamburger {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: 24px;
        height: 18px;
        position: relative;
    } */

    /* .hamburger-line {
        display: block;
        width: 100%;
        height: 2px;
        background-color: var(--text-1);
        transition: transform 0.3s, opacity 0.3s;
    } */
    
    /* Hamburger transform to X when open */
    /* .hamburger.open .hamburger-line:nth-child(1) {
        transform: translateY(8px) rotate(45deg);
    }
    
    .hamburger.open .hamburger-line:nth-child(2) {
        opacity: 0;
    }
    
    .hamburger.open .hamburger-line:nth-child(3) {
        transform: translateY(-8px) rotate(-45deg);
    } */

    .menu-overlay {
        position: fixed;
        top: 60px;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 999;
        display: none;
    }

    .db-toggle {
        display: flex;
        align-items: center;
    }

    .toggle-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: 1px solid var(--text-2);
        border-radius: 4px;
        padding: 0.25rem 0.5rem;
        color: var(--text-1);
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .toggle-btn:hover {
        background: var(--surface-2);
    }

    /* Aumentar tamaño de iconos */
    :global(.moon svg),
    :global(.sun svg) {
        width: 2em;
        height: 2em;
    }

    .db-icon {
        font-size: 2em;
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
            z-index: 1001;
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
            height: calc(100vh - 60px);
            transform: translateX(0);
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
        }

        ul {
            width: 100%;
        }

        li {
            width: 100%;
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--surface-2);
        }

        li:last-child {
            border-bottom: none;
        }

        .nav__link {
            display: block;
            width: 100%;
            padding: 0.5rem 0;
            font-size: 1.1rem;
        }

        .theme-toggle {
            margin-top: 1rem;
        }

        .theme-text {
            display: inline;
            margin-left: 0.5rem;
        }

        .menu-overlay {
            display: block;
        }
        
        .db-toggle {
            display: none;
        }
        
        .db-toggle-mobile {
            display: flex;
            width: 100%;
            margin-top: 1rem;
        }
        
        .toggle-btn-mobile {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: transparent;
            border: 1px solid var(--text-2);
            border-radius: 4px;
            padding: 0.5rem 1rem;
            color: var(--text-1);
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
            justify-content: center;
        }
        
        .toggle-btn-mobile:hover {
            background: var(--surface-2);
        }
    }

 
</style>