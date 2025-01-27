import { get } from 'svelte/store';
import { mosRange } from './rangeValue'
// import { dbProperties } from '../../firebase';
import { tagToUbicacion, tagToFeatures } from './tagConverters'
import type { Contact, Property } from '$lib/types';
import { propertiesStore } from '$lib/stores/dataStore';

  export function filtContPropInte(contact: Contact) {
    try {
        let proInt: Property[] = get(propertiesStore).filter((item) =>
            item.property_type.toLowerCase() === contact.selecTP?.toLowerCase()
        );

        if (Number(contact.numBeds) > 0) {
            proInt = proInt.filter((item) => Number(item.bedrooms) >= Number(contact.numBeds));
        }

        if (Number(contact.numBaths) > 0) {
            proInt = proInt.filter((item) => Number(item.bathrooms) >= Number(contact.numBaths));
        }

        if (Number(contact.numParks) > 0) {
            proInt = proInt.filter((item) => Number(item.parking_spaces) >= Number(contact.numParks));
        }
        
        if(!!contact.budget || (!!contact.rangeProp)){
            if(contact.budget){
                const lowRange=(Number(contact.budget * .7))
                const upRange=(Number(contact.budget * 1.1))
                proInt = proInt.filter((prop) => 
                prop.operations[0].amount >= lowRange && prop.operations[0].amount <= upRange)         
            } else {       
                proInt = proInt.filter((prop) => mosRange(Number(prop.operations[0].amount)) === contact.rangeProp);
            }          
        }
        
        if (contact.locaProperty.length > 0) {
            proInt = proInt.filter(prop => {
                const ubicacion = tagToUbicacion(prop.tags);
                return !ubicacion || contact.locaProperty.some(loca => ubicacion.includes(loca));
            });
        }

        if(contact.tagsProperty.length > 0)
            proInt = proInt.filter(prop => {
                const features = tagToFeatures(prop.tags);
                return features && contact.tagsProperty.every(tags => features.includes(tags));
            });

        return proInt;
    } catch (error) {
        console.log(error);
        return [];
    }
}

   