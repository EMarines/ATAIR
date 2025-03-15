import { writable } from 'svelte/store';
import type { Contact, Property, Binnacle, Todo } from '$lib/types';
import { firebase } from './firebaseStores';

const defaultContact: Contact = {
    createdAt: Date.now(),
    name: '',
    typeContact: '',
    telephon: '',
    lastname: '',
    email: '',
    budget: 0,
    selecTP: '',
    contactStage: '',
    comContact: '',
    tagsProperty: [],
    locaProperty: [],
    color: '',
    contactType: '',
    contMode: '',
    halfBathroom: '',
    id: '',
    lastContact: 0,
    modePay: '',
    numBaths: '',
    numBeds: '',
    numParks: '',
    propCont: '',
    rangeProp: '',
    selecTO: '',
    selecMC: '',
    sendedProperties: [],
    title: '',
    typeProperty: '',
    typeOperation: ''
};

function createContactStore() {
    const { subscribe, set, update } = writable<Contact>(defaultContact);
    return {
        subscribe,
        set,
        update,
        reset: () => set(defaultContact)
    };
}

// Store para contactos
function createContactsStore() {
    const { subscribe, set, update } = writable<Contact[]>([]);

    // Función para cargar contactos desde Firebase
    const loadContacts = async () => {
        try {
            // Obtener todos los contactos de Firebase
            const result = await firebase.getAll('contacts');
            
            if (result.success && Array.isArray(result.data)) {
                // Filtrar contactos inválidos
                const validContacts = result.data
                    .filter((doc: any) => doc && doc.id && doc.id.trim() !== '')
                    .map((doc: any) => {
                        // Asegurarse de que todos los campos tengan valores por defecto
                        return {
                            id: doc.id,
                            createdAt: doc.createdAt || Date.now(),
                            name: doc.name || '',
                            lastname: doc.lastname || '',
                            email: doc.email || '',
                            telephon: doc.telephon || '',
                            typeContact: doc.typeContact || '',
                            selecMC: doc.selecMC || '',
                            comContact: doc.comContact || '',
                            contactStage: doc.contactStage || 0,
                            isActive: doc.isActive !== undefined ? doc.isActive : true,
                            properties: Array.isArray(doc.properties) ? doc.properties : [],
                            budget: doc.budget || 0,
                            selecTP: doc.selecTP || '',
                            rangeProp: doc.rangeProp || '',
                            numBaths: doc.numBaths || 0,
                            numBeds: doc.numBeds || 0,
                            numParks: doc.numParks || 0,
                            halfBathroom: doc.halfBathroom || '',
                            locaProperty: Array.isArray(doc.locaProperty) ? doc.locaProperty : [],
                            tagsProperty: Array.isArray(doc.tagsProperty) ? doc.tagsProperty : [],
                            ...doc
                        } as Contact;
                    });
                
                console.log(`Cargados ${validContacts.length} contactos válidos desde Firebase mediante loadContacts`);
                
                // Actualizar el store
                set(validContacts);
                return validContacts;
            }
            
            console.error('Error al cargar contactos:', result.error);
            return [];
        } catch (error) {
            console.error('Error en loadContacts:', error);
            return [];
        }
    };
    
    // Cargar contactos al inicializar el store
    loadContacts();

    return {
        subscribe,
        set,
        add: async (contactData: Contact): Promise<{ success: boolean; id?: string; error?: unknown }> => {
            try {
                // Verificar si el contacto ya tiene un ID válido
                let contactToAdd: Contact;
                let result;
                
                if (contactData.id && contactData.id.trim() !== '') {
                    // Si ya tiene un ID válido, usarlo
                    contactToAdd = { ...contactData };
                    console.log('Añadiendo contacto a Firebase con ID existente:', contactToAdd.id);
                    
                    // Usar el método addWithId para guardar el contacto con su ID específico
                    // Asegurarse de que el ID sea una cadena válida
                    const contactId = String(contactToAdd.id);
                    result = await firebase.addWithId('contacts', contactId, contactToAdd);
                } else {
                    // Si no tiene ID, dejar que Firebase genere uno nuevo
                    contactToAdd = { ...contactData, id: '' };
                    console.log('Añadiendo contacto a Firebase para generar nuevo ID:', contactToAdd);
                    
                    // Añadir el contacto a Firebase
                    result = await firebase.add('contacts', contactToAdd);
                }
                
                if (result.success && result.id) {
                    // Asignar el ID generado por Firebase al contacto
                    const newContact = { ...contactToAdd, id: result.id };
                    
                    // Actualizar el store de manera segura
                    update((contacts: Contact[]) => {
                        // Verificar si el contacto ya existe en el store (por ID)
                        const existingIndex = contacts.findIndex(c => c.id === result.id);
                        
                        if (existingIndex >= 0) {
                            // Si ya existe, actualizarlo
                            const updatedContacts = [...contacts];
                            updatedContacts[existingIndex] = newContact;
                            return updatedContacts;
                        } else {
                            // Si no existe, añadirlo
                            return [...contacts, newContact];
                        }
                    });
                    
                    console.log('Contacto añadido exitosamente con ID:', result.id);
                    return { success: true, id: result.id };
                }
                
                console.error('Error al añadir contacto:', result.error);
                return { success: false, error: result.error };
            } catch (error) {
                console.error('Error en la función add:', error);
                return { success: false, error };
            }
        },
        update: async (contact: Contact) => {
            try {
                // Verificar que el contacto tenga un ID válido
                if (!contact.id || contact.id.trim() === '') {
                    console.error('Error: Intentando actualizar un contacto sin ID válido', contact);
                    return { success: false, error: 'ID de contacto inválido' };
                }
                
                // Crear una copia del contacto para asegurarnos de que el ID no se modifique
                const contactToUpdate = { ...contact };
                // Asegurarse de que el ID sea una cadena de texto válida
                const contactId = String(contactToUpdate.id);
                
                console.log('Actualizando contacto en Firebase con ID:', contactId);
                
                try {
                    // Intentar actualizar en Firebase
                    const result = await firebase.update('contacts', contactId, contactToUpdate);
                    
                    if (result.success) {
                        // Actualizar manualmente el store para asegurarnos de que el contacto tenga el ID correcto
                        update((contacts: Contact[]) => {
                            const updatedContacts = [...contacts];
                            const index = updatedContacts.findIndex(c => c.id === contactId);
                            
                            if (index >= 0) {
                                // Asegurarnos de que el ID se mantenga
                                updatedContacts[index] = { ...contactToUpdate, id: contactId };
                            } else {
                                // Si el contacto no existe en el store, lo añadimos
                                updatedContacts.push({ ...contactToUpdate, id: contactId });
                            }
                            
                            return updatedContacts;
                        });
                        
                        console.log('Contacto actualizado exitosamente');
                        return { success: true };
                    }
                    
                    // Si el error es que el documento no existe, intentar crearlo
                    if (result.error && result.error.toString().includes('No document to update')) {
                        console.log('El documento no existe, intentando crearlo...');
                        
                        try {
                            // Crear el documento con el ID específico usando add con el ID específico
                            // Ya que el método set no está disponible, usamos una alternativa
                            const contactToCreate = { ...contactToUpdate, id: contactId };
                            // Crear un nuevo documento en la colección contacts con los datos del contacto
                            const createResult = await firebase.add('contacts', contactToCreate);
                            
                            if (createResult.success) {
                                // Actualizar manualmente el store
                                update((contacts: Contact[]) => {
                                    const updatedContacts = [...contacts];
                                    const index = updatedContacts.findIndex(c => c.id === contactId);
                                    
                                    if (index >= 0) {
                                        updatedContacts[index] = contactToCreate;
                                    } else {
                                        updatedContacts.push(contactToCreate);
                                    }
                                    
                                    return updatedContacts;
                                });
                                
                                console.log('Contacto creado exitosamente con ID específico');
                                return { success: true };
                            }
                            
                            console.error('Error al crear el contacto:', createResult.error);
                            return { success: false, error: createResult.error };
                        } catch (createError) {
                            console.error('Error al intentar crear el contacto:', createError);
                            return { success: false, error: createError };
                        }
                    }
                    
                    console.error('Error al actualizar contacto:', result.error);
                    return { success: false, error: result.error };
                } catch (updateError) {
                    console.error('Error en la operación de actualización:', updateError);
                    
                    // Si el error es que el documento no existe, intentar crearlo
                    const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
                    if (errorMessage.includes('No document to update')) {
                        console.log('Error de documento no existente, intentando crearlo...');
                        
                        try {
                            // Crear el documento con el ID específico usando add con el ID específico
                            // Ya que el método set no está disponible, usamos una alternativa
                            const contactToCreate = { ...contactToUpdate, id: contactId };
                            // Crear un nuevo documento en la colección contacts con los datos del contacto
                            const createResult = await firebase.add('contacts', contactToCreate);
                            
                            if (createResult.success) {
                                // Actualizar manualmente el store
                                update((contacts: Contact[]) => {
                                    const updatedContacts = [...contacts];
                                    const index = updatedContacts.findIndex(c => c.id === contactId);
                                    
                                    if (index >= 0) {
                                        updatedContacts[index] = contactToCreate;
                                    } else {
                                        updatedContacts.push(contactToCreate);
                                    }
                                    
                                    return updatedContacts;
                                });
                                
                                console.log('Contacto creado exitosamente después de error de actualización');
                                return { success: true };
                            }
                            
                            console.error('Error al crear el contacto después de error de actualización:', createResult.error);
                            return { success: false, error: createResult.error };
                        } catch (createError) {
                            console.error('Error al intentar crear el contacto:', createError);
                            return { success: false, error: createError };
                        }
                    }
                    
                    return { success: false, error: updateError };
                }
            } catch (error) {
                console.error('Error updating contact:', error);
                return { success: false, error };
            }
        },
    };
}

export const contactsStore = createContactsStore();
export const binnaclesStore = writable<Binnacle[]>([]);
export const propertiesStore = writable<Property[]>([]);
export const property = writable<Property | null>(null);
export const contact = createContactStore();
export const systStatus = writable<string>("");
export const todoStore = writable<Todo[]>([]);
