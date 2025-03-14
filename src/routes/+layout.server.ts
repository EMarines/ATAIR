import type { LayoutServerLoad } from './$types';
// import { fetchAllProperties } from '$lib/functions/fetchAllPrperties';
import { getContacts, getBinnacles, getTodos, getProperties } from '$lib/firebase/db';

export const load: LayoutServerLoad = async ({ fetch, locals, cookies }) => {
    
    // const propertiesEB = await fetchAllProperties(fetch, true);

    console.log('Obteniendo datos de Firebase');
    const [contactsFB, binnaclesFB, todosFB, propertiesFB] = await Promise.all([
        getContacts(),
        getBinnacles(),
        getTodos(),       
        getProperties(),
    ]);

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
};


