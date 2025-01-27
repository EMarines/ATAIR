import { writable } from 'svelte/store';
import type { Contact, Property, Binnacle } from '$lib/types';

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

export const contactsStore = writable<Contact[]>([]);
export const binnaclesStore = writable<Binnacle[]>([]);
export const propertiesStore = writable<Property[]>([]);
export const property = writable<Property | null>(null);
export const contact = createContactStore();
export const systStatus = writable<string>("");
