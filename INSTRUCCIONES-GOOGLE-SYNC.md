# Instrucciones para implementar la sincronización Firebase-Google Contacts

Este documento proporciona instrucciones paso a paso para implementar la solución de sincronización automática entre Firebase y Google Contacts sin requerir autenticación OAuth por parte del usuario final.

## Paso 1: Configurar el proyecto en Google Cloud Console

1. Accede a la [Consola de Google Cloud](https://console.cloud.google.com/)
2. Selecciona tu proyecto existente (o crea uno nuevo)
3. Habilita la API de People:
   - Ve a "APIs y servicios" > "Biblioteca"
   - Busca "Google People API"
   - Haz clic en "Habilitar"

## Paso 2: Crear una cuenta de servicio

1. En la Consola de Google Cloud, ve a "IAM y administración" > "Cuentas de servicio"
2. Haz clic en "Crear cuenta de servicio"
3. Asigna un nombre descriptivo (por ejemplo, "ATAIR Google Contacts Sync")
4. Asigna el rol "Administrador de la API de People" a la cuenta
5. Haz clic en "Crear clave" y selecciona JSON
6. Guarda el archivo JSON descargado como `service-account-key.json` en la carpeta `functions`

## Paso 3: Configurar Firebase Functions

1. Instala Firebase CLI (si aún no lo has hecho):
   ```bash
   npm install -g firebase-tools
   ```

2. Inicia sesión en Firebase:
   ```bash
   firebase login
   ```

3. Asegúrate de que el archivo `.firebaserc` tenga el ID correcto de tu proyecto:
   ```json
   {
     "projects": {
       "default": "tu-proyecto-id"
     }
   }
   ```

4. Instala las dependencias:
   ```bash
   cd functions
   npm install
   ```

5. Despliega las funciones:
   ```bash
   firebase deploy --only functions
   ```

## Paso 4: Integrar el componente de sincronización en la interfaz

1. Reemplaza el componente actual de conexión con Google por el nuevo `GoogleSyncManager.svelte`

2. Ejemplo de uso en un archivo Svelte:
   ```svelte
   <script>
     import GoogleSyncManager from '$lib/components/GoogleSyncManager.svelte';
   </script>

   <div class="contacts-header">
     <h1>Contactos</h1>
     <GoogleSyncManager />
   </div>
   ```

## Paso 5: Realizar la primera sincronización

1. Accede a tu aplicación
2. Navega a la sección de contactos
3. Utiliza los botones de sincronización para realizar la primera sincronización:
   - "Sincronizar a Google" enviará tus contactos de Firebase a Google
   - "Sincronizar desde Google" importará tus contactos de Google a Firebase

## Notas importantes

### Sincronización automática

La sincronización funciona automáticamente:
- Cuando se crea, actualiza o elimina un contacto en Firebase, se sincroniza con Google Contacts
- Cada 12 horas, los contactos de Google se sincronizan con Firebase

### Seguridad

- Las credenciales de la cuenta de servicio son sensibles. Asegúrate de:
  - No incluir `service-account-key.json` en el control de versiones
  - Añadir `functions/service-account-key.json` a tu archivo `.gitignore`

### Solución de problemas

Si encuentras problemas con la sincronización:

1. Verifica los logs de Firebase Functions:
   ```bash
   firebase functions:log
   ```

2. Asegúrate de que la API de People esté habilitada en tu proyecto de Google Cloud

3. Verifica que la cuenta de servicio tenga los permisos adecuados

### Ventajas de esta solución

- No requiere autenticación OAuth por parte del usuario final
- La sincronización es automática y transparente
- Mantiene intacta toda la funcionalidad de comunicación con Google Contacts
- Respeta las preferencias de sincronización automática sin preguntar confirmación al usuario para cada acción

## Recursos adicionales

- [Documentación de Firebase Functions](https://firebase.google.com/docs/functions)
- [Documentación de Google People API](https://developers.google.com/people/api/rest)
- [Guía de cuentas de servicio de Google Cloud](https://cloud.google.com/iam/docs/service-accounts)
