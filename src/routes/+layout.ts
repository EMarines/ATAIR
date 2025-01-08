import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
// import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { contactsStore, binnaclesStore, propertiesStore } from '$lib/stores/dataStore';

export const load = async () => {
    // Inicializa los stores con arrays vacíos
    contactsStore.set([]);
    binnaclesStore.set([]);
    propertiesStore.set([]);

    if (browser) {
        try {
            // Carga inicial de datos
            const [contactsSnap, binnaclesSnap, propertiesSnap] = await Promise.all([
                getDocs(collection(db, 'contacts')),
                getDocs(collection(db, 'binnacles')),
                getDocs(collection(db, 'properties'))
            ]);

            // Actualiza los stores con los datos iniciales
            contactsStore.set(contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            binnaclesStore.set(binnaclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            propertiesStore.set(propertiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Configura los listeners para actualizaciones en tiempo real
            onSnapshot(collection(db, 'contacts'), (snapshot) => {
                contactsStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(collection(db, 'binnacles'), (snapshot) => {
                binnaclesStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            onSnapshot(collection(db, 'properties'), (snapshot) => {
                propertiesStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    return {
        contacts: [],
        binnacles: [],
        properties: []
    };
};