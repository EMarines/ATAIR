// c:\Users\Propietario\OneDrive\AB GrupoUrbania\OneDrive\Escritorio\Web Projects\ATAIR\src\lib\functions\filProperties.ts
import { get } from 'svelte/store';
import { mosRange } from './rangeValue';
import { tagToUbicacion, tagToFeatures } from './tagConverters';
import type { Contact, Property } from '$lib/types';
import { propertiesStore } from '$lib/stores/dataStore';

export function findPropertiesForContact(contact: Contact): Property[] { // Renombrar función para claridad
    try {
        let propertiesToFilter: Property[] = get(propertiesStore); // Usar nombre más descriptivo

        // Filtrar por Tipo de Propiedad (case-insensitive)
        if (contact.selecTP) {
            const contactTypeLower = contact.selecTP.toLowerCase();
            propertiesToFilter = propertiesToFilter.filter((item) =>
                item.property_type.toLowerCase() === contactTypeLower
            );
        }

        // Filtrar por Tipo de Operación (sale/rental) (case-insensitive)
        // Asumiendo que 'selecTO' en Property también existe y debe coincidir con 'selecTO' del Contacto
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
        if (contact.budget && Number(contact.budget) > 0) { // Priorizar presupuesto si existe y es mayor a 0
            const lowRange = Number(contact.budget) * 0.7;
            const upRange = Number(contact.budget) * 1.1;
            propertiesToFilter = propertiesToFilter.filter((prop) =>
                prop.price >= lowRange && prop.price <= upRange
            );
        } else if (contact.rangeProp) { // Si no hay presupuesto, usar rango
             const contactRangeLower = contact.rangeProp.toLowerCase();
            propertiesToFilter = propertiesToFilter.filter((prop) =>
                mosRange(Number(prop.price)) === contactRangeLower
            );
        }
        // No es necesario el 'else' para log, si no hay filtro, simplemente no se aplica.

        // --- Filtro por Ubicación (Mejorado) ---
        const contactLocationsLower = (contact.locaProperty ?? []) // Asegurar array y convertir a minúsculas
            .map(loc => loc?.toLowerCase())
            .filter(Boolean) as string[]; // Filtrar null/undefined/empty strings

        if (contactLocationsLower.length > 0) {
            propertiesToFilter = propertiesToFilter.filter(prop => {
                const propertyLocation = tagToUbicacion(prop.tags); // Ya devuelve lowercase o null
                // La propiedad DEBE tener una ubicación Y esa ubicación DEBE estar en las que busca el contacto
                return propertyLocation && contactLocationsLower.includes(propertyLocation);
                // Lógica original (usando .some):
                // return propertyLocation && contact.locaProperty.some(loca => propertyLocation === loca.toLowerCase());
            });
        }
        // Si contactLocationsLower está vacío, no se filtra por ubicación.

        // --- Filtro por Características/Tags (Mejorado) ---
        const contactTagsLower = (contact.tagsProperty ?? []) // Asegurar array y convertir a minúsculas
             .map(tag => tag?.toLowerCase())
             .filter(Boolean) as string[]; // Filtrar null/undefined/empty strings

        if (contactTagsLower.length > 0) {
            propertiesToFilter = propertiesToFilter.filter(prop => {
                const propertyFeatures = tagToFeatures(prop.tags); // Ya devuelve array de strings en minúsculas
                // La propiedad DEBE tener TODAS las características que busca el contacto (`every`)
                return propertyFeatures.length > 0 && contactTagsLower.every(tag => propertyFeatures.includes(tag));

                /* Alternativa: Si la propiedad necesita tener AL MENOS UNA de las características que busca el contacto (`some`)
                 return propertyFeatures.length > 0 && contactTagsLower.some(tag => propertyFeatures.includes(tag));
                */
            });
        }
        // Si contactTagsLower está vacío, no se filtra por tags.

        // Eliminar console.logs de depuración
        // console.log(proInt);

        return propertiesToFilter; // Devolver el resultado final

    } catch (error) {
        console.error("Error al filtrar propiedades para el contacto:", error); // Usar console.error
        return []; // Devolver array vacío en caso de error
    }
}
