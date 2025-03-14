// Verificar si estamos en el navegador
const isBrowser = typeof window !== 'undefined';

// Obtener variables de entorno de manera segura para SSR
function getEnvVariable(name: string, defaultValue: string = ''): string {
    if (isBrowser && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
        return import.meta.env[name];
    }
    return defaultValue;
}

export const GOOGLE_CONFIG = {
    clientId: getEnvVariable('VITE_GOOGLE_CLIENT_ID'),
    clientSecret: getEnvVariable('VITE_GOOGLE_CLIENT_SECRET'),
    redirectUri: 'http://localhost:5173/auth/callback',
    scopes: [
        'https://www.googleapis.com/auth/contacts',
        'https://www.googleapis.com/auth/contacts.readonly'
    ]
};
