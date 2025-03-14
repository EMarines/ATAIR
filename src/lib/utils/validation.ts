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
    if (contact.numBeds !== undefined && (isNaN(contact.numBeds) || contact.numBeds < 0)) {
        errors.numBeds = 'El número de recámaras debe ser un número positivo';
    }

    if (contact.numBaths !== undefined && (isNaN(contact.numBaths) || contact.numBaths < 0)) {
        errors.numBaths = 'El número de baños debe ser un número positivo';
    }

    if (contact.halfBathroom !== undefined && (isNaN(contact.halfBathroom) || contact.halfBathroom < 0)) {
        errors.halfBathroom = 'El número de medios baños debe ser un número positivo';
    }

    if (contact.numParks !== undefined && (isNaN(contact.numParks) || contact.numParks < 0)) {
        errors.numParks = 'El número de estacionamientos debe ser un número positivo';
    }

    if (contact.budget !== undefined && (isNaN(contact.budget) || contact.budget < 0)) {
        errors.budget = 'El presupuesto debe ser un número positivo';
    }

    return errors;
}
