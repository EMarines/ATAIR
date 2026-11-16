import type { Contact, Property } from '$lib/types';
import { matchContactsForProperty, type ContactMatchOptions } from './propertyMatching';

/**
 * Encuentra contactos interesados en una propiedad específica.
 * Delega al motor unificado `$lib/functions/propertyMatching.ts`.
 */
export function findContactsForProperty(
	property: Property,
	contacts: Contact[],
	options?: ContactMatchOptions
): Contact[] {
	try {
		return matchContactsForProperty(property, contacts, options);
	} catch (error) {
		console.error('Error en findContactsForProperty:', error);
		return [];
	}
}
