import type { PageLoad } from './$types';
import { db } from '$lib/firebase_toggle';
import { doc, getDoc } from 'firebase/firestore';
import { error, redirect } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
    try {
        // Validar que el ID del parámetro sea válido
        if (!params.id || params.id.trim() === '') {
            console.error('Error: ID de contacto no proporcionado o inválido');
            throw redirect(303, '/contacts');
        }

        const docRef = doc(db, 'contacts', params.id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error(`Error: Contacto con ID ${params.id} no encontrado`);
            throw redirect(303, '/contacts');
        }

        const data = docSnap.data();
        
        // Asegurarse de que el ID del contacto esté siempre presente y sea válido
        const contactData = {
            ...data,
            id: params.id // Usar el ID del parámetro de la URL
        };

        // Verificación exhaustiva del ID
        if (!contactData.id || contactData.id.trim() === '') {
            console.error('Error crítico: ID de contacto faltante después de cargar los datos', contactData);
            throw redirect(303, '/contacts');
        }

        console.log('Contacto cargado exitosamente con ID:', contactData.id);

        return {
            contact: contactData
        };
    } catch (e) {
        if (e instanceof Response) {
            // Si es una redirección, dejarla pasar
            throw e;
        }
        console.error('Error loading contact:', e);
        throw redirect(303, '/contacts');
    }
};