import type { LayoutServerLoad } from './$types';

// NOTA: Los datos de Firebase (contacts, binnacles, todos, properties) se cargan
// del lado del cliente en +layout.svelte mediante onSnapshot listeners,
// que se activan DESPUÉS de que el usuario se autentica correctamente.
// No se deben cargar aquí porque el server-side no tiene sesión de Firebase Auth.

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
    const lastSyncDate = cookies.get('lastSyncDate') || null;

    return {
        user: locals.user,
        lastSyncDate
    };
};
