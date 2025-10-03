import type { Handle } from '@sveltejs/kit';

/**
 * Server hooks - simplificado para no interferir con Firebase Auth
 * La autenticación se maneja completamente en el cliente con Firebase
 * 
 * NOTA: Firebase Auth maneja la persistencia y validación de sesiones
 * en el lado del cliente. Las protecciones de rutas se implementan
 * en el cliente usando authGuard y hooks.client.ts
 */
export const handle: Handle = async ({ event, resolve }) => {
    // Simplemente resolver la petición sin validaciones de servidor
    // Firebase Auth + authGuard en cliente manejan la autenticación
    return await resolve(event);
};
