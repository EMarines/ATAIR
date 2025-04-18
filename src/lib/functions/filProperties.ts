import { get } from 'svelte/store';
import { mosRange } from './rangeValue'
// import { dbProperties } from '../../firebase';
import { tagToUbicacion, tagToFeatures } from './tagConverters'
import type { Contact, Property } from '$lib/types';
import { propertiesStore } from '$lib/stores/dataStore';

  export function filtContPropInte(contact: Contact) {
    try {
        let proInt: Property[] = get(propertiesStore);

        if (contact.selecTP) {
            proInt = proInt.filter((item) =>
                item.property_type.toLowerCase() === contact.selecTP?.toLowerCase()
            );
        }

        if (contact.selecTO) {
            proInt = proInt.filter((item) =>
                item.selecTO.toLowerCase() === contact.selecTO?.toLowerCase()
            );
        }

        if (contact.numBeds && Number(contact.numBeds) > 0) {
            proInt = proInt.filter((item) => Number(item.bedrooms) >= Number(contact.numBeds));
        }

        if (contact.numBaths && Number(contact.numBaths) > 0) {
            proInt = proInt.filter((item) => Number(item.bathrooms) >= Number(contact.numBaths));
        }

        if (contact.numParks && Number(contact.numParks) > 0) {
            proInt = proInt.filter((item) => Number(item.parking_spaces) >= Number(contact.numParks));
        }

        // Filtrar por presupuesto o rango
        if (contact.budget || contact.rangeProp) {
            
            if (contact.budget) {
                const lowRange = Number(contact.budget) * 0.7;
                const upRange = Number(contact.budget) * 1.1;
                proInt = proInt.filter((prop) =>
                    prop.price >= lowRange && prop.price <= upRange
                );
            } else if (contact.rangeProp.toLowerCase) {
                proInt = proInt.filter((prop) =>
                    mosRange(Number(prop.price)) === contact.rangeProp
                );
            }
        } else {
            console.log("El contacto no tiene presupuesto ni rango definido. No se aplica filtro por presupuesto o rango.");
        }
        
        if (contact.locaProperty && Array.isArray(contact.locaProperty) && contact.locaProperty.length > 0) {
            proInt = proInt.filter(prop => {
                const ubicacion = tagToUbicacion(prop.tags);
                return !ubicacion || contact.locaProperty.some(loca => ubicacion.includes(loca));
            });
        }

        if(contact.tagsProperty && Array.isArray(contact.tagsProperty) && contact.tagsProperty.length > 0) {
            proInt = proInt.filter(prop => {
                const features = tagToFeatures(prop.tags);
                return features && contact.tagsProperty.every(tags => features.includes(tags));
            });
        }        


        return proInt;
    } catch (error) {
        console.log(error);
        return [];
    }
}

        


   