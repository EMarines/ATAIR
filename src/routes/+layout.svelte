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
  import { page } from '$app/stores';

  const { isAuthenticated } = useAuth();
  const unsubscribes: (() => void)[] = [];

  // Lista de rutas públicas que no requieren autenticación
  const publicRoutes = ['/login', '/register'];

  onMount(async () => {
    if (browser) {
      // Verificar si la ruta actual requiere autenticación
      const currentPath = $page.url.pathname;
      if (!publicRoutes.includes(currentPath) && !$isAuthenticated) {
        console.log('Usuario no autenticado, redirigiendo a login...');
        goto('/login');
      }
    }
  });

  $: if (browser && $isAuthenticated) {
    // Suscribirse a las colecciones solo si el usuario está autenticado
    const contactsUnsubscribe = onSnapshot(
      collection(db, "contacts"),
      (snapshot: QuerySnapshot<DocumentData>) => {
        const contacts = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Contact[];
        contactsStore.set(contacts);
      },
      (error) => {
        console.error("Error loading contacts:", error);
      }
    );

    const binnaclesUnsubscribe = onSnapshot(
      collection(db, "binnacles"),
      (snapshot: QuerySnapshot<DocumentData>) => {
        const binnacles = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Binnacle[];
        binnaclesStore.set(binnacles);
      },
      (error) => {
        console.error("Error loading binnacles:", error);
      }
    );

    const propertiesUnsubscribe = onSnapshot(
      collection(db, "properties"),
      (snapshot: QuerySnapshot<DocumentData>) => {
        const properties = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Property[];
        propertiesStore.set(properties);
      },
      (error) => {
        console.error("Error loading properties:", error);
      }
    );

    unsubscribes.push(
      contactsUnsubscribe,
      binnaclesUnsubscribe,
      propertiesUnsubscribe
    );
  }

  onDestroy(() => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  });
</script>

<div class="layout">
  <NotificationContainer />
    
  <header>
    <Navbar />
  </header>

  <main aria-label="Contenido principal">
    <div class="app-content">
      <slot />
    </div>
  </main>

  <Footer />
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
    position: relative;
    z-index: 2;
    margin-bottom: 4rem;
  }

  .app-content {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>