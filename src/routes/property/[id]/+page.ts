// src/routes/property/[id]/+page.ts
import type { PageLoad } from './$types';
import { db } from '$lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { normalizeProperty } from '$lib/functions/normalizeProperty';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const rawId = params.id;
	if (!rawId) {
		throw error(404, 'ID de propiedad no válido');
	}

	const id = decodeURIComponent(rawId).trim();

	// 1. Búsqueda directa por ID de documento en colección 'properties'
	try {
		const docRef = doc(db, 'properties', id);
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			return {
				property: normalizeProperty(docSnap.data(), docSnap.id)
			};
		}
	} catch (e) {
		console.warn('[PropertyPage] Direct doc lookup failed:', e);
	}

	// 2. Búsqueda por campos clave (public_id, clavePropiedad, easybroker_id, etc.)
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
			console.warn(`[PropertyPage] Query field ${field} failed:`, e);
		}
	}

	// 3. Fallback en colección 'easybroker_properties'
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
		console.warn('[PropertyPage] Fallback easybroker_properties failed:', e);
	}

	throw error(404, `Propiedad no encontrada (${id})`);
};
