<script lang="ts">
    import { useAuth } from '../hooks/useAuth'
    import { useLogout } from '../hooks/useLogout'
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Moon from "./icons/moon.svelte";
    import Sun from "./icons/sun.svelte";
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
    nav{
        position: sticky;
        top: 0;
        padding: 0.5em;

    }
    .container{
        display: flex;
        align-items: center;
    }
    ul{
        display: flex;
        margin: 0;
        margin-left: auto;
        list-style: none;
        font-size: 1em;
        gap: 15px;
    } 
    .wide, .small {
      display: flex;
      flex-direction: row;
      gap: 20px;
    }
 
    h1{
        margin: 0;
        font-size: 1.3em;
        font-weight: normal;
    }
    a{
        text-decoration: none;
        color: #aaa;        
    }
    .nav__target{
      display: none;
      padding: 23px;
      background: #343a40;
      border: none;
    }

    @media(max-width: 800px) {
      nav{
        color: blue;
        position: static;
      }
      .nav__links {
        flex-direction: column;
        color: red;
        padding-right: 50px;
      }
   
    }
 
  @media(max-width: 402px){
      
    nav{
      position: sticky;
      width: 100%;
      padding: 0 40px;
      height: 80px;
      color: #fff;
      display: flex;
      align-items: center;
      /* justify-content: space-between; */
    }

    .wide{
      display: none;
    }

    .small {
      display: block;
      flex-direction: column;
      position: fixed;
      left: 0px;
      bottom: 0;
      top: 80px;
      right: 0px;
      color:#343a40;
      background-color: gray;
      height: 500px;
      width: 100%;
      gap: 40px;
      padding: 10px 0 0 150px;
    }

    .nav__target{
      display: block;
    }

    .container{
      display: flex;
      width: 100%;
      gap: 100px;
    }

    li{
      padding: 10px 0;
      margin-bottom: 20px;
    }

    .nav__link {
    text-decoration: none;
    color: #fff;			 
    }
/* 
    .nav__icon{
      font-size: 2rem;
    } */



  }


</style> 