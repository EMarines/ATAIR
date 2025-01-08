<script lang="ts">
  import { useUser } from '$lib/hooks/useUser'
  import { contactsStore, propertiesStore } from '$lib/stores/dataStore'
  const { userStore, isAuthenticated } = useUser()
  import { Hero, What } from '$components'
</script>
<Hero />
<What />

{#if $isAuthenticated}
  <div class="profile">
    <h4>Perfil de {$userStore.email}</h4>
    <h3>actualmente tenemos {$contactsStore.length} contactos y {$propertiesStore.length} propiedades</h3>
    <!-- Resto del contenido -->
  </div>
{/if}
