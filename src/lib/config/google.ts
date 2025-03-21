// Verificar si estamos en el navegador
const isBrowser = typeof window !== 'undefined';

// Obtener variables de entorno de manera segura para SSR
function getEnvVariable(name: string, defaultValue: string = ''): string {
    if (isBrowser && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
        return import.meta.env[name];
    }
    return defaultValue;
}

// Obtener la URI de redirección según el entorno
function getRedirectUri(): string {
    // Primero intentar obtener la URI desde variables de entorno (prioridad máxima)
    const envRedirectUri = getEnvVariable('VITE_GOOGLE_REDIRECT_URI');
    if (envRedirectUri) {
        return envRedirectUri;
    }
    
    // Si no hay variable de entorno, usar lógica basada en el entorno
    if (isBrowser) {
        const hostname = window.location.hostname;
        
        // Entorno de producción (dominio real)
        if (hostname !== 'localhost' && !hostname.includes('127.0.0.1')) {
            return `${window.location.protocol}//${hostname}/oauth/callback`;
        }
        
        // Entorno de desarrollo local
        return 'http://localhost:5173/oauth/callback';
    }
    
    // Valor por defecto para SSR
    return 'http://localhost:5173/oauth/callback';
}

export const GOOGLE_CONFIG = {
    clientId: getEnvVariable('VITE_GOOGLE_CLIENT_ID'),
    clientSecret: getEnvVariable('VITE_GOOGLE_CLIENT_SECRET'),
    redirectUri: getRedirectUri(),
    scopes: [
        'https://www.googleapis.com/auth/contacts',
        'https://www.googleapis.com/auth/contacts.readonly'
    ]
};
