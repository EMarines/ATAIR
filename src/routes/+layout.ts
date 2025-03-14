import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { contactsStore, binnaclesStore, propertiesStore, todoStore } from '$lib/stores/dataStore';
import type { Contact, Binnacle, Property, Todo } from '$lib/types';

export const load = async () => {
    // Inicializa los stores con arrays vacíos
    contactsStore.set([]);
    binnaclesStore.set([]);
    propertiesStore.set([]);
    todoStore.set([]);

    if (browser) {
        try {
            // Carga inicial de datos
            const [contactsSnap, binnaclesSnap, propertiesSnap, todosSnap] = await Promise.all([
                getDocs(collection(db, 'contacts')),
                getDocs(collection(db, 'binnacles')),
                getDocs(collection(db, 'properties')),
                getDocs(collection(db, 'todos'))
            ]);

            // Actualiza los stores con los datos iniciales
            contactsStore.set(contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Contact)));
            binnaclesStore.set(binnaclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Binnacle)));
            propertiesStore.set(propertiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Property)));
            todoStore.set(todosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Todo)));

            // Configura los listeners para actualizaciones en tiempo real
            onSnapshot(collection(db, 'contacts'), (snapshot) => {
                contactsStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Contact)));
            });

            onSnapshot(collection(db, 'binnacles'), (snapshot) => {
                binnaclesStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Binnacle)));
            });

            onSnapshot(collection(db, 'properties'), (snapshot) => {
                propertiesStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Property)));
            });

            onSnapshot(collection(db, 'todos'), (snapshot) => {
                todoStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Todo)));
            });
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    return {
        contacts: [],
        binnacles: [],
        properties: [],
        todos: []
    };
};