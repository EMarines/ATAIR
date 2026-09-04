import type { PageLoad } from './$types';
import { db } from '$lib/firebase_toggle';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { Property } from '$lib/types';
import { normalizeProperty } from '$lib/functions/normalizeProperty';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
    const rawId = params.id;
    if (!rawId) {
        throw error(404, 'ID de propiedad no válido');
    }

    const id = decodeURIComponent(rawId).trim();

    // 1. Direct doc ID lookup in properties collection
    try {
        const docRef = doc(db, 'properties', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return {
                property: normalizeProperty(docSnap.data(), docSnap.id)
            };
        }
    } catch (e) {
        console.warn('Direct doc lookup error:', e);
    }

    // 2. Query across possible identifier fields in properties collection
    const searchFields = ['public_id', 'clavePropiedad', 'id', 'easybroker_id', 'claveEB', 'claveMH'];
    for (const field of searchFields) {
        try {
            const q = query(collection(db, 'properties'), where(field, '==', id), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                const foundDoc = qSnap.docs[0];
                return {
                    property: normalizeProperty(foundDoc.data(), foundDoc.id)
                };
            }
        } catch (e) {
            console.warn(`Query on field ${field} failed:`, e);
        }
    }

    // 3. Fallback: Check easybroker_properties collection if it exists
    try {
        const ebDocRef = doc(db, 'easybroker_properties', id);
        const ebDocSnap = await getDoc(ebDocRef);
        if (ebDocSnap.exists()) {
            return {
                property: normalizeProperty(ebDocSnap.data(), ebDocSnap.id)
            };
        }

        const ebQuery = query(collection(db, 'easybroker_properties'), where('public_id', '==', id), limit(1));
        const ebSnap = await getDocs(ebQuery);
        if (!ebSnap.empty) {
            const foundEbDoc = ebSnap.docs[0];
            return {
                property: normalizeProperty(foundEbDoc.data(), foundEbDoc.id)
            };
        }
    } catch (e) {
        console.warn('Fallback easybroker_properties check failed:', e);
    }

    throw error(404, `Propiedad no encontrada (${id})`);
};

