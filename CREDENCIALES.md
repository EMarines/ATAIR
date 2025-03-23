# Manejo de Credenciales en ATAIR

Este documento explica cómo manejar correctamente las credenciales sensibles en el proyecto ATAIR.

## Credenciales Sensibles

El proyecto utiliza varios tipos de credenciales sensibles:

1. **Firebase API Keys y configuración**
2. **EasyBroker API Key**
3. **Google OAuth Credentials** (client ID y client secret)
4. **Service Account de Firebase**

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

### Despliegue en Vercel

Al desplegar en Vercel, debes configurar todas estas variables de entorno en el panel de configuración de Vercel. Consulta el archivo `DEPLOYMENT.md` para más detalles.

## Archivos Sensibles que No Deben Subirse al Repositorio

Los siguientes archivos contienen información sensible y nunca deben subirse al repositorio:

1. `.env` - Contiene todas las credenciales
2. `src/lib/functions/service-account-key.json` - Archivo de credenciales de Firebase (ahora reemplazado por variables de entorno)
3. `debug-tokens.html` - Contiene información de diagnóstico que podría exponer tokens
4. `diagnostico-google.html` y `diagnostico-simple.html` - Archivos de diagnóstico
5. `firebase-debug.log` - Logs que podrían contener información sensible

Estos archivos ya están incluidos en el `.gitignore` para evitar que se suban accidentalmente.

## Migración de service-account-key.json a Variables de Entorno

Si estás migrando de usar el archivo JSON a variables de entorno, sigue estos pasos:

1. Abre tu archivo `service-account-key.json`
2. Copia cada valor a la variable de entorno correspondiente en el archivo `.env`
3. Para la `private_key`, asegúrate de incluir las comillas y reemplazar los saltos de línea con `\n`
4. Elimina el archivo `service-account-key.json` una vez que hayas verificado que todo funciona correctamente

## Seguridad Adicional

- Nunca compartas tus credenciales con nadie
- Considera rotar tus credenciales periódicamente
- Utiliza permisos mínimos necesarios para cada credencial
- Considera usar servicios de gestión de secretos para entornos de producción
