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

    return {
        subscribe,
        set,
        add: async (contact: Contact) => {
            try {
                const result = await firebase.add('contacts', contact);
                if (result.success) {
                    // Ya no actualizamos el store aquí porque el listener de Firebase lo hará
                    return { success: true, id: result.id };
                }
                return { success: false, error: result.error };
            } catch (error) {
                console.error('Error adding contact:', error);
                return { success: false, error };
            }
        },
        update: async (contact: Contact) => {
            try {
                if (!contact.id) {
                    throw new Error('Contact ID is required for update');
                }
                const result = await firebase.update('contacts', contact.id, contact);
                if (result.success) {
                    // El listener de Firebase actualizará el store
                    return { success: true, id: contact.id };
                }
                return { success: false, error: result.error };
            } catch (error) {
                console.error('Error updating contact:', error);
                return { success: false, error };
            }
        }
    };
}

export const contactsStore = createContactsStore();
export const binnaclesStore = writable<Binnacle[]>([]);
export const propertiesStore = writable<Property[]>([]);
export const property = writable<Property | null>(null);
export const contact = createContactStore();
export const systStatus = writable<string>("");
export const todoStore = writable<Todo[]>([]);
