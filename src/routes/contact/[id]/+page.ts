import type { PageLoad } from './$types';
import { db } from '$lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
    const docRef = doc(db, 'contacts', params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        throw error(404, 'Contacto no encontrado');
    }

    return {
        contact: {
            ...docSnap.data(),
            id: docSnap.data().id || params.id
        }
    };
}; 