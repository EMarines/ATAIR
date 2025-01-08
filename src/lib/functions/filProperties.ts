import { mosRange } from './rangeValue'
// import { dbProperties } from '../../firebase';
import { tagToUbicacion, tagToFeatures } from './tagConverters'
import type { Property, Contact } from '$lib/types';
  
      export function filtContPropInte(contact: Contact, properties: Property[]){
        let proInt = properties;
        // Filtra por tipo de propiedad y numero de piezas
        try {
          proInt = proInt.filter((item) =>
            item.property_type.toLowerCase() === contact.selecTP?.toLowerCase()
          // contact.selecTP.toLowerCase() === item.selectTP.toLowerCase()
          );
          // console.log(proInt)

          if (contact.numBeds > 0) {
            proInt = proInt.filter((item) => item.bedrooms >= contact.numBeds);
          }

          if (contact.numBaths > 0) {
            proInt = proInt.filter((item) => item.bathrooms >= contact.numBaths);
          }

            if (contact.numParks > 0) {
              proInt = proInt.filter((item) => item.parking_spaces >= contact.numParks);
          }
          
        } catch (error) {
          console.log(error);
        }

  // Filtra por Rango
        if(!!contact.budget || (!!contact.rangeProp)){
        try {
          if(contact.budget){
            let lowRange=(Number(contact.budget * .7))
            let upRange=(Number(contact.budget * 1.1))
            proInt = proInt.filter((prop) => 
            prop.operations[0].amount >= lowRange && prop.operations[0].amount <= upRange)         
        } else {       
            proInt = proInt.filter((prop) => mosRange(Number(prop.operations[0].amount)) === contact.rangeProp);
        }          
        } catch (error) {
          console.log(error);
        }};
        // console.log(proInt)
        
  // Filtra por Ubicación 
        if (contact.locaProperty.length > 0) {
            proInt = proInt.filter(prop => {
                const ubicacion = tagToUbicacion(prop.tags);
                return !ubicacion || contact.locaProperty.some(loca => ubicacion.includes(loca));
            });
        }

            // console.log(proInt)
        
    // Filtra por Etiquetas
        try {
          if(contact.tagsProperty.length > 0)
            proInt = proInt.filter(prop => {
                const features = tagToFeatures(prop.tags);
                return features && contact.tagsProperty.every(tags => features.includes(tags));
            });
        } catch (error) {
          console.log(error)
        };

      return proInt;

      }

   