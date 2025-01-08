import { mosRange } from '../functions/rangeValue'
import { tagToUbicacion, tagToFeatures } from './tagConverters'
import type { Property, Contact } from '$lib/types';

const dateTo = new Date().getTime();


// Filtrar property -- properties
 
    export function filtPropContInte(property: Property, contacts: Contact[]): Contact[] {  
      
      // busqueda de Hoy hasta 1/ene/23
        let conInt = contacts.filter((cont) => cont.createdAt <=  dateTo && cont.createdAt >= 1672596060000 || cont.contactStage === "Etapa4");   

      // Tipo de contacto    
        conInt = conInt.filter((cont) => cont.typeContact === "Comprador"  || cont.contactType === "Comprador");        
        
      // Tipo de propiedad
        conInt = conInt.filter((cont) => cont.selecTP === property.property_type);
      
      // Numero de recámaras   
        if (property.bedrooms > 0) {
          conInt = conInt.filter(cont => 
              cont.numBeds && Number(cont.numBeds) <= property.bedrooms
          );
        };
        
      // Numero de baños
        if (property.bathrooms > 0) {
          conInt = conInt.filter(cont => 
              cont.numBaths && Number(cont.numBaths) <= property.bathrooms
          );
        };

        // Estacionamientos
        if (property.parking_spaces > 0) {
          conInt = conInt.filter(cont => 
              cont.numParks && Number(cont.numParks) <= property.parking_spaces
          );
        };

      // Presupuesto
      try {
        const filteredContacts = conInt.reduce<Contact[]>((acc, cont) => {
          if (cont.budget) {
            const minBudget = Number(cont.budget) * 0.7;
            const maxBudget = Number(cont.budget) * 1.1;
            const propertyAmount = Number(property.operations[0].amount);

            // Si el precio de la propiedad está dentro del rango del presupuesto
            if (minBudget <= propertyAmount && maxBudget >= propertyAmount) {
              acc.push(cont);
            }
          } else if (cont.rangeProp === mosRange(property.operations[0].amount)) {
            // Si coincide exactamente con el rango
            acc.push(cont);
          }
          return acc;
        }, []); // Usamos un array simple como acumulador

        conInt = filteredContacts; // Solo guardamos los contactos que coinciden
      } catch (error) {
        console.log('Error al filtrar por presupuesto:', error);
      }

      // Filtra por Ubicación
      try {
        const ubicPropTag = tagToUbicacion(property.tags);
        // Solo filtramos si la propiedad tiene ubicación
        if (ubicPropTag) {
            const filteredContacts = conInt.filter(cont => {
                // Si el contacto no tiene preferencias de ubicación, lo incluimos
                if (!cont.locaProperty || cont.locaProperty.length === 0) {
                    return true;
                }
                
                // Verificar si alguna de las ubicaciones que busca el contacto
                // coincide con la ubicación de la propiedad
                return cont.locaProperty.some(location => 
                    location.toLowerCase() === ubicPropTag.toLowerCase()
                );
            });
            
            conInt = filteredContacts;
        }
    } catch (error) {
        console.log('Error al filtrar por ubicación:', error);
    }

      // Filtra por Etiquetas
      try {
        if(tagToFeatures(property.tags)){
          const filteredContacts = conInt.reduce<Contact[]>((acc, cont) => {
              if (!cont.tagsProperty || cont.tagsProperty.length === 0) {
                  acc.push(cont);
                  return acc;
              }
      // cambio de "if (!features && cont.tagsProperty.every(tag => features.includes(tag))) {" a esto
              const features = tagToFeatures(property.tags);
              if (features && cont.tagsProperty.every(tag => features.includes(tag))) {
                  acc.push(cont);
              }

              return acc;
          }, []);
          conInt = filteredContacts;
        }
      } catch (error) {
        console.log('Error al filtrar por etiquetas:', error);
      }

      return conInt;
    };


