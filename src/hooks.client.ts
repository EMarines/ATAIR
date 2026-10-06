// src/hooks.client.ts
// Inicialización del cliente y gestor de autenticación

import type { HandleClientError } from '@sveltejs/kit';
import { initializeAuthManager } from '$lib/firebase/authManager';

export const init = async () => {
	try {
		await initializeAuthManager();
	} catch (error) {
		console.error('❌ [ATAIR CRM] Error inicializando AuthManager en cliente:', error);
	}
};

export const handleError: HandleClientError = ({ error }) => {
	console.error('⚠️ [ATAIR CRM] Error en cliente:', error);
	return {
		message: 'Ocurrió un error inesperado en la interfaz.'
	};
};
