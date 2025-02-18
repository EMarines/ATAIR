<script lang="ts">
  import '../styles/main.css'
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/firebase';
  import { collection, onSnapshot } from 'firebase/firestore';
  import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import { Navbar, Footer } from '$components';
  import type { Contact, Binnacle, Property } from '$lib/types';

  if (browser) {
      const unsubscribes: (() => void)[] = [];

      // Listeners
      unsubscribes.push(
          onSnapshot(
              collection(db, 'contacts'),
              (snapshot: QuerySnapshot<DocumentData>) => {
                  const datos = snapshot.docs.map(doc => {
                      const data = doc.data();
                      // Asegurarnos de que el ID del documento siempre esté presente
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
                          ...data
                      };
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

      onDestroy(() => {
          unsubscribes.forEach(unsubscribe => unsubscribe());
      });
  }
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
        min-height: 100vh; /* Altura mínima del viewport */
    }

    main {
        flex: 1;  /* Hace que el main ocupe todo el espacio disponible */
    }

    footer {
        margin-top: auto; /* Empuja el footer al fondo */
        padding: 1rem;
        background: rgb(56, 56, 56);
        text-align: center;
    }
</style>