import type { PageLoad } from './$types';
import { db } from '$lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
    try {
        if (!params.id) {
            throw error(400, 'ID de contacto no proporcionado');
        }

        const docRef = doc(db, 'contacts', params.id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw error(404, 'Contacto no encontrado');
        }

        const data = docSnap.data();
        // Asegurarse de que el ID del contacto esté siempre presente
        const contactData = {
            ...data,
            id: params.id // Usar el ID del parámetro de la URL
        };

        // Verificar que el ID esté presente
        if (!contactData.id) {
            console.error('Error: ID de contacto faltante después de cargar los datos', contactData);
            throw error(500, 'Error al cargar el contacto: ID faltante');
        }

        return {
            contact: contactData
        };
    } catch (e) {
        console.error('Error loading contact:', e);
        throw error(500, 'Error al cargar el contacto');
    }
};