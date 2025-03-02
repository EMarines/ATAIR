import { writable } from 'svelte/store';
import { collection, doc, deleteDoc, updateDoc, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { DocumentData, WhereFilterOp } from 'firebase/firestore';

interface FirebaseCondition {
    field: string;
    operator: WhereFilterOp;
    value: unknown;
}

function createFirebaseStore() {
    const { subscribe, set, update } = writable({});

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
        add: async (collectionName: string, data: DocumentData) => {
            try {
                const docRef = await addDoc(collection(db, collectionName), data);
                return { success: true, id: docRef.id };
            } catch (error) {
                console.error('Error adding document:', error);
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
                const docs: DocumentData[] = [];
                querySnapshot.forEach((doc) => {
                    docs.push({ id: doc.id, ...doc.data() });
                });
                return { success: true, data: docs };
            } catch (error) {
                console.error('Error getting documents:', error);
                return { success: false, error };
            }
        }
    };
}

export const firebase = createFirebaseStore();