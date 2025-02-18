import type { Property } from '$lib/types';

export class EasyBrokerService {
    private apiKey: string;
    private baseUrl = 'https://api.easybroker.com/v1';
    private rateLimit = 20; // 20ms entre requests (50 por segundo)

    constructor(apiKey: string) {
        this.apiKey = apiKey;
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
            } else if (
                ebProp.operations?.[0]?.amount !== fbProp.operations?.[0]?.amount
            ) {
                changes.modified.push(ebProp);
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
} 