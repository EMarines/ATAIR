/**
 * @deprecated
 * ESTE ARCHIVO ES LEGADO Y ESTÁ DESHABILITADO.
 * La autenticación ahora se maneja exclusivamente en $lib/firebase/authManager.ts
 * Se mantiene este archivo comentado para evitar errores de importación si existen
 * referencias residuales, pero no ejecuta ninguna lógica.
 */

/*
import { auth as authStore } from './firebaseEnvironmentService';
... (lógica comentada)
*/

export const authService = {
    verifyToken: async () => {
        console.warn('⚠️ authService.verifyToken llamado (Deprecado). No realiza ninguna acción.');
        return true;
    },
    logout: async () => {
        console.warn('⚠️ authService.logout llamado (Deprecado). Use authManager.handleLogout.');
    },
    destroy: () => {}
};
