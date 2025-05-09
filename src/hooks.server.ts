import { redirect, type Handle } from '@sveltejs/kit';

// Lista de rutas protegidas (añade todas las rutas que quieras proteger)
const protectedRoutes = [
    '/contacts',
    '/properties',
    '/contact',
    '/property',
    '/agenda',
    
    // Añadir más rutas protegidas según sea necesario
];

// Lista de rutas de autenticación (no redirigir estas rutas)
const authRoutes = ['/login', '/'];

export const handle: Handle = async ({ event, resolve }) => {
    // Obtener la ruta actual
    const path = event.url.pathname;
    
    // Verificar si la ruta actual está protegida
    const isProtectedRoute = protectedRoutes.some(route => 
        path.startsWith(route) || path === route);
    
    // Si no es una ruta protegida, continuar normalmente
    if (!isProtectedRoute) {
        return await resolve(event);
    }

    // Verificar si el usuario está autenticado usando la cookie de sesión
    const session = event.cookies.get('session');
    
    if (!session) {
        // Usuario no autenticado, redirigir al login
        throw redirect(303, `/login?redirectTo=${encodeURIComponent(path)}`);
    }
    
    // Validar la sesión (esto dependerá de tu implementación)
    try {
        // Puedes verificar el token JWT o validar la sesión contra tu backend
        // Si es inválido, lanzar un error
        
        // Ejemplo simple (deberías implementar tu propia validación)
        const userData = JSON.parse(session);
        if (!userData || !userData.id) {
            throw new Error('Invalid session');
        }
        
        // Añadir datos del usuario al event.locals para acceso en rutas
        event.locals.user = userData;
        
    } catch (e) {
        // Sesión inválida, eliminar cookie y redirigir
        event.cookies.delete('session', { path: '/' });
        throw redirect(303, `/login?redirectTo=${encodeURIComponent(path)}`);
    }
    
    // Usuario autenticado, continuar con la solicitud
    return await resolve(event);
};
