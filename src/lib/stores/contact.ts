import { writable } from 'svelte/store';
import type { Contact } from '$lib/types';

const defaultContact: Contact = {
    name: '',
    lastname: '',
    telephon: '',
    email: '',
    typeContact: '',
    selecMC: '',
    selecTP: '',
    modePay: '',
    rangeProp: '',
    numBeds: undefined,
    numBaths: undefined,
    halfBathroom: undefined,
    numParks: undefined,
    budget: undefined,
    notes: '',
    propCont: '',
    comContact: '',
    contactStage: 'Etapa1',
    createdAt: Date.now(),
    isActive: true,
    id: '',
    tagsProperty: [],
    locaProperty: []
};

function createContactStore() {
    const { subscribe, set, update } = writable<Contact>(defaultContact);

    return {
        subscribe,
        set,
        update,
        reset: () => {
            set(defaultContact);
        }
    };
}

export const currentContact = createContactStore();
