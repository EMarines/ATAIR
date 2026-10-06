// src/hooks.server.ts
// Guardián Server-Side de Seguridad y Control de Acceso por Roles (ATAIR CRM)

import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { isPublicRoute, isAdminOnlyRoute, canAccessRoute } from '$lib/config/routes';

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// 1. Extraer credenciales desde Cookie de sesión o Header Authorization
	const sessionCookie = event.cookies.get('atair_session');
	let sessionUser: App.Locals['user'] = null;

	if (sessionCookie) {
		try {
			const parsed = JSON.parse(sessionCookie);
			if (parsed.uid && parsed.email) {
				sessionUser = {
					uid: parsed.uid,
					email: parsed.email,
					role: parsed.role || 'user'
				};
			}
		} catch {
			event.cookies.delete('atair_session', { path: '/' });
		}
	} else {
		// Soporte para Bearer token / Headers en llamadas programáticas
		const authHeader = event.request.headers.get('Authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const headerUid = event.request.headers.get('x-user-uid');
			const headerEmail = event.request.headers.get('x-user-email');
			const headerRole = (event.request.headers.get('x-user-role') as any) || 'user';
			if (headerUid && headerEmail) {
				sessionUser = {
					uid: headerUid,
					email: headerEmail,
					role: headerRole
				};
			}
		}
	}

	// 2. Inyectar usuario en locals del ciclo de vida del servidor
	event.locals.user = sessionUser;

	// 3. Blindaje de Rutas API (/api/*)
	if (pathname.startsWith('/api')) {
		// Endpoints públicos de autenticación o healthcheck
		if (pathname.startsWith('/api/auth')) {
			return await resolve(event);
		}

		// Si es cualquier otro endpoint de la API y no hay sesión autenticada: Bloqueo 401
		if (!sessionUser) {
			return json(
				{
					error: 'Unauthorized',
					message: 'Acceso denegado: Se requiere autenticación activa para interactuar con la API'
				},
				{ status: 401 }
			);
		}

		// Si es un endpoint exclusivo de administrador y el rol no es admin: Bloqueo 403
		if (pathname.startsWith('/api/admin') && sessionUser.role !== 'admin') {
			return json(
				{
					error: 'Forbidden',
					message: 'Acceso denegado: Se requieren privilegios de Administrador'
				},
				{ status: 403 }
			);
		}
	}

	// 4. Blindaje de Rutas de Interfaz (SSR / Navegación)
	const isPublic = isPublicRoute(pathname);

	// Si no es pública y no hay usuario autenticado: Redirigir a login
	if (!isPublic && !sessionUser) {
		// Evitar bucle si ya está en login
		if (pathname !== '/login') {
			throw redirect(303, `/login?redirect=${encodeURIComponent(pathname)}`);
		}
	}

	// Si el usuario autenticado intenta entrar a /login, redirigir al dashboard
	if (sessionUser && pathname === '/login') {
		throw redirect(303, '/');
	}

	// Si es una ruta exclusiva de admin y el usuario no tiene rol admin: Redirigir al inicio de asociados
	if (isAdminOnlyRoute(pathname) && sessionUser?.role !== 'admin') {
		throw redirect(303, '/');
	}

	return await resolve(event);
};
