import type { LayoutServerLoad } from './$types';
// Corregido: nombre de archivo en el comentario (typo en fetchAllPrperties)
// import { fetchAllProperties } from '$lib/functions/fetchAllProperties';
import { getContacts, getBinnacles, getTodos, getProperties } from '$lib/firebase/db';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
    try {
        console.log('Obteniendo datos de Firebase');
        // Añadido manejo de errores para cada promesa individual
        const [contactsFB, binnaclesFB, todosFB, propertiesFB] = await Promise.allSettled([
            getContacts(),
            getBinnacles(),
            getTodos(),       
            getProperties(),
        ]).then(results => {
            return results.map(result => 
                result.status === 'fulfilled' ? result.value : []
            );
        });

        // Obtener la fecha de última sincronización
        const lastSyncDate = cookies.get('lastSyncDate');
        console.log('Última fecha de sincronización:', lastSyncDate);

        return {
            contactsFB,
            binnaclesFB,
            todosFB,
            propertiesFB,
            user: locals.user,
            // propertiesEB,
            lastSyncDate
        };
    } catch (error) {
        console.error('Error al cargar datos en layout.server.ts:', error);
        
        // En caso de error, devolver datos vacíos pero no fallar completamente
        return {
            contactsFB: [],
            binnaclesFB: [],
            todosFB: [],
            propertiesFB: [],
            user: locals.user,
            lastSyncDate: null
        };
    }
};
