<script lang="ts">
  // import { useUser } from '$lib/hooks/useUser'
  // import { contactsStore, propertiesStore } from '$lib/stores/dataStore'
  import { goto } from '$app/navigation';
  // const { userStore, isAuthenticated } = useUser()
  import { Hero, Footer } from '$components'
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  interface Action {
    id: string;
    icon: string;
    title: string;
    description: string;
  }

  const actions: Action[] = [
    {
      id: 'properties',
      icon: 'fa-solid fa-house',
      title: 'Propiedades',
      description: 'Ver propiedades'
    },
    {
      id: 'contacts',
      icon: 'fa-solid fa-users',
      title: 'Contactos',
      description: 'Gestionar contactos'
    },
    {
      id: 'agenda',
      icon: 'fa-solid fa-calendar-days',
      title: 'Agenda',
      description: 'Programar citas'
    },
    {
      id: 'tramites',
      icon: 'fa-solid fa-file-contract',
      title: 'Trámites',
      description: 'Control de trámites'
    },
    {
      id: 'actions',
      icon: 'fa-solid fa-gear',
      title: 'Acciones',
      description: 'Acciones del sistema'
    },
    {
      id: 'filters',
      icon: 'fa-solid fa-user',
      title: 'Filtro',
      description: 'Propiedades-contactos'
    },
    {
      id: 'about',
      icon: 'fa-solid fa-circle-info',
      title: 'Acerca de MH',
      description: 'Información sobre ATAIR'
    },
    {
      id: 'help',
      icon: 'fa-solid fa-question-circle',
      title: 'Ayuda',
      description: 'Centro de ayuda'
    }
  ];

  function handleAction(actionId: string) {
    switch (actionId) {
      case 'properties':
        goto('/properties');
        break;
      case 'contacts':
        goto('/contacts');
        break;
      case 'agenda':
        goto('/agenda');
        break;
      case 'tramites':
        goto('/tramites');
        break;
      case 'actions':
        goto('/actions');
        break;
      case 'filters':
        goto('/filtros');
        break;
      case 'about':
        goto('/about');
        break;
      case 'help':
        goto('/help');
        break;
      default:
        console.log(`Acción ${actionId} aún no implementada`);
    }
  }

  // Diagnóstico temporal para variables de entorno
  let envDiagnostic = {
    apiKeyConfigured: false,
    authDomainConfigured: false,
    projectIdConfigured: false
  };

  onMount(() => {
    if (browser) {
      // Verificar variables críticas sin mostrar su valor real
      envDiagnostic = {
        apiKeyConfigured: !!import.meta.env.VITE_FIREBASE_API_KEY,
        authDomainConfigured: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectIdConfigured: !!import.meta.env.VITE_FIREBASE_PROJECT_ID
      };
    }
  });
</script>

<Hero />

<!-- <div class="iconChoises"> -->
  <div class="container">
    <h2 class="title">Panel de Control</h2>
    
    <div class="actions-grid">
      {#each actions as action}
        <button 
          class="action-card" 
          on:click={() => handleAction(action.id)}
        >
          <i class={action.icon}></i>
          <h3>{action.title}</h3>
          <p>{action.description}</p>
        </button>
      {/each}
    </div>
  </div>

<style>
  .iconChoises {
    width: 100%;
    padding: 1rem 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .title {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    padding: 0.5rem;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem;
    background: rgb(56, 56, 56);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    text-align: center;
  }

  .action-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    background: rgb(76, 76, 76);
  }

  .action-card i {
    font-size: 2rem;
    margin-bottom: 0.75rem;
    color: #6b21a8;
  }

  .action-card h3 {
    margin: 0.25rem 0;
    font-size: 1.1rem;
    color: white;
  }

  .action-card p {
    font-size: 0.8rem;
    color: rgb(236, 236, 236);
    margin: 0;
  }

  @media (max-width: 768px) {
    .actions-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .action-card {
      padding: 1.25rem;
    }
  }

  @media (max-width: 480px) {
    .container {
      padding: 0.75rem;
    }
    
    .actions-grid {
      gap: 0.75rem;
    }

    .action-card {
      padding: 1rem;
    }
  }
</style>