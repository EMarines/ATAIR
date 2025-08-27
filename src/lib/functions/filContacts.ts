import { mosRange } from '../functions/rangeValue';
import { tagToUbicacion, tagToFeatures } from './tagConverters';
import type { Property, Contact } from '$lib/types';

const dateTo = new Date().getTime();
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 3);
const oneYearAgoTimestamp = oneYearAgo.getTime();

export function findContactsForProperty(property: Property, contacts: Contact[]): Contact[] {

    // Filtro inicial: Contactos activos (último año) O en Etapa 4
    let interestedContacts = contacts.filter((cont) =>
        (cont.createdAt >= oneYearAgoTimestamp && cont.createdAt <= dateTo) || cont.contactStage === "Etapa4"
    );

    // Determinar el tipo de contacto objetivo basado en la operación de la propiedad
    let targetContactType = '';
    if (property.selecTO?.toLowerCase() === 'sale') {
        targetContactType = 'comprador';
    } else if (property.selecTO?.toLowerCase() === 'rental') {
        targetContactType = 'arrendador';
    }

    // Filtrar por tipo de contacto (Comprador/Arrendador)
    if (targetContactType) {
        interestedContacts = interestedContacts.filter(cont => {
            const typeContactLower = cont.typeContact?.toLowerCase();
            const contactTypeLower = cont.contactType?.toLowerCase();
            const hasTypePreference = (typeContactLower && typeContactLower.trim() !== '') || (contactTypeLower && contactTypeLower.trim() !== '');

            if (!hasTypePreference) {
                return true; // Incluir si no tiene preferencia de tipo de contacto
            }
            return typeContactLower === targetContactType || contactTypeLower === targetContactType;
        });
    }

    // Filtrar por tipo de propiedad (case-insensitive)
    const propertyTypeLower = property.property_type.toLowerCase();
    interestedContacts = interestedContacts.filter(cont => {
        const contactPropertyTypeLower = cont.selecTP?.toLowerCase();
        if (!contactPropertyTypeLower || contactPropertyTypeLower.trim() === '') {
            return true; // Incluir si no tiene preferencia de tipo de propiedad
        }
        return contactPropertyTypeLower === propertyTypeLower;
    });

    // Filtrar por número de recámaras, baños, estacionamientos
    // El contacto se incluye si no tiene preferencia O si su preferencia es <= a lo que ofrece la propiedad.
    if (property.bedrooms > 0) {
        interestedContacts = interestedContacts.filter(cont =>
            !cont.numBeds || (Number(cont.numBeds) <= property.bedrooms)
        );
    }
    if (property.bathrooms > 0) {
        interestedContacts = interestedContacts.filter(cont =>
            !cont.numBaths || (Number(cont.numBaths) <= property.bathrooms)
        );
    }
    if (property.parking_spaces > 0) {
        interestedContacts = interestedContacts.filter(cont =>
            !cont.numParks || (Number(cont.numParks) <= property.parking_spaces)
        );
    }

    // Filtrar por presupuesto del contacto vs Precio de la propiedad
    const propertyPrice = Number(property.price);
    if (propertyPrice > 0) {
        interestedContacts = interestedContacts.filter(cont => {
            const contactBudgetNum = Number(cont.budget);
            const hasValidBudget = !isNaN(contactBudgetNum) && contactBudgetNum > 0;
            const hasRangeProp = cont.rangeProp && cont.rangeProp.trim() !== '';

            // 1. Si el contacto no tiene NINGUNA preferencia de precio (ni budget válido, ni rangeProp)
            if (!hasValidBudget && !hasRangeProp) {
                return true;
            }

            // 2. Si tiene un presupuesto válido, verificarlo
            if (hasValidBudget) {
                const minBudget = contactBudgetNum * 0.7;
                const maxBudget = contactBudgetNum * 1.1;
                return propertyPrice >= minBudget && propertyPrice <= maxBudget;
            }

            // 3. Si no tiene presupuesto válido PERO tiene rangeProp, verificarlo
            if (hasRangeProp) {
                // mosRange devuelve MAYÚSCULAS.
                return mosRange(propertyPrice) === cont.rangeProp.toUpperCase();
            }

            // 4. Si llegó aquí, tiene alguna definición en budget o rangeProp pero no son válidas o no coinciden.
            return false;
        });
    }

    // Filtrar por Ubicación
    const propertyLocation = tagToUbicacion(property.tags); // Devuelve lowercase o null

    if (propertyLocation) { // Solo filtrar si la propiedad TIENE ubicación
        interestedContacts = interestedContacts.filter(cont => {
            if (!cont.locaProperty || !Array.isArray(cont.locaProperty) || cont.locaProperty.length === 0) {
                return true; // Incluir si no tiene preferencias de ubicación o el array está vacío
            }
            
            const contactLocationsLower = cont.locaProperty
                .map(loc => loc?.toLowerCase().trim())
                .filter(loc => loc && loc !== ''); // Filtrar nulos, undefined y strings vacíos
            
            if (contactLocationsLower.length === 0) {
                return true; // Si después de limpiar el array de preferencias queda vacío, incluir
            }
            
            return contactLocationsLower.includes(propertyLocation);
        });
    }
    // Si la propiedad no tiene ubicación, no se aplica este filtro (todos los contactos pasan).

    // Filtrar por Etiquetas/Características
    const propertyFeatures = tagToFeatures(property.tags); // Devuelve array de strings en minúsculas

    if (propertyFeatures.length > 0) { // Solo filtrar si la propiedad TIENE características relevantes
        interestedContacts = interestedContacts.filter(cont => {
            const contactTagsLower = (cont.tagsProperty ?? [])
                .map(tag => tag?.toLowerCase().trim())
                .filter(tag => tag && tag !== ''); // Filtrar nulos, undefined y strings vacíos

            if (contactTagsLower.length === 0) {
                return true; // Si el contacto NO tiene preferencias de tags, SÍ coincide
            }
            // Si tiene preferencias, TODAS ellas deben estar presentes en la propiedad
            return contactTagsLower.every(tag => propertyFeatures.includes(tag));
        });
    }
    // Si la propiedad no tiene características relevantes, no se aplica este filtro (todos los contactos pasan).

    return interestedContacts;
}
