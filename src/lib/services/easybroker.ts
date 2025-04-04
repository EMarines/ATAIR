import type { Property, PropertyEB } from '$lib/types';
import { writeBatch, doc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

export class EasyBrokerService {
    private apiKey: string;
    private baseUrl = 'https://api.easybroker.com/v1';
    private rateLimit = 20; // 20ms entre requests (50 por segundo)

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    // Obtener detalles completos de una propiedad
    private async getPropertyDetails(propertyId: string): Promise<PropertyEB> {
        try {
            await new Promise(resolve => setTimeout(resolve, this.rateLimit));
            
            const response = await fetch(`/api/properties/${propertyId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Obtenidos detalles de propiedad ${propertyId}`);
            return data;
        } catch (error) {
            console.error(`Error obteniendo detalles de propiedad ${propertyId}:`, error);
            throw error;
        }
    }

    // Preparar propiedades para subir
    private formatPropertyForFirebase(property: PropertyEB): Property {
        return {
            created_at: new Date(property.created_at).getTime(),
            lot_size: property.lot_size || 0,
            public_url: property.public_url.replace('https://www.easybroker.com/mx/listings', 'https://www.matchhome.net/property'),
            construction_size: property.construction_size || 0,
            description: property.description || '',
            agent: property.agent || '',
            public_id: property.public_id,
            property_status: property.property_status || 'available',
            title: property.title || '',
            title_image_thumb: property.property_images?.[0]?.url || property.title_image_thumb || '',
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            parking_spaces: property.parking_spaces || 0,
            half_bathrooms: property.half_bathrooms || 0,
            location: this.cleanColonyName(property.location?.name) || '',
            property_type: property.property_type || '',
            updated_at: property.updated_at || new Date().toISOString(),
            tags: property.tags || [],
            price: property.operations[0].amount || 0,
            selecTO: property.operations[0].type || '',
            selecTP: property.property_type || '',
        };
    };

    private cleanColonyName(colony: string): string {
        if (!colony || typeof colony !== 'string') {
            return '';
        }    
        // Expresión regular para detectar números romanos y sus separadores
        const romanRegex = /\b(I|II|III|IV|V|VI|VII|VIII|IX|X)(,?\s?y?\s?(I|II|III|IV|V|VI|VII|VIII|IX|X))*\b/gi;    
        // Reemplazar las etapas con números romanos por una cadena vacía
        return colony
            .replace(romanRegex, '') // Eliminar números romanos
            .replace(/\s+/g, ' ')    // Eliminar espacios adicionales
            .replace("Chihuahua, Chihuahua", "") // Eliminar "Chihuahua, Chihuahua"
            .replace(",", "") // Eliminar "Chihuahua"
            .trim();                 // Eliminar espacios al inicio y al final
    }
    
    // Su
    async preparePropertiesToUpload(propertiesToProcess: { new: string[], modified: string[] }): Promise<Property[]> {
        const propertiesToUpload: Property[] = [];

        console.log('Procesando propiedades nuevas y modificadas...');

        // Procesar tanto nuevas como modificadas
        for (const id of [...propertiesToProcess.new, ...propertiesToProcess.modified]) {
            try {
                const propertyDetails = await this.getPropertyDetails(id);
                propertiesToUpload.push(this.formatPropertyForFirebase(propertyDetails));
                console.log(`Propiedad ${id} lista para subir`);
            } catch (error) {
                console.error(`Error procesando propiedad ${id}:`, error);
            }
        }

        console.log(`Total de propiedades listas para subir: ${propertiesToUpload.length}`);
        return propertiesToUpload;
    }

    async getProperties(): Promise<Property[]> {
        try {
            // Esperar el tiempo del rate limit antes de hacer la petición
            await new Promise(resolve => setTimeout(resolve, this.rateLimit));

            const response = await fetch('/api/properties');
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching properties:', error);
            throw error;
        }
    }

    compareProperties(easyBrokerProps: Property[], firebaseProps: Property[]) {
        const changes = {
            new: [] as Property[],
            modified: [] as Property[],
            deleted: [] as Property[],
            total: 0
        };

        // Detectar nuevas y modificadas
        easyBrokerProps.forEach(ebProp => {
            const fbProp = firebaseProps.find(p => p.public_id === ebProp.public_id);
            
            if (!fbProp) {
                changes.new.push(ebProp);
            } else {
                // Normalizar fechas a timestamps para comparación
                const ebDate = new Date(ebProp.updated_at).getTime();
                const fbDate = new Date(fbProp.updated_at).getTime();
                
                if (ebDate !== fbDate) {
                    // console.log(`Propiedad ${ebProp.public_id} modificada:`);
                    // console.log('Fecha EB:', ebProp.updated_at, '→', ebDate);
                    // console.log('Fecha FB:', fbProp.updated_at, '→', fbDate);
                    changes.modified.push(ebProp);
                }
            }
        });

        // Detectar eliminadas
        firebaseProps.forEach(fbProp => {
            if (!easyBrokerProps.find(p => p.public_id === fbProp.public_id)) {
                changes.deleted.push(fbProp);
            }
        });

        changes.total = changes.new.length + changes.modified.length + changes.deleted.length;
        return changes;
    }

    async syncChanges(propertiesToUpload: Property[]) {
        const batch = writeBatch(db);
        let addedCount = 0;
        let updatedCount = 0;
        
        for (const property of propertiesToUpload) {
            try {
                const docRef = doc(db, 'properties', property.public_id);
                const docSnap = await getDoc(docRef);
                
                batch.set(docRef, property, { merge: true });
                if (docSnap.exists()) {
                    updatedCount++;
                } else {
                    addedCount++;
                }
            } catch (error) {
                console.error(`Error procesando propiedad ${property.public_id}:`, error);
            }
        }

        try {
            await batch.commit();
            console.log(`Sincronización completada:
                - ${addedCount} propiedades nuevas
                - ${updatedCount} propiedades actualizadas`);
            return true;
        } catch (error) {
            console.error('Error al sincronizar propiedades:', error);
            throw error;
        }
    }
} 