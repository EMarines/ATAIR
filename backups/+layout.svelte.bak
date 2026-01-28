<script lang="ts">
  import '../styles/main.css'
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/firebase';
  import { collection, onSnapshot } from 'firebase/firestore';
  import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import { Navbar, Footer } from '$components';
  import type { Contact, Binnacle, Property } from '$lib/types';
  import { useAuth } from '$lib/hooks/useAuth';
  import { goto } from '$app/navigation';

  const { isAuthenticated, checkAuth } = useAuth();
  const unsubscribes: (() => void)[] = [];

  onMount(async () => {
    if (browser) {
      const isValid = await checkAuth();
      if (!isValid && window.location.pathname !== '/login') {
        goto('/login');
      }
    }
  });

  $: if (browser && $isAuthenticated) {
    // Limpiar subscripciones anteriores
    unsubscribes.forEach(unsubscribe => unsubscribe());
    unsubscribes.length = 0;

    // Configurar nuevos listeners
    unsubscribes.push(
      onSnapshot(
        collection(db, 'contacts'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          const datos = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              createdAt: data.createdAt || Date.now(),
              name: data.name || '',
              lastname: data.lastname || '',
              email: data.email || '',
              telephon: data.telephon || '',
              typeContact: data.typeContact || '',
              selecMC: data.selecMC || '',
              comContact: data.comContact || '',
              contactStage: data.contactStage || 0,
              isActive: data.isActive !== undefined ? data.isActive : true,
              properties: Array.isArray(data.properties) ? data.properties : [],
              budget: data.budget || 0,
              halfBathroom: data.halfBathroom || '',
              locaProperty: Array.isArray(data.locaProperty) ? data.locaProperty : [],
              modePay: data.modePay || '',
              numBaths: data.numBaths || '',
              numBeds: data.numBeds || '',
              numParks: data.numParks || '',
              propCont: data.propCont || '',
              rangeProp: data.rangeProp || '',
              selecTO: data.selecTO || '',
              sendedProperties: Array.isArray(data.sendedProperties) ? data.sendedProperties : [],
              title: data.title || '',
              typeProperty: data.typeProperty || '',
              typeOperation: data.typeOperation || '',
              selecTP: data.selecTP || '',
              tagsProperty: Array.isArray(data.tagsProperty) ? data.tagsProperty : [],
              ...data
            } as Contact;
          }) as Contact[];
          contactsStore.set(datos);
        }
      )
    );

    unsubscribes.push(
      onSnapshot(
        collection(db, 'binnacles'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          const binnacles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Binnacle[];
          binnaclesStore.set(binnacles);
        }
      )
    );

    unsubscribes.push(
      onSnapshot(
        collection(db, 'properties'),
        (snapshot: QuerySnapshot<DocumentData>) => {
          const datos = snapshot.docs.map(doc => ({
            public_id: doc.id,
            ...doc.data()
          })) as Property[];
          propertiesStore.set(datos);
        }
      )
    );
  }

  onDestroy(() => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  });
</script>

<div class="app">
    <header>
        <Navbar />
    </header>
    
    <main>
        <slot />
    </main>

    <footer>
        <Footer />
    </footer>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    main {
        flex: 1;
    }

    footer {
        margin-top: auto;
        padding: 1rem;
        background: rgb(56, 56, 56);
        text-align: center;
    }
</style>