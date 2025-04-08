import { writable } from 'svelte/store';
import { collection, doc, deleteDoc, updateDoc, addDoc, getDocs, query, where, setDoc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { DocumentData, WhereFilterOp } from 'firebase/firestore';

interface FirebaseCondition {
    field: string;
    operator: WhereFilterOp;
    value: unknown;
}

function createFirebaseStore() {
    const { subscribe } = writable({});

    return {
        subscribe,
        delete: async (collectionName: string, id: string) => {
            try {
                const todoRef = doc(db, collectionName, id);
                await deleteDoc(todoRef);
                console.log('Todo deleted successfully');
                return { success: true };
            } catch (error) {
                console.error('Error deleting document:', error);
                return { success: false, error };
            }
        },
        update: async (collectionName: string, id: string, data: DocumentData) => {
            try {
                await updateDoc(doc(db, collectionName, id), data);
                return { success: true };
            } catch (error) {
                console.error('Error updating document:', error);
                return { success: false, error };
            }
        },
        // Método para crear o sobrescribir un documento con un ID específico
        set: async (collectionName: string, id: string, data: DocumentData) => {
            try {
                // Usar setDoc en lugar de updateDoc para crear o sobrescribir un documento
                await setDoc(doc(db, collectionName, id), data);
                return { success: true, id };
            } catch (error) {
                console.error('Error setting document:', error);
                return { success: false, error };
            }
        },
        add: async (collectionName: string, data: DocumentData) => {
            try {
                const docRef = await addDoc(collection(db, collectionName), data);
                return { success: true, id: docRef.id };
            } catch (error) {
                console.error('Error adding document:', error);
                return { success: false, error };
            }
        },
        // Método para añadir un documento con un ID específico
        addWithId: async (collectionName: string, id: string, data: DocumentData) => {
            try {
                // Verificar que el ID sea válido
                if (!id || id.trim() === '') {
                    throw new Error('ID inválido');
                }
                
                // Crear una referencia al documento con el ID específico
                const docRef = doc(db, collectionName, id);
                
                // Verificar si el documento ya existe
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    return { success: false, error: 'El documento ya existe' };
                }
                
                // Añadir el documento con el ID específico
                await setDoc(docRef, data);
                return { success: true, id };
            } catch (error) {
                console.error('Error adding document with ID:', error);
                return { success: false, error };
            }
        },
        // Método para obtener todos los documentos de una colección
        getAll: async (collectionName: string) => {
            try {
                const querySnapshot = await getDocs(collection(db, collectionName));
                const documents: DocumentData[] = [];
                
                querySnapshot.forEach((doc) => {
                    if (doc.exists()) {
                        // Asegurarse de que el documento tenga un ID válido
                        const data = doc.data();
                        if (!doc.id || doc.id.trim() === '') {
                            console.error('Error: Documento sin ID válido encontrado', data);
                            return; // Excluir este documento
                        }
                        
                        // Añadir el ID al objeto de datos
                        documents.push({
                            ...data,
                            id: doc.id
                        });
                    }
                });
                
                return { success: true, data: documents };
            } catch (error) {
                console.error('Error getting documents:', error);
                return { success: false, error };
            }
        },
        get: async (collectionName: string, conditions: FirebaseCondition[] = []) => {
            try {
                const collectionRef = collection(db, collectionName);
                const q = conditions.length > 0 
                    ? query(collectionRef, ...conditions.map(c => where(c.field, c.operator, c.value)))
                    : collectionRef;
                
                const querySnapshot = await getDocs(q);
                const documents: DocumentData[] = [];
                
                querySnapshot.forEach((doc) => {
                    // Asegurarse de que cada documento tenga su ID
                    if (doc.id) {
                        const data = doc.data();
                        // Asignar explícitamente el ID del documento a los datos
                        data.id = doc.id;
                        documents.push(data);
                    } else {
                        console.error('Error: Documento sin ID encontrado en la colección', collectionName);
                    }
                });
                
                return { success: true, data: documents };
            } catch (error) {
                console.error('Error getting documents:', error);
                return { success: false, error, data: [] };
            }
        }
    };
}

export const firebase = createFirebaseStore();