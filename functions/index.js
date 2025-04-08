const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar la aplicación de Firebase
admin.initializeApp();

// Función para obtener las credenciales del service account
function getServiceAccountCredentials() {
  try {
    // En desarrollo, intentamos cargar desde el archivo JSON si está disponible
    if (process.env.NODE_ENV === 'development') {
      try {
        return require('./service-account-key.json');
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

// Aquí puedes agregar otras funciones Cloud que no estén relacionadas con Google Contacts