import type { Contact } from '$lib/types';

export function validateContact(contact: Contact): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validar nombre
    if (!contact.name || contact.name.trim() === '') {
        errors.name = 'El nombre es obligatorio';
    }

    // Validar teléfono
    if (!contact.telephon || contact.telephon.trim() === '') {
        errors.telephon = 'El teléfono es obligatorio';
    } else if (!/^\d{10}$/.test(contact.telephon.trim())) {
        errors.telephon = 'El teléfono debe tener 10 dígitos';
    }

    // Validar email
    if (contact.email && contact.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.email.trim())) {
            errors.email = 'El email no es válido';
        }
    }

    // Validar cargo
    if (!contact.typeContact || contact.typeContact.trim() === '') {
        errors.typeContact = 'El cargo es obligatorio';
    }

    // Validar campos numéricos
    if (contact.numBeds !== undefined) {
        const numBeds = typeof contact.numBeds === 'string' ? parseFloat(contact.numBeds) : contact.numBeds;
        if (isNaN(numBeds) || numBeds < 0) {
            errors.numBeds = 'El número de recámaras debe ser un número positivo';
        }
    }

    if (contact.numBaths !== undefined) {
        const numBaths = typeof contact.numBaths === 'string' ? parseFloat(contact.numBaths) : contact.numBaths;
        if (isNaN(numBaths) || numBaths < 0) {
            errors.numBaths = 'El número de baños debe ser un número positivo';
        }
    }

    if (contact.halfBathroom !== undefined) {
        const halfBathroom = typeof contact.halfBathroom === 'string' ? parseFloat(contact.halfBathroom) : contact.halfBathroom;
        if (isNaN(halfBathroom) || halfBathroom < 0) {
            errors.halfBathroom = 'El número de medios baños debe ser un número positivo';
        }
    }

    if (contact.numParks !== undefined) {
        const numParks = typeof contact.numParks === 'string' ? parseFloat(contact.numParks) : contact.numParks;
        if (isNaN(numParks) || numParks < 0) {
            errors.numParks = 'El número de estacionamientos debe ser un número positivo';
        }
    }

    if (contact.budget !== undefined) {
        const budget = typeof contact.budget === 'string' ? parseFloat(contact.budget) : contact.budget;
        if (isNaN(budget) || budget < 0) {
            errors.budget = 'El presupuesto debe ser un número positivo';
        }
    }

    return errors;
}
