/**
 * Route configuration for role-based access control
 */

export const PUBLIC_ROUTES = ['/login'];

// Routes accessible by authenticated users with 'user' role
export const USER_ROUTES = [
    '/',
    '/properties',
    '/about',
    '/help',
];

// Routes that start with these paths and are restricted to 'admin' role
export const ADMIN_ONLY_PATHS = [
    '/contacts',
    '/actions',
    '/filtros',
    '/tramites',
    '/agenda',
];

/**
 * Checks if a path is public
 */
export function isPublicRoute(path: string): boolean {
    return PUBLIC_ROUTES.some(route => path === route || path.startsWith(route + '/'));
}

/**
 * Checks if a path is accessible by a regular user
 */
export function isUserRoute(path: string): boolean {
    if (isPublicRoute(path)) return true;
    
    // Properties and home are accessible by users
    if (path === '/' || path.startsWith('/properties')) return true;
    
    // Explicit user routes
    return USER_ROUTES.some(route => path === route || path.startsWith(route + '/'));
}

/**
 * Checks if a path is admin only
 */
export function isAdminOnlyRoute(path: string): boolean {
    return ADMIN_ONLY_PATHS.some(route => path === route || path.startsWith(route + '/'));
}
