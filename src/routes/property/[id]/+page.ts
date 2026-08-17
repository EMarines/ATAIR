import type { PageLoad } from './$types';
import { db } from '$lib/firebase_toggle';
import { doc, getDoc } from 'firebase/firestore';
import type { Property } from '$lib/types';
import { normalizeProperty } from '$lib/functions/normalizeProperty';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
    const docRef = doc(db, 'easybroker_properties', params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        throw error(404, 'Propiedad no encontrada');
    }

    return {
        property: normalizeProperty(docSnap.data(), docSnap.id)
    };
};
