<script lang="ts">
  import { goto } from '$app/navigation';

  interface Action {
    id: string;
    icon: string;
    title: string;
    description: string;
  }

  const actions: Action[] = [
    {
      id: 'sync-properties',
      icon: 'fa-solid fa-house-laptop',
      title: 'Sincronizar Propiedades',
      description: 'Actualizar propiedades desde EasyBroker'
    },
    {
      id: 'sync-contacts',
      icon: 'fa-solid fa-users-gear',
      title: 'Sincronizar Contactos',
      description: 'Actualizar contactos desde EasyBroker'
    },
    {
      id: 'prop-filter',
      icon: 'fa-solid fa-filter',
      title: 'Filtrar Propiedades',
      description: 'Encontrar propiedades para enviar a clientes'
    },
    {
      id: 'cont-filter',
      icon: 'fa-solid fa-user-check',
      title: 'Filtrar Contactos',
      description: 'Encontrar clientes para una propiedad'
    },
    {
      id: 'settings',
      icon: 'fa-solid fa-gear',
      title: 'Configuración',
      description: 'Ajustes del sistema'
    },
    {
      id: 'send-sellers-report',
      icon: 'fa-solid fa-house-laptop',
      title: 'Reoporte a Vendedores',
      description: 'Enviar reporte a vendedores'
    }
  ];

  function handleAction(actionId: string) {
    switch (actionId) {
      case 'sync-properties':
        goto('/actions/sync-properties');
        break;
      case 'cont-filter':
        goto('/actions/cont-filter');
        break;
      case 'prop-filter':
        goto('/actions/prop-filter');
        break;
      case 'cont-filter':
        goto('/actions/cont-filter');
        break;
      case 'configuration':
        goto('/actions/contfiguration');
        break;
      case 'send-sellers-report':
        goto('/actions/send-repo');
        break
      // Aquí agregaremos más casos cuando implementemos las otras acciones
      default:
        console.log(`Acción ${actionId} aún no implementada`);
    }
  }
</script>

<div class="container">
  <h1 class="title">Acciones del Sistema</h1>
  
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
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  /* .title {
    text-align: center;
    color: #6b21a8;
    margin-bottom: 1.5rem;
    font-family: 'Poppins', sans-serif;
  } */

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
    color: #888;
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