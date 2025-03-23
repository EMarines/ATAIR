import { dev } from '$app/environment';
import { browser } from '$app/environment';

// Esta función genera un objeto de credenciales de service account a partir de variables de entorno
export function getServiceAccountCredentials() {
    if (browser) {
        console.error('Las credenciales del service account no deben usarse en el navegador');
        return null;
    }

    try {
        // En desarrollo, intentamos cargar desde el archivo JSON si está disponible
        if (dev) {
            try {
                // Importación dinámica para evitar errores en tiempo de compilación
                const serviceAccountKey = require('./service-account-key.json');
                return serviceAccountKey;
            } catch (error) {
                console.log('No se pudo cargar el archivo service-account-key.json, usando variables de entorno');
            }
        }

        // Si no estamos en desarrollo o no se pudo cargar el archivo, usamos variables de entorno
        const privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

        return {
            type: process.env.FIREBASE_SERVICE_ACCOUNT_TYPE || 'service_account',
            project_id: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
            private_key_id: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
            private_key: privateKey,
            client_email: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_ID,
            auth_uri: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
            token_uri: process.env.FIREBASE_SERVICE_ACCOUNT_TOKEN_URI || 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_CERT_URL
        };
    } catch (error) {
        console.error('Error al cargar las credenciales del service account:', error);
        return null;
    }
}
