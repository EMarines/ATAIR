# Guía de Despliegue en Vercel

Este documento proporciona instrucciones para desplegar correctamente la aplicación ATAIR en Vercel, asegurando que la sincronización con Google Contacts funcione correctamente.

## Requisitos Previos

1. Una cuenta en [Vercel](https://vercel.com)
2. Un proyecto configurado en la [Consola de Google Cloud](https://console.cloud.google.com) con la API de People habilitada
3. Acceso al repositorio de código de ATAIR

## Pasos para el Despliegue

### 1. Configurar Variables de Entorno en Vercel

Cuando crees un nuevo proyecto en Vercel, deberás configurar las siguientes variables de entorno:

```
PUBLIC_FIREBASE_API_KEY=tu-api-key
PUBLIC_FIREBASE_AUTH_DOMAIN=tu-auth-domain
PUBLIC_FIREBASE_PROJECT_ID=tu-project-id
PUBLIC_FIREBASE_STORAGE_BUCKET=tu-storage-bucket
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
PUBLIC_FIREBASE_APP_ID=tu-app-id

# Google API Configuration
VITE_GOOGLE_CLIENT_ID=tu-google-client-id
VITE_GOOGLE_CLIENT_SECRET=tu-google-client-secret
VITE_GOOGLE_REDIRECT_URI=https://tu-app.vercel.app/oauth/callback
```

Asegúrate de reemplazar los valores con tus credenciales reales.

### 2. Actualizar la URI de Redirección en Google Cloud Console

1. Ve a la [Consola de Google Cloud](https://console.cloud.google.com)
2. Selecciona tu proyecto
3. Ve a "APIs y Servicios" > "Credenciales"
4. Edita tu ID de cliente OAuth
5. En "URIs de redirección autorizados", añade:
   ```
   https://tu-app.vercel.app/oauth/callback
   ```
6. Guarda los cambios

### 3. Desplegar en Vercel

1. Conecta tu repositorio a Vercel
2. Configura el proyecto:
   - Framework preset: SvelteKit
   - Build command: `npm run build`
   - Output directory: `.svelte-kit/output/client`
   - Install command: `npm install`
3. Añade las variables de entorno mencionadas anteriormente
4. Haz clic en "Deploy"

### 4. Verificar la Configuración

Después del despliegue, verifica que:

1. La aplicación se carga correctamente
2. Puedes iniciar sesión
3. La sincronización con Google Contacts funciona como se espera

## Solución de Problemas

### Error de "App no verificada"

Este error es normal durante el desarrollo. Para continuar:

1. Haz clic en "Configuración avanzada" en la parte inferior del mensaje
2. Haz clic en "Ir a ATAIR (no seguro)"
3. Continúa con el proceso de autorización

Para eliminar esta advertencia en producción, deberás completar el proceso de verificación de Google, que incluye:

1. Añadir una política de privacidad
2. Configurar la pantalla de consentimiento OAuth
3. Enviar la aplicación para verificación

### Problemas con la URI de Redirección

Si recibes errores relacionados con la URI de redirección:

1. Verifica que la URI configurada en Google Cloud Console coincida exactamente con la URI de tu aplicación en Vercel
2. Asegúrate de que la variable `VITE_GOOGLE_REDIRECT_URI` en Vercel coincida con la URI autorizada en Google Cloud Console
3. Recuerda que las URIs distinguen entre mayúsculas y minúsculas y deben incluir el protocolo (https://)

### Errores de CORS

Si encuentras errores de CORS:

1. Verifica que estás haciendo las solicitudes desde el dominio autorizado
2. Asegúrate de que todas las APIs necesarias estén habilitadas en tu proyecto de Google Cloud

## Notas Importantes

- La sincronización de contactos entre Firebase y Google Contacts es automática y no requiere confirmación del usuario para cada acción
- Asegúrate de que el archivo `service-account-key.json` esté correctamente configurado y protegido
- Recuerda que la aplicación debe tener acceso a la API de People de Google para funcionar correctamente

Si tienes alguna pregunta o problema durante el despliegue, consulta la documentación oficial de [Vercel](https://vercel.com/docs) y [Google Cloud](https://cloud.google.com/docs).
