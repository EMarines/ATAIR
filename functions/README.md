# Sincronización entre Firebase y Google Contacts

Este módulo proporciona una solución completa para sincronizar contactos entre Firebase y Google Contacts de forma automática, sin requerir que los usuarios finales se autentiquen con Google.

## Características

- Sincronización automática de contactos de Firebase a Google Contacts cuando se crean, actualizan o eliminan
- Sincronización programada de Google Contacts a Firebase cada 12 horas
- Endpoints HTTP para forzar la sincronización en cualquier momento
- No requiere autenticación OAuth por parte del usuario final
- Mantiene un mapa de relaciones entre IDs de Firebase y Google Contacts

## Requisitos previos

1. Proyecto de Firebase con Firestore habilitado
2. Proyecto de Google Cloud con la API de People habilitada
3. Cuenta de servicio de Google con permisos para acceder a la API de People

## Configuración

### 1. Crear una cuenta de servicio en Google Cloud

1. Ve a la [Consola de Google Cloud](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a "IAM y administración" > "Cuentas de servicio"
4. Haz clic en "Crear cuenta de servicio"
5. Asigna un nombre y descripción a la cuenta de servicio
6. Asigna el rol "Administrador de la API de People" a la cuenta
7. Haz clic en "Crear clave" y selecciona JSON
8. Guarda el archivo JSON descargado como `service-account-key.json` en la carpeta `functions`

### 2. Configurar Firebase Functions

1. Instala Firebase CLI si aún no lo has hecho:
   ```bash
   npm install -g firebase-tools
   ```

2. Inicia sesión en Firebase:
   ```bash
   firebase login
   ```

3. Inicializa Firebase Functions en tu proyecto (si aún no lo has hecho):
   ```bash
   firebase init functions
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

## Uso

### Sincronización automática

La sincronización funciona automáticamente:

- Cuando se crea, actualiza o elimina un contacto en Firebase, se sincroniza con Google Contacts
- Cada 12 horas, los contactos de Google se sincronizan con Firebase

### Sincronización manual

Para forzar la sincronización, puedes llamar a las funciones HTTP desde tu aplicación:

```javascript
// Para sincronizar desde Firebase a Google
const syncToGoogle = firebase.functions().httpsCallable('forceSyncToGoogle');
syncToGoogle().then(result => {
  console.log(result.data.message);
}).catch(error => {
  console.error('Error:', error);
});

// Para sincronizar desde Google a Firebase
const syncFromGoogle = firebase.functions().httpsCallable('forceSyncFromGoogle');
syncFromGoogle().then(result => {
  console.log(result.data.message);
}).catch(error => {
  console.error('Error:', error);
});
```

## Estructura de datos

### Mapa de contactos

El mapa de contactos se almacena en Firestore en la colección `system` con el documento `googleContactsMap`. Este mapa mantiene la relación entre los IDs de Firebase y los IDs de Google Contacts.

### Formato de contacto en Firebase

```javascript
{
  firstName: 'Nombre',
  lastName: 'Apellido',
  email: 'correo@ejemplo.com',
  phone: '123456789',
  company: 'Empresa',
  position: 'Cargo',
  address: 'Dirección'
  // Otros campos según tu esquema
}
```

## Solución de problemas

### Logs

Para ver los logs de las funciones:

```bash
firebase functions:log
```

### Errores comunes

- **Error de autenticación**: Verifica que el archivo `service-account-key.json` esté correctamente ubicado y tenga los permisos adecuados.
- **Error de API no habilitada**: Asegúrate de que la API de People esté habilitada en tu proyecto de Google Cloud.
- **Límites de cuota**: Revisa los límites de cuota de la API de People en la consola de Google Cloud.

## Notas importantes

- Esta solución mantiene intacta toda la funcionalidad de comunicación con Google Contacts.
- La sincronización es automática, sin preguntar confirmación al usuario para cada acción.
- Se respetan los IDs de contacto y se mantiene la integridad de los datos.
