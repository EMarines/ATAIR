import { writable } from 'svelte/store';
import type { Contact, Property, Binnacle } from '$lib/types';

// Usa las interfaces importadas
export const contactsStore = writable<Contact[]>([]);
export const binnaclesStore = writable<Binnacle[]>([]);
export const propertiesStore = writable<Property[]>([]);


export const systStatus = writable<string>("");
