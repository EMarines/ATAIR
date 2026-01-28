# Manejo de Credenciales en ATAIR

Este documento explica cómo manejar correctamente las credenciales sensibles en el proyecto ATAIR.

## Credenciales Sensibles

El proyecto utiliza varios tipos de credenciales sensibles:

1. **Firebase API Keys y configuración**
2. **EasyBroker API Key**
3. **Service Account de Firebase**

## Uso Correcto de Credenciales

### Archivo .env

Todas las credenciales deben almacenarse en el archivo `.env` que está incluido en `.gitignore` para evitar que se suban al repositorio. El archivo `.env.example` proporciona una plantilla de las variables necesarias.

### Service Account de Firebase

Anteriormente, las credenciales del Service Account se almacenaban en un archivo JSON (`service-account-key.json`). Ahora, estas credenciales deben almacenarse como variables de entorno en el archivo `.env`:

```
# Service Account Credentials
FIREBASE_SERVICE_ACCOUNT_TYPE=service_account
FIREBASE_SERVICE_ACCOUNT_PROJECT_ID=tu-project-id
FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_ID=tu-private-key-id
FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=tu-client-email
FIREBASE_SERVICE_ACCOUNT_CLIENT_ID=tu-client-id
FIREBASE_SERVICE_ACCOUNT_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_SERVICE_ACCOUNT_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_SERVICE_ACCOUNT_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_SERVICE_ACCOUNT_CLIENT_CERT_URL=tu-client-cert-url
```

## Archivos Sensibles que No Deben Subirse al Repositorio

Los siguientes archivos contienen información sensible y nunca deben subirse al repositorio:

1. `.env` - Contiene todas las credenciales
2. `src/lib/functions/service-account-key.json` - Archivo de credenciales de Firebase
3. `debug-tokens.html` - Contiene información de diagnóstico que podría exponer tokens
4. `diagnostico-simple.html` - Archivo de diagnóstico
5. `firebase-debug.log` - Logs que podrían contener información sensible

// ...resto del contenido existente...