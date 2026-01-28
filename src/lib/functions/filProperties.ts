// c:\Users\Propietario\OneDrive\AB GrupoUrbania\OneDrive\Escritorio\Web Projects\ATAIR\src\lib\functions\filProperties.ts
import { get } from 'svelte/store';
import { ranPrice } from './rangeValue';
import { tagToUbicacion, tagToFeatures } from './tagConverters';
import type { Contact, Property } from '$lib/types';
import { propertiesStore } from '$lib/stores/dataStore';

export function findPropertiesForContact(contact: Contact): Property[] { // Renombrar función para claridad
    try {
        let propertiesToFilter: Property[] = get(propertiesStore); // Usar nombre más descriptivo
        console.log(propertiesToFilter);

        // Filtrar por Tipo de Propiedad (case-insensitive)
        if (contact.selecTP && contact.selecTP !== '') {
            const contactTypeLower = contact.selecTP.toLowerCase();
            propertiesToFilter = propertiesToFilter.filter((item) =>
                item.property_type.toLowerCase() === contactTypeLower
            );
        }

        if (contact.selecTO) {
            const contactOperationLower = contact.selecTO.toLowerCase();
            propertiesToFilter = propertiesToFilter.filter((item) =>
                item.selecTO?.toLowerCase() === contactOperationLower // Añadir optional chaining por si 'selecTO' no existe en Property
            );
        }

        // Filtrar por número mínimo de Habitaciones, Baños, Estacionamientos
        if (contact.numBeds && Number(contact.numBeds) > 0) {
            propertiesToFilter = propertiesToFilter.filter((item) => Number(item.bedrooms) >= Number(contact.numBeds));
        }
        if (contact.numBaths && Number(contact.numBaths) > 0) {
            propertiesToFilter = propertiesToFilter.filter((item) => Number(item.bathrooms) >= Number(contact.numBaths));
        }
        if (contact.numParks && Number(contact.numParks) > 0) {
            propertiesToFilter = propertiesToFilter.filter((item) => Number(item.parking_spaces) >= Number(contact.numParks));
        }

        // Filtrar por presupuesto (rango 70%-110%) o rango predefinido
        if (contact.budget !== "" || contact.rangeProp !== "") {
            if (Number(contact.budget) > 0) { // Priorizar presupuesto si existe y es mayor a 0
                const lowRange = Number(contact.budget) * 0.7;
                const upRange = Number(contact.budget) * 1.1;
                propertiesToFilter = propertiesToFilter.filter((prop) =>
                    prop.price >= lowRange && prop.price <= upRange
                );
            } else if (contact.rangeProp) { // Si no hay presupuesto, usar rango
                const contactRangeLower = contact.rangeProp;
                propertiesToFilter = propertiesToFilter.filter((prop) =>
                    ranPrice(Number(prop.price)) === contactRangeLower
                );
            }
        }   

        //  --- Filtro para Ubicación
        const contactLocationsLower = (contact.locaProperty ?? []) // Asegurar array y convertir a minúsculas
            .map(loc => loc?.toLowerCase())
            .filter(Boolean) as string[]; // Filtrar null/undefined/empty strings

        if (contactLocationsLower.length > 0) {
            propertiesToFilter = propertiesToFilter.filter(prop => {
                const propertyLocation = tagToUbicacion(prop.tags); // Ya devuelve lowercase o null
                return !propertyLocation || contactLocationsLower.includes(propertyLocation);
            });
        }

        // --- Filtro por Características/Tags (Mejorado) ---
        const contactTagsLower = (contact.tagsProperty ?? []) // Asegurar array y convertir a minúsculas
             .map(tag => tag?.toLowerCase())
             .filter(Boolean) as string[]; // Filtrar null/undefined/empty strings

        if (contactTagsLower.length > 0) {
            propertiesToFilter = propertiesToFilter.filter(prop => {
                const propertyFeatures = tagToFeatures(prop.tags); // Ya devuelve array de strings en minúsculas
                return propertyFeatures.length > 0 && contactTagsLower.every(tag => propertyFeatures.includes(tag));
            });
        }

        return propertiesToFilter; // Devolver el resultado final

    } catch (error) {
        console.error("Error al filtrar propiedades para el contacto:", error); // Usar console.error
        return []; 
    }
}
