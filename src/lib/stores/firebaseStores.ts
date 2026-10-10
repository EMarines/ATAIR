import { writable } from 'svelte/store';
import { collection, doc, deleteDoc, updateDoc, addDoc, getDocs, query, where, setDoc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase_toggle';
import type { DocumentData, WhereFilterOp } from 'firebase/firestore';

interface FirebaseCondition {
    field: string;
    operator: WhereFilterOp;
    value: unknown;
}

function sanitizeForFirestore<T>(data: T): T {
    if (data === undefined) return null as any;
    if (data === null || typeof data !== 'object') return data;
    if (data instanceof Date || typeof (data as any).toMillis === 'function') return data;
    if (Array.isArray(data)) {
        return data.map(sanitizeForFirestore).filter((item) => item !== undefined) as any;
    }
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
        if (val !== undefined) {
            clean[key] = sanitizeForFirestore(val);
        }
    }
    return clean as T;
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
                const cleanData = sanitizeForFirestore(data);
                await updateDoc(doc(db, collectionName, id), cleanData);
                return { success: true };
            } catch (error) {
                console.error('Error updating document:', error);
                return { success: false, error };
            }
        },
        // Método para crear o sobrescribir un documento con un ID específico
        set: async (collectionName: string, id: string, data: DocumentData) => {
            try {
                const cleanData = sanitizeForFirestore(data);
                await setDoc(doc(db, collectionName, id), cleanData);
                return { success: true, id };
            } catch (error) {
                console.error('Error setting document:', error);
                return { success: false, error };
            }
        },
        add: async (collectionName: string, data: DocumentData) => {
            try {
                const cleanData = sanitizeForFirestore(data);
                const docRef = await addDoc(collection(db, collectionName), cleanData);
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
                const cleanData = sanitizeForFirestore(data);
                await setDoc(docRef, cleanData);
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