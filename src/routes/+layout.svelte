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
                  const datos = snapshot.docs.map(doc => ({
                      id: doc.id,
                      createdAt: doc.data().createdAt || Date.now(),
                      name: doc.data().name || '',
                      typeContact: doc.data().typeContact || '',
                      ...doc.data()
                  })) as Contact[];
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
<Navbar />
<slot />
<Footer />