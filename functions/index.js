const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {google} = require('googleapis');

// Inicializar la aplicación de Firebase
admin.initializeApp();

/**
 * Configuración para la sincronización con Google Contacts
 * Estas credenciales deben ser reemplazadas con las de tu cuenta de servicio
 */
const GOOGLE_SERVICE_ACCOUNT_PATH = './service-account-key.json';

// Mapa para almacenar la relación entre IDs de Firebase y Google Contacts
let contactsMap = {};

/**
 * Carga el mapa de contactos desde Firestore
 * @return {Promise<Object>} Mapa de contactos
 */
async function loadContactsMap() {
  try {
    const doc = await admin.firestore()
        .collection('system')
        .doc('googleContactsMap')
        .get();

    if (doc.exists) {
      contactsMap = doc.data().map || {};
      console.log('Mapa de contactos cargado:', 
          Object.keys(contactsMap).length, 'contactos');
    } else {
      console.log('No se encontró mapa de contactos, creando uno nuevo');
      contactsMap = {};
      await saveContactsMap();
    }
    return contactsMap;
  } catch (error) {
    console.error('Error al cargar mapa de contactos:', error);
    return {};
  }
}

/**
 * Guarda el mapa de contactos en Firestore
 * @return {Promise<void>}
 */
async function saveContactsMap() {
  try {
    await admin.firestore()
        .collection('system')
        .doc('googleContactsMap')
        .set({
          map: contactsMap,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    console.log('Mapa de contactos guardado correctamente');
  } catch (error) {
    console.error('Error al guardar mapa de contactos:', error);
  }
}

/**
 * Obtiene un cliente JWT autenticado para Google API
 * @return {Promise<JWT>} Cliente JWT autenticado
 */
async function getAuthenticatedClient() {
  try {
    // Cargar credenciales de la cuenta de servicio
    const serviceAccount = require(GOOGLE_SERVICE_ACCOUNT_PATH);
    
    // Crear cliente JWT
    const jwtClient = new google.auth.JWT(
        serviceAccount.client_email,
        null,
        serviceAccount.private_key,
        ['https://www.googleapis.com/auth/contacts']
    );
    
    // Autenticar
    await jwtClient.authorize();
    return jwtClient;
  } catch (error) {
    console.error('Error al autenticar con Google:', error);
    throw error;
  }
}

/**
 * Convierte un contacto de Firebase a formato de Google Contacts
 * @param {Object} contact Contacto de Firebase
 * @return {Object} Contacto en formato de Google People API
 */
function firebaseToGoogleContact(contact) {
  const googleContact = {
    names: [{
      givenName: contact.firstName || '',
      familyName: contact.lastName || '',
    }],
    emailAddresses: [],
    phoneNumbers: [],
    organizations: [],
    addresses: [],
  };

  // Añadir email si existe
  if (contact.email) {
    googleContact.emailAddresses.push({
      value: contact.email,
      type: 'work',
    });
  }

  // Añadir teléfono si existe
  if (contact.phone) {
    googleContact.phoneNumbers.push({
      value: contact.phone,
      type: 'mobile',
    });
  }

  // Añadir organización si existe
  if (contact.company) {
    googleContact.organizations.push({
      name: contact.company,
      title: contact.position || '',
    });
  }

  // Añadir dirección si existe
  if (contact.address) {
    googleContact.addresses.push({
      streetAddress: contact.address,
      type: 'work',
    });
  }

  return googleContact;
}

/**
 * Convierte un contacto de Google a formato de Firebase
 * @param {Object} googleContact Contacto de Google
 * @return {Object} Contacto en formato de Firebase
 */
function googleToFirebaseContact(googleContact) {
  const contact = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    address: '',
    // Mantener otros campos necesarios en tu esquema
  };

  // Extraer nombre
  if (googleContact.names && googleContact.names.length > 0) {
    contact.firstName = googleContact.names[0].givenName || '';
    contact.lastName = googleContact.names[0].familyName || '';
  }

  // Extraer email
  if (googleContact.emailAddresses && googleContact.emailAddresses.length > 0) {
    contact.email = googleContact.emailAddresses[0].value || '';
  }

  // Extraer teléfono
  if (googleContact.phoneNumbers && googleContact.phoneNumbers.length > 0) {
    contact.phone = googleContact.phoneNumbers[0].value || '';
  }

  // Extraer organización
  if (googleContact.organizations && googleContact.organizations.length > 0) {
    contact.company = googleContact.organizations[0].name || '';
    contact.position = googleContact.organizations[0].title || '';
  }

  // Extraer dirección
  if (googleContact.addresses && googleContact.addresses.length > 0) {
    contact.address = googleContact.addresses[0].streetAddress || '';
  }

  return contact;
}

/**
 * Crea o actualiza un contacto en Google Contacts
 * @param {Object} contact Contacto de Firebase
 * @param {string} firebaseId ID del contacto en Firebase
 * @param {JWT} auth Cliente JWT autenticado
 * @return {Promise<string>} ID del contacto en Google
 */
async function createOrUpdateGoogleContact(contact, firebaseId, auth) {
  try {
    const people = google.people({version: 'v1', auth});
    const googleContact = firebaseToGoogleContact(contact);
    
    // Verificar si ya existe en Google (usando el mapa)
    const googleId = contactsMap[firebaseId];
    
    if (googleId) {
      // Actualizar contacto existente
      console.log(`Actualizando contacto en Google: ${firebaseId} -> ${googleId}`);
      
      const response = await people.people.updateContact({
        resourceName: `people/${googleId}`,
        updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
        requestBody: googleContact,
      });
      
      return googleId;
    } else {
      // Crear nuevo contacto
      console.log(`Creando nuevo contacto en Google para: ${firebaseId}`);
      
      const response = await people.people.createContact({
        requestBody: googleContact,
      });
      
      // Extraer ID de Google del resourceName (formato: "people/c123456789")
      const newGoogleId = response.data.resourceName.split('/')[1];
      
      // Actualizar mapa de contactos
      contactsMap[firebaseId] = newGoogleId;
      await saveContactsMap();
      
      return newGoogleId;
    }
  } catch (error) {
    console.error('Error al crear/actualizar contacto en Google:', error);
    throw error;
  }
}

/**
 * Elimina un contacto de Google Contacts
 * @param {string} firebaseId ID del contacto en Firebase
 * @param {JWT} auth Cliente JWT autenticado
 * @return {Promise<void>}
 */
async function deleteGoogleContact(firebaseId, auth) {
  try {
    // Verificar si existe en Google (usando el mapa)
    const googleId = contactsMap[firebaseId];
    
    if (!googleId) {
      console.log(`No se encontró contacto en Google para: ${firebaseId}`);
      return;
    }
    
    console.log(`Eliminando contacto de Google: ${firebaseId} -> ${googleId}`);
    
    const people = google.people({version: 'v1', auth});
    
    await people.people.deleteContact({
      resourceName: `people/${googleId}`,
    });
    
    // Eliminar del mapa
    delete contactsMap[firebaseId];
    await saveContactsMap();
    
    console.log(`Contacto eliminado correctamente de Google: ${googleId}`);
  } catch (error) {
    console.error('Error al eliminar contacto de Google:', error);
    throw error;
  }
}

/**
 * Función que se ejecuta cuando se crea o actualiza un contacto en Firebase
 */
exports.syncContactToGoogle = functions.firestore
    .document('contacts/{contactId}')
    .onWrite(async (change, context) => {
      try {
        // Cargar mapa de contactos
        await loadContactsMap();
        
        const contactId = context.params.contactId;
        const contactAfter = change.after.exists ? change.after.data() : null;
        const contactBefore = change.before.exists ? change.before.data() : null;
        
        // Obtener cliente autenticado
        const auth = await getAuthenticatedClient();
        
        // Si el contacto fue eliminado
        if (!contactAfter) {
          console.log(`Contacto eliminado en Firebase: ${contactId}`);
          await deleteGoogleContact(contactId, auth);
          return null;
        }
        
        // Si el contacto es nuevo o fue actualizado
        console.log(`Contacto creado/actualizado en Firebase: ${contactId}`);
        
        // Verificar que el contacto tenga un ID válido
        if (!contactId) {
          console.error('Error: ID de contacto inválido');
          return null;
        }
        
        // Crear o actualizar en Google
        await createOrUpdateGoogleContact(contactAfter, contactId, auth);
        
        return null;
      } catch (error) {
        console.error('Error en syncContactToGoogle:', error);
        return null;
      }
    });

/**
 * Función programada para sincronizar contactos de Google a Firebase
 * Se ejecuta cada 12 horas
 */
exports.syncContactsFromGoogle = functions.pubsub
    .schedule('every 12 hours')
    .onRun(async (context) => {
      try {
        // Cargar mapa de contactos
        await loadContactsMap();
        
        // Obtener cliente autenticado
        const auth = await getAuthenticatedClient();
        const people = google.people({version: 'v1', auth});
        
        // Obtener todos los contactos de Google
        const response = await people.people.connections.list({
          resourceName: 'people/me',
          pageSize: 1000,
          personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
        });
        
        const connections = response.data.connections || [];
        console.log(`Obtenidos ${connections.length} contactos de Google`);
        
        // Crear mapa inverso para búsqueda rápida
        const inverseMap = {};
        for (const [firebaseId, googleId] of Object.entries(contactsMap)) {
          inverseMap[googleId] = firebaseId;
        }
        
        // Procesar cada contacto de Google
        for (const googleContact of connections) {
          const googleId = googleContact.resourceName.split('/')[1];
          const firebaseContact = googleToFirebaseContact(googleContact);
          
          // Verificar si ya existe en Firebase
          const firebaseId = inverseMap[googleId];
          
          if (firebaseId) {
            // Actualizar contacto existente
            console.log(`Actualizando contacto en Firebase: ${googleId} -> ${firebaseId}`);
            
            await admin.firestore()
                .collection('contacts')
                .doc(firebaseId)
                .update(firebaseContact);
          } else {
            // Crear nuevo contacto en Firebase
            console.log(`Creando nuevo contacto en Firebase desde Google: ${googleId}`);
            
            const docRef = await admin.firestore()
                .collection('contacts')
                .add(firebaseContact);
            
            // Actualizar mapa
            contactsMap[docRef.id] = googleId;
          }
        }
        
        // Guardar mapa actualizado
        await saveContactsMap();
        
        console.log('Sincronización desde Google completada');
        return null;
      } catch (error) {
        console.error('Error en syncContactsFromGoogle:', error);
        return null;
      }
    });

/**
 * Endpoint HTTP para forzar la sincronización desde Google
 */
exports.forceSyncFromGoogle = functions.https.onCall(async (data, context) => {
  try {
    // Verificar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError(
          'unauthenticated', 
          'Se requiere autenticación para esta operación'
      );
    }
    
    // Ejecutar la sincronización
    console.log('Iniciando sincronización forzada desde Google');
    
    // Cargar mapa de contactos
    await loadContactsMap();
    
    // Obtener cliente autenticado
    const auth = await getAuthenticatedClient();
    const people = google.people({version: 'v1', auth});
    
    // Obtener todos los contactos de Google
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
    });
    
    const connections = response.data.connections || [];
    console.log(`Obtenidos ${connections.length} contactos de Google`);
    
    // Crear mapa inverso para búsqueda rápida
    const inverseMap = {};
    for (const [firebaseId, googleId] of Object.entries(contactsMap)) {
      inverseMap[googleId] = firebaseId;
    }
    
    // Procesar cada contacto de Google
    let updated = 0;
    let created = 0;
    
    for (const googleContact of connections) {
      const googleId = googleContact.resourceName.split('/')[1];
      const firebaseContact = googleToFirebaseContact(googleContact);
      
      // Verificar si ya existe en Firebase
      const firebaseId = inverseMap[googleId];
      
      if (firebaseId) {
        // Actualizar contacto existente
        await admin.firestore()
            .collection('contacts')
            .doc(firebaseId)
            .update(firebaseContact);
        updated++;
      } else {
        // Crear nuevo contacto en Firebase
        const docRef = await admin.firestore()
            .collection('contacts')
            .add(firebaseContact);
        
        // Actualizar mapa
        contactsMap[docRef.id] = googleId;
        created++;
      }
    }
    
    // Guardar mapa actualizado
    await saveContactsMap();
    
    console.log('Sincronización forzada completada');
    return {
      success: true,
      message: `Sincronización completada. Contactos: ${connections.length}, Actualizados: ${updated}, Creados: ${created}`,
    };
  } catch (error) {
    console.error('Error en forceSyncFromGoogle:', error);
    throw new functions.https.HttpsError(
        'internal', 
        `Error en la sincronización: ${error.message}`
    );
  }
});

/**
 * Endpoint HTTP para forzar la sincronización hacia Google
 */
exports.forceSyncToGoogle = functions.https.onCall(async (data, context) => {
  try {
    // Verificar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError(
          'unauthenticated', 
          'Se requiere autenticación para esta operación'
      );
    }
    
    // Ejecutar la sincronización
    console.log('Iniciando sincronización forzada hacia Google');
    
    // Cargar mapa de contactos
    await loadContactsMap();
    
    // Obtener cliente autenticado
    const auth = await getAuthenticatedClient();
    
    // Obtener todos los contactos de Firebase
    const snapshot = await admin.firestore().collection('contacts').get();
    
    console.log(`Obtenidos ${snapshot.size} contactos de Firebase`);
    
    // Procesar cada contacto
    let updated = 0;
    let created = 0;
    
    for (const doc of snapshot.docs) {
      const contactId = doc.id;
      const contact = doc.data();
      
      // Verificar si ya existe en Google
      const googleId = contactsMap[contactId];
      
      if (googleId) {
        // Actualizar contacto existente
        await createOrUpdateGoogleContact(contact, contactId, auth);
        updated++;
      } else {
        // Crear nuevo contacto
        await createOrUpdateGoogleContact(contact, contactId, auth);
        created++;
      }
    }
    
    console.log('Sincronización forzada completada');
    return {
      success: true,
      message: `Sincronización completada. Contactos: ${snapshot.size}, Actualizados: ${updated}, Creados: ${created}`,
    };
  } catch (error) {
    console.error('Error en forceSyncToGoogle:', error);
    throw new functions.https.HttpsError(
        'internal', 
        `Error en la sincronización: ${error.message}`
    );
  }
});
