// src/routes/api/test-guard/+server.ts
// Endpoint de prueba para verificar el guardián server-side

import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	return json({
		status: 'ok',
		message: 'Acceso autorizado al servidor de ATAIR CRM',
		authenticatedUser: locals.user
	});
};
