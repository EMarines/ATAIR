import { collection, getDocs } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Contact, Binnacle, Todo, Property } from '$types';

/**
 * Obtiene todos los contactos de la colección 'contacts'
 */
export async function getContacts(): Promise<Contact[]> {
    try {
        if (!db) {
            console.warn('Firestore no está inicializado en getContacts');
            return [];
        }
        const snapshot = await getDocs(collection(db, 'contacts'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
    } catch (error) {
        console.error('Error al obtener contactos de Firebase:', error);
        return [];
    }
}

/**
 * Obtiene todas las bitácoras de la colección 'binnacles'
 */
export async function getBinnacles(): Promise<Binnacle[]> {
    try {
        if (!db) {
            console.warn('Firestore no está inicializado en getBinnacles');
            return [];
        }
        const snapshot = await getDocs(collection(db, 'binnacles'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Binnacle));
    } catch (error) {
        console.error('Error al obtener bitácoras de Firebase:', error);
        return [];
    }
}

/**
 * Obtiene todas las tareas de la colección 'todos'
 */
export async function getTodos(): Promise<Todo[]> {
    try {
        if (!db) {
            console.warn('Firestore no está inicializado en getTodos');
            return [];
        }
        const snapshot = await getDocs(collection(db, 'todos'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo));
    } catch (error) {
        console.error('Error al obtener tareas de Firebase:', error);
        return [];
    }
}

/**
 * Obtiene todas las propiedades de la colección 'properties'
 */
export async function getProperties(): Promise<Property[]> {
    try {
        if (!db) {
            console.warn('Firestore no está inicializado en getProperties');
            return [];
        }
        const snapshot = await getDocs(collection(db, 'properties'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Property));
    } catch (error) {
        console.error('Error al obtener propiedades de Firebase:', error);
        return [];
    }
}
