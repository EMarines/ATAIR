<script lang="ts">
  import "../styles/main.css";
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/firebase';
  import { collection, onSnapshot } from 'firebase/firestore';
  import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import Navbar from '$lib/components/Navbar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { useAuth } from '$lib/hooks/useAuth';
  import { goto } from '$app/navigation';
  import { testMode } from '$lib/stores/testModeStore';
  import NotificationContainer from '$lib/components/NotificationContainer.svelte';

  const unsubscribes: (() => void)[] = [];

  onMount(async () => {
    // ...existing code...
  });

  onDestroy(() => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  });
</script>

<NotificationContainer />
  
<header>
  <Navbar />
</header>

<main id="main-content" aria-label="Contenido principal">
  <div class="app" inert={$testMode}>
    <slot />
  </div>
</main>

<Footer />

<style>
  main {
    flex: 1;
    position: relative;
    z-index: 2;
    margin-bottom: 4rem;
  }

  :global(.app) {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
</style>