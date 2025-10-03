/**
 * Client-side hooks para SvelteKit
 * Maneja la verificación inicial de sesión y redirecciones de autenticación
 */

import type { HandleClientError } from '@sveltejs/kit';
import { authService } from '$lib/services/authService';
import { initializeAuthManager } from '$lib/firebase/authManager';

// Inicializar el gestor de autenticación cuando se carga la app
if (typeof window !== 'undefined') {
    console.log('🔄 Inicializando hooks.client.ts');
    
    // Inicializar el gestor de autenticación
    initializeAuthManager().then(() => {
        console.log('✅ AuthManager inicializado desde hooks.client');
        
        // Verificar si hay una sesión persistente
        const isLoggedIn = localStorage.getItem('user-logged-in') === 'true';
        if (isLoggedIn) {
            console.log('🔍 Sesión persistente detectada, verificando...');
            authService.verifyToken().then(isValid => {
                if (isValid) {
                    console.log('✅ Sesión restaurada exitosamente');
                } else {
                    console.warn('⚠️ Sesión expirada, se requiere nuevo login');
                }
            });
        } else {
            console.log('ℹ️ No hay sesión persistente');
        }
    });
}

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
