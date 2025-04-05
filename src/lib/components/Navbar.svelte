<script lang="ts">
    import { useAuth } from '../hooks/useAuth'
    import { useLogout } from '../hooks/useLogout'
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Moon from "./icons/moon.svelte";
    import Sun from "./icons/sun.svelte";

    let currentTheme = "";
    let nav__links = "wide"

    const { isAuthenticated } = useAuth()
    const { logout, loading: logoutLoading } = useLogout()

    onMount(() => {
        const cookies = document.cookie.split(';');
        const themeCookie = cookies.find(cookie => cookie.trim().startsWith('siteTheme='));
        const savedTheme = themeCookie ? themeCookie.split('=')[1].trim() : null;

        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            const userPrefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
            setTheme(userPrefersDarkMode ? "dark" : "light");
        }
    });

    const setTheme = (theme) => {
        document.documentElement.dataset.theme = theme;
        document.cookie = `siteTheme=${theme}; max-age=31536000; path=/; SameSite=Strict`;
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
</script>

<nav aria-label="Navegación principal">
    <div class="container">
        <div class="logo">
            <a href="/" class="brand">MatchHome</a>
        </div>
        
        <button 
            class="nav__target" 
            on:click={showHide}
            aria-label="Menú de navegación"
            aria-expanded={nav__links === "small"}
            aria-controls="nav-menu"
        >
            <i class="fa-solid fa-bars" aria-hidden="true"></i>
        </button>

        <ul 
            class={nav__links} 
            id="nav-menu"
            role="menubar"
        >
            <li role="none"><a href="/" role="menuitem">Inicio</a></li>
            {#if $isAuthenticated}
                <li role="none"><a href="/contacts" role="menuitem">Contacto</a></li>
                <li role="none"><a href="/properties" role="menuitem">Propiedades</a></li>
                <li role="none"><a href="/agenda" role="menuitem">Agenda</a></li>
                <li role="none"><a href="/tramites" role="menuitem">Trámites</a></li>
                <li role="none"><a href="/actions" role="menuitem">Acciones</a></li>
                <li role="none">
                    <button
                        class="nav-link"
                        on:click={logout}
                        disabled={$logoutLoading}
                        role="menuitem"
                    >
                        {$logoutLoading ? 'Cerrando sesión...' : 'Cerrar sesión'}
                    </button>
                </li>
            {:else}
                <li role="none"><a href="/login" role="menuitem">Iniciar sesión</a></li>
            {/if}
            <li role="none" class="theme-toggle">
                <button
                    on:click={() => setTheme(currentTheme === "light" ? "dark" : "light")}
                    aria-label={currentTheme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
                    class="theme-button"
                    role="menuitem"
                >
                    <span class="theme-icon" aria-hidden="true">
                        {#if currentTheme === "light"}
                            <Moon />
                        {:else}
                            <Sun />
                        {/if}
                    </span>
                </button>
            </li>
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

    .brand {
        font-size: 1.3em;
        font-weight: 600;
        text-decoration: none;
        color: var(--text-1);
    }

    .nav__target {
        display: none;
        padding: 0.5rem;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--text-1);
    }

    ul {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
        gap: 1.5rem;
    }

    a, .nav-link {
        text-decoration: none;
        color: var(--text-1);
        transition: color 0.2s;
        background: none;
        border: none;
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
        padding: 0;
    }

    a:hover, .nav-link:hover {
        color: var(--brand);
    }

    .nav-link:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .theme-button {
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--text-1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .theme-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
    }

    @media (max-width: 800px) {
        .container {
            padding: 0 2rem;
        }

        ul {
            gap: 1rem;
        }
    }

    @media (max-width: 600px) {
        .nav__target {
            display: block;
        }

        .small {
            display: none;
        }

        ul.small {
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            background: var(--surface-1);
            flex-direction: column;
            align-items: flex-start;
            padding: 2rem;
            gap: 1.5rem;
        }
    }
</style>