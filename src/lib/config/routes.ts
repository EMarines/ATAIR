// src/lib/config/routes.ts
// Reglas y Guardianes de Acceso por Rol (Admin vs Asociado)

import type { UserRole } from '$lib/types/auth';

export const PUBLIC_ROUTES = [
	'/login',
	'/api/auth/session',
	'/api/auth/check'
];

export const ADMIN_ONLY_ROUTES = [
	'/admin',
	'/admin/asociados',
	'/admin/configuracion',
	'/api/admin'
];

export const ASOCIADO_ALLOWED_ROUTES = [
	'/',
	'/dashboard',
	'/ingesta-lead',
	'/contacts',
	'/contact',
	'/properties',
	'/property',
	'/subir-propiedad',
	'/subir-link',
	'/agenda',
	'/herramientas'
];

/**
 * Determina si una ruta es completamente pública
 */
export function isPublicRoute(pathname: string): boolean {
	return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

/**
 * Determina si una ruta requiere privilegios exclusivos de Administrador
 */
export function isAdminOnlyRoute(pathname: string): boolean {
	return ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

/**
 * Verifica si un rol específico tiene autorización para acceder a una ruta
 */
export function canAccessRoute(pathname: string, role: UserRole | null | undefined): boolean {
	if (isPublicRoute(pathname)) return true;
	if (!role) return false;

	// Administradores tienen acceso a todo el sistema
	if (role === 'admin') return true;

	// Si es ruta exclusiva de admin y no es admin, denegar
	if (isAdminOnlyRoute(pathname)) return false;

	// Asociados tienen acceso a sus rutas operativas
	if (role === 'asociado' || role === 'user') {
		return ASOCIADO_ALLOWED_ROUTES.some(
			(route) => pathname === route || pathname.startsWith(route + '/')
		);
	}

	return false;
}
