import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

// // Tipos
// export interface Contact {
//     id: string;
//     // ... otros campos
// }

// export interface Property {
//     id: string;
//     // ... otros campos
// }

// Funciones de base de datos
export const getContacts = async () => {
    const contactsCol = collection(db, 'contacts');
    const snapshot = await getDocs(contactsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getProperties = async () => {
    const propertiesCol = collection(db, 'properties');
    const snapshot = await getDocs(propertiesCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getBinnacles = async () => {
    const binnacleCol = collection(db, 'binnacles');
    const snapshot = await getDocs(binnacleCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getTodos = async () => {
    const todosCol = collection(db, 'todos');
    const snapshot = await getDocs(todosCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};