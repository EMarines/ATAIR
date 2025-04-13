import { browser } from '$app/environment';
import { contactsStore, binnaclesStore, propertiesStore, todoStore } from '$lib/stores/dataStore';
import type { Contact, Binnacle, Property, Todo } from '$lib/types';
import { authService } from '$lib/services/authService';

export const load = async () => {
    // Inicializa los stores con arrays vacíos
    contactsStore.set([]);
    binnaclesStore.set([]);
    propertiesStore.set([]);
    todoStore.set([]);

    if (browser) {
        // Verificar token al cargar layout - envolvemos en un setTimeout para asegurar que no bloquee la hidratación
        setTimeout(async () => {
            try {
                await authService.verifyToken();
                console.log('Token verificado exitosamente');
            } catch (error) {
                console.error('Error al verificar token en layout:', error);
            }
            
            try {
                // Importamos las funciones de Firebase después de la hidratación
                const { collection, onSnapshot, getDocs } = await import('firebase/firestore');
                const { db } = await import('$lib/firebase/firebase');
                
                console.log('Firebase importado correctamente');
                
                // Carga inicial de datos
                const [contactsSnap, binnaclesSnap, propertiesSnap, todosSnap] = await Promise.all([
                    getDocs(collection(db, 'contacts')),
                    getDocs(collection(db, 'binnacles')),
                    getDocs(collection(db, 'properties')),
                    getDocs(collection(db, 'todos'))
                ]);

                // Actualiza los stores con los datos iniciales
                contactsStore.set(contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact)));
                binnaclesStore.set(binnaclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Binnacle)));
                propertiesStore.set(propertiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property)));
                todoStore.set(todosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo)));

                // Configura los listeners para actualizaciones en tiempo real
                onSnapshot(collection(db, 'contacts'), (snapshot) => {
                    contactsStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact)));
                });

                onSnapshot(collection(db, 'binnacles'), (snapshot) => {
                    binnaclesStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Binnacle)));
                });

                onSnapshot(collection(db, 'properties'), (snapshot) => {
                    propertiesStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property)));
                });

                onSnapshot(collection(db, 'todos'), (snapshot) => {
                    todoStore.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo)));
                });
            } catch (error) {
                console.error('Error loading Firebase or data:', error);
            }
        }, 100);
    }

    // Devolvemos objetos vacíos para que la hidratación no dependa de datos externos
    return {
        contacts: [],
        binnacles: [],
        properties: [],
        todos: []
    };
};