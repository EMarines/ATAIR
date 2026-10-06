// src/routes/api/auth/session/+server.ts
// Gestión de sesión en servidor para SvelteKit hooks

import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body = await request.json();
		const { token, role, uid, email } = body;

		if (!token || !uid) {
			// Limpiar cookie de sesión en cierre de sesión
			cookies.delete('atair_session', { path: '/' });
			return json({ status: 'logged_out' });
		}

		// Crear cookie de sesión segura (duración 7 días)
		const sessionData = JSON.stringify({
			uid,
			email,
			role: role || 'user',
			token
		});

		cookies.set('atair_session', sessionData, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 7 // 7 días
		});

		return json({ status: 'session_active', uid, role });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
};

export const GET: RequestHandler = async ({ cookies }) => {
	const raw = cookies.get('atair_session');
	if (!raw) {
		return json({ authenticated: false });
	}

	try {
		const session = JSON.parse(raw);
		return json({ authenticated: true, user: session });
	} catch {
		return json({ authenticated: false });
	}
};
