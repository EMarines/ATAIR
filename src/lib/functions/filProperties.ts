import { get } from 'svelte/store';
import type { Contact, Property } from '$lib/types';
import { propertiesStore } from '$lib/stores/dataStore';
import { matchPropertiesForContact, type PropertyMatchOptions } from './propertyMatching';

/**
 * Encuentra propiedades compatibles para un contacto específico.
 * Delega al motor unificado `$lib/functions/propertyMatching.ts`.
 */
export function findPropertiesForContact(
	contact: Contact,
	propertiesOverride?: Property[],
	options?: PropertyMatchOptions
): Property[] {
	try {
		const pool = Array.isArray(propertiesOverride) ? propertiesOverride : get(propertiesStore);
		return matchPropertiesForContact(contact, pool, options);
	} catch (error) {
		console.error('Error al filtrar propiedades para el contacto:', error);
		return [];
	}
}
