<script lang="ts">
  import '../styles/main.css'
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/firebase';
  import { collection, onSnapshot } from 'firebase/firestore';
  import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
  import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';
  import { Navbar, Footer } from '$components';

  if (browser) {
      const unsubscribes: (() => void)[] = [];

      // Listeners
      unsubscribes.push(
          onSnapshot(
              collection(db, 'contacts'),
              (snapshot: QuerySnapshot<DocumentData>) => {
                  const datos = snapshot.docs.map(doc => ({
                      id: doc.id,
                      ...doc.data()
                  }));
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
                  }));
                  binnaclesStore.set(binnacles);
              }
          )
      );

      unsubscribes.push(
          onSnapshot(
              collection(db, 'properties'),
              (snapshot: QuerySnapshot<DocumentData>) => {
                  const properties = snapshot.docs.map(doc => ({
                      id: doc.id,
                      ...doc.data()
                  }));
                  propertiesStore.set(properties);
              }
          )
      );

      onDestroy(() => {
          unsubscribes.forEach(unsubscribe => unsubscribe());
      });
  }
</script>
<Navbar />
<slot />
<Footer />