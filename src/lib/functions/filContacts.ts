// c:\Users\Propietario\OneDrive\AB GrupoUrbania\OneDrive\Escritorio\Web Projects\ATAIR\src\lib\functions\filContacts.ts
import { mosRange } from '../functions/rangeValue';
import { tagToUbicacion, tagToFeatures } from './tagConverters';
import type { Property, Contact } from '$lib/types';

const dateTo = new Date().getTime();
const oneYearAgo = new Date(); // Calcular fecha de hace un año para filtro inicial
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
const oneYearAgoTimestamp = oneYearAgo.getTime();
// const specificDateTimestamp = 1672596060000; // 1/Ene/23 - Considerar si este filtro sigue siendo necesario o si 'un año atrás' es mejor

export function findContactsForProperty(property: Property, contacts: Contact[]): Contact[] { // Renombrar función

    // console.log("Contactos iniciales:", contacts.length, "Propiedad:", property.public_id); // Log inicial útil

    // Filtro inicial: Contactos activos (último año) O en Etapa 4 (asumiendo que es una etapa final/importante)
    let interestedContacts = contacts.filter((cont) =>
        (cont.createdAt >= oneYearAgoTimestamp && cont.createdAt <= dateTo) || cont.contactStage === "Etapa4"
    );
    // console.log("Tras filtro fecha/etapa:", interestedContacts.length);

    // Tipo de contacto (Comprador/Arrendador) - Asumiendo que la propiedad tiene un tipo de operación
    // y el contacto tiene 'typeContact' o 'contactType'
    // Necesitamos mapear la operación de la propiedad (ej. 'sale') a un tipo de contacto (ej. 'Comprador')
    let targetContactType = '';
    if (property.selecTO?.toLowerCase() === 'sale') {
        targetContactType = 'comprador';
    } else if (property.selecTO?.toLowerCase() === 'rental') {
        targetContactType = 'arrendador'; // Ajustar si el término es diferente
    }

    // else if (property.operation_type?.toLowerCase() === '...') { ... } // Añadir otros mapeos si existen

    if (targetContactType) {
        interestedContacts = interestedContacts.filter((cont) =>
            cont.typeContact?.toLowerCase() === targetContactType || cont.contactType?.toLowerCase() === targetContactType
        );
        console.log(`Tras filtro tipo (${targetContactType}):`, interestedContacts);
    }


    // Tipo de propiedad (case-insensitive)
    const propertyTypeLower = property.property_type.toLowerCase();
    interestedContacts = interestedContacts.filter((cont) => cont.selecTP?.toLowerCase() === propertyTypeLower);
    // console.log(`Tras filtro tipo propiedad (${propertyTypeLower}):`, interestedContacts.length);

    // Número de recámaras, baños, estacionamientos (Contacto busca <= Propiedad tiene)
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
    console.log("Tras filtro habs/baños/parks:", interestedContacts);


    // Presupuesto del contacto vs Precio de la propiedad
    const propertyPrice = Number(property.price);
    if (propertyPrice > 0) {
        interestedContacts = interestedContacts.filter(cont => {
            // Si el contacto no tiene presupuesto ni rango, lo incluimos
            if (!cont.budget && !cont.rangeProp) {
                return true;
            }
            
            // Comprobación con presupuesto si existe
            if (cont.budget && Number(cont.budget) > 0) {
                const minBudget = Number(cont.budget) * 0.7;
                const maxBudget = Number(cont.budget) * 1.1;
                return propertyPrice >= minBudget && propertyPrice <= maxBudget;
            } 
            
            // Comprobación con rango si existe
            if (cont.rangeProp) {
                return mosRange(propertyPrice) === cont.rangeProp.toLowerCase();
            }
            
            return true; // Por si acaso hay algún otro caso
        });
        // console.log("Tras filtro presupuesto/rango:", interestedContacts.length);
    }


    // --- Filtro por Ubicación (Mejorado) ---
const propertyLocation = tagToUbicacion(property.tags); // Ya devuelve lowercase o null

if (propertyLocation) { // Solo filtrar si la propiedad TIENE ubicación
    interestedContacts = interestedContacts.filter(cont => {
        // Verificar si el contacto tiene array de ubicaciones
        if (!cont.locaProperty || !Array.isArray(cont.locaProperty)) {
            return true; // Si no tiene el array, incluirlo (equivalente a preferencia vacía)
        }
        
        // Si el array está vacío, también incluirlo
        if (cont.locaProperty.length === 0) {
            return true;
        }
        
        // Si llegamos aquí, el contacto tiene preferencias de ubicación
        // Convertir a minúsculas y filtrar valores nulos
        const contactLocationsLower = cont.locaProperty
            .filter(loc => loc) // Eliminar null, undefined, ""
            .map(loc => loc.toLowerCase());
        
        // Si después de filtrar quedó vacío, incluirlo
        if (contactLocationsLower.length === 0) {
            return true;
        }
        
        // Verificar si al menos una ubicación preferida coincide con la propiedad
        return contactLocationsLower.includes(propertyLocation);
    });
    
    console.log(`Tras filtro ubicación (${propertyLocation}):`, interestedContacts);
}
    // Si la propiedad no tiene ubicación, no se aplica este filtro.


    // --- Filtro por Etiquetas/Características (Mejorado) ---
    const propertyFeatures = tagToFeatures(property.tags); // Ya devuelve array de strings en minúsculas

    if (propertyFeatures.length > 0) { // Solo filtrar si la propiedad TIENE características relevantes
        interestedContacts = interestedContacts.filter(cont => {
            const contactTagsLower = (cont.tagsProperty ?? [])
                .map(tag => tag?.toLowerCase())
                .filter(Boolean) as string[];

            // Si el contacto NO tiene preferencias de tags, SÍ coincide
            if (contactTagsLower.length === 0) {
                return true;
            }
            // Si tiene preferencias, TODAS ellas deben estar presentes en la propiedad (`every`)
            return contactTagsLower.every(tag => propertyFeatures.includes(tag));

            /* Alternativa: Si el contacto coincide si AL MENOS UNA de sus preferencias está en la propiedad (`some`)
             return contactTagsLower.some(tag => propertyFeatures.includes(tag));
            */
        });
        // console.log("Tras filtro tags:", interestedContacts.length);
    }
    // Si la propiedad no tiene características, no se aplica este filtro.


    // Eliminar console.logs finales de depuración
    // console.log("Contactos finales:", interestedContacts.length);

    return interestedContacts;
}

