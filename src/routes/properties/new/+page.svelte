<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/subir-propiedad', { replaceState: true });
  });
</script>

<div style="padding: 3rem 1.5rem; text-align: center; color: #94a3b8;">
  Redirigiendo a Subir Propiedad...
</div>
