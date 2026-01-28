import { db } from '$lib/firebase_toggle';
import type { Todo } from '$lib/types';
import { systStatus } from '$lib/stores/dataStore';
import { get } from 'svelte/store';
import { collection, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';

export async function todoSave(todo: Todo) {
    const status = get(systStatus);
    const todoData = {
        stage: todo.stage || 0,
        endTask: todo.endTask || Date.now(),
        createdAt: todo.createdAt || Date.now(),
        notes: todo.notes || '',
        isCompleted: todo.isCompleted || false,
        task: todo.task || '',
        type: todo.type || '',
        user: todo.user || ''
    };
    
    if (!todoData.task) {
        throw new Error('La tarea es requerida');
    }

    if(status === "todoAdding") {
        const todoToAdd = collection(db, "todos");
        await addDoc(todoToAdd, todoData);
    } else if(status === "todoUpdate" && todo.id) {
        await updateDoc(doc(db, "todos", todo.id), todoData);
    } else if(status === "todoDelete" && todo.id) {
        await deleteDoc(doc(db, "todos", todo.id));
    }
}