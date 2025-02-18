import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_EASYBROKER_API_KEY } from '$env/static/private';
import type { Property } from '$lib/types';

const LIMIT = 50; // EasyBroker recomienda este límite por página
const DELAY = 1000; // 1 segundo entre peticiones para respetar rate limits

async function getAllProperties(): Promise<Property[]> {
    let allProperties: Property[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const response = await fetch(
            `https://api.easybroker.com/v1/properties?page=${page}&limit=${LIMIT}`, {
            headers: {
                'X-Authorization': PRIVATE_EASYBROKER_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        allProperties = [...allProperties, ...data.content];
        
        hasMore = data.pagination.next_page;
        if (hasMore) {
            page++;
            await new Promise(resolve => setTimeout(resolve, DELAY));
        }
    }

    return allProperties;
}

export const GET: RequestHandler = async () => {
    if (!PRIVATE_EASYBROKER_API_KEY) {
        return json({ error: 'API key not configured' }, { status: 500 });
    }

    try {
        const properties = await getAllProperties();
        console.log('Propiedades obtenidas de EasyBroker:', {
            total: properties.length,
            páginas: Math.ceil(properties.length / LIMIT)
        });
        
        return json(properties);
    } catch (error) {
        console.error('Error fetching properties:', error);
        return json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
}; 
