# Cloud Functions para ATAIR

Este módulo proporciona las funciones de Firebase necesarias para el proyecto ATAIR.

## Características

- Manejo de contactos en Firebase
- Almacenamiento de datos en Firestore
- Autenticación de usuarios

## Requisitos previos

1. Proyecto de Firebase con Firestore habilitado
2. Cuenta de servicio de Firebase configurada

## Configuración

### 1. Configurar Firebase Functions

1. Instala Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Inicia sesión en Firebase:
   ```bash
   firebase login
   ```

3. Inicializa Firebase Functions:
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

## Estructura de datos

### Formato de contacto en Firebase

```javascript
{
  name: 'Nombre',
  lastname: 'Apellido',
  email: 'correo@ejemplo.com',
  telephon: '123456789',
  notes: 'Notas adicionales',
  createdAt: timestamp
  // Otros campos según el esquema
}
```

## Solución de problemas

### Logs

Para ver los logs de las funciones:

```bash
firebase functions:log
```

### Errores comunes

- **Error de autenticación**: Verifica las credenciales del Service Account
- **Error de permisos**: Asegúrate de tener los roles correctos en Firebase
- **Límites de cuota**: Revisa los límites de tu plan de Firebase