/**
 * Client-side hooks para SvelteKit
 * Maneja la verificación inicial de sesión y redirecciones de autenticación
 */

import type { HandleClientError } from '@sveltejs/kit';
import { initializeAuthManager } from '$lib/firebase/authManager';

// Inicializar el gestor de autenticación cuando se carga la app
export const init = async () => {
    try {
        await initializeAuthManager();
    } catch (error) {
        console.error('❌ Error inicializando AuthManager:', error);
    }
};

/**
 * Maneja errores del cliente
 */
export const handleError: HandleClientError = ({ error }) => {
    console.error('Error en cliente:', error);
    
    // Aquí puedes agregar lógica para reportar errores a un servicio
    // como Sentry, LogRocket, etc.
    
    return {
        message: 'Ha ocurrido un error inesperado'
    };
};