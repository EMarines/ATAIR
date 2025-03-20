// Verificar si estamos en el navegador
const isBrowser = typeof window !== 'undefined';

// Importar credenciales directas para producción
import { GOOGLE_CREDENTIALS } from './google-credentials';

// Obtener variables de entorno de manera segura para SSR
function getEnvVariable(name: string, defaultValue: string = ''): string {
    if (isBrowser && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
        return import.meta.env[name];
    }
    return defaultValue;
}

// Obtener la URL base actual
function getBaseUrl(): string {
    if (isBrowser) {
        return `${window.location.protocol}//${window.location.host}`;
    }
    return 'http://localhost:5173'; // Valor por defecto para SSR
}

export const GOOGLE_CONFIG = {
    // Usar credenciales directas como fallback si las variables de entorno no están disponibles
    clientId: getEnvVariable('VITE_GOOGLE_CLIENT_ID', GOOGLE_CREDENTIALS.clientId),
    clientSecret: getEnvVariable('VITE_GOOGLE_CLIENT_SECRET', GOOGLE_CREDENTIALS.clientSecret),
    redirectUri: `${getBaseUrl()}/auth/callback`,
    scopes: [
        'https://www.googleapis.com/auth/contacts',
        'https://www.googleapis.com/auth/contacts.readonly'
    ]
};
