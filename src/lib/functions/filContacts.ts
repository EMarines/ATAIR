import { tagToUbicacion, tagToFeatures } from './tagConverters';
import { ranPrice } from './rangeValue';
import type { Contact, Property } from '$lib/types';

/**
 * Encuentra contactos interesados en una propiedad específica
 * @param property - La propiedad a evaluar
 * @param contacts - Lista de todos los contactos
 * @returns Lista de contactos cuyos criterios coinciden con la propiedad
 */
export function findContactsForProperty(property: Property, contacts: Contact[]): Contact[] {
    try {
        if (!property || !contacts) return [];

        return contacts.filter(contact => {
            // 1. Solo contactos activos (si existe la propiedad isActive)
            if (contact.isActive === false) return false;

            // 2. Filtrar por Tipo de Propiedad
            if (contact.selecTP && contact.selecTP !== '') {
                if (property.property_type.toLowerCase() !== contact.selecTP.toLowerCase()) {
                    return false;
                }
            }

            // 3. Filtrar por Tipo de Operación (Venta/Renta)
            if (contact.selecTO && contact.selecTO !== '') {
                // Asumimos que property.selecTO contiene 'sale' o 'rent'
                // y contact.selecTO contiene lo mismo o texto similar
                const pOp = property.selecTO?.toLowerCase();
                const cOp = contact.selecTO?.toLowerCase();
                if (pOp && cOp && pOp !== cOp) {
                    return false;
                }
            }

            // 4. Filtrar por Habitaciones, Baños, Parques (mínimos)
            if (contact.numBeds && Number(contact.numBeds) > 0) {
                if (Number(property.bedrooms || 0) < Number(contact.numBeds)) return false;
            }
            if (contact.numBaths && Number(contact.numBaths) > 0) {
                if (Number(property.bathrooms || 0) < Number(contact.numBaths)) return false;
            }
            if (contact.numParks && Number(contact.numParks) > 0) {
                if (Number(property.parking_spaces || 0) < Number(contact.numParks)) return false;
            }

            // 5. Filtrar por Precio/Presupuesto
            if (contact.budget && Number(contact.budget) > 0) {
                const lowRange = Number(contact.budget) * 0.7;
                const upRange = Number(contact.budget) * 1.1;
                if (property.price < lowRange || property.price > upRange) {
                    return false;
                }
            } else if (contact.rangeProp && contact.rangeProp !== '') {
                // Si el contacto tiene un rango predefinido, la propiedad debe caer en ese rango
                if (ranPrice(Number(property.price)) !== contact.rangeProp) {
                    return false;
                }
            }

            // 6. Filtro por Ubicación
            const contactLocations = (contact.locaProperty || [])
                .map(loc => loc?.toLowerCase().trim())
                .filter(Boolean);

            if (contactLocations.length > 0) {
                const propertyLocation = tagToUbicacion(property.tags);
                // Si la propiedad tiene ubicación detectada vía tags, debe estar en la lista del contacto
                if (propertyLocation && !contactLocations.includes(propertyLocation)) {
                    return false;
                }
            }

            // 7. Filtro por Características (Tags)
            const contactTags = (contact.tagsProperty || [])
                .map(tag => tag?.toLowerCase().trim())
                .filter(Boolean);

            if (contactTags.length > 0) {
                const propertyFeatures = tagToFeatures(property.tags);
                // El contacto debe tener TODOS sus tags requeridos presentes en la propiedad
                const hasAllTags = contactTags.every(tag => propertyFeatures.includes(tag));
                if (!hasAllTags) return false;
            }

            return true;
        });

    } catch (error) {
        console.error("Error en findContactsForProperty:", error);
        return [];
    }
}
