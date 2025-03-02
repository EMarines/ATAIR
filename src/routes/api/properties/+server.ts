import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import type { Property } from '$lib/types';

const LIMIT = 50; // EasyBroker recomienda este límite por página
const DELAY = 1000; // 1 segundo entre peticiones para respetar rate limits
const API_BASE_URL = 'https://api.easybroker.com/v1';

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            
            // Si el error es 429 (Rate Limit), esperamos más tiempo
            if (response.status === 429) {
                await new Promise(resolve => setTimeout(resolve, DELAY * (i + 1)));
                continue;
            }
            
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, DELAY));
        }
    }
    throw new Error('Max retries reached');
}

async function getAllProperties(): Promise<Property[]> {
    let allProperties: Property[] = [];
    let page = 1;
    let hasMore = true;

    const headers = {
        'X-Authorization': env.PRIVATE_EASYBROKER_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    while (hasMore) {
        try {
            const response = await fetchWithRetry(
                `${API_BASE_URL}/properties?page=${page}&limit=${LIMIT}`,
                { headers }
            );

            const data = await response.json();
            
            if (!Array.isArray(data.content)) {
                throw new Error('Unexpected API response format');
            }

            allProperties = [...allProperties, ...data.content];
            
            hasMore = data.pagination.next_page;
            if (hasMore) {
                page++;
                await new Promise(resolve => setTimeout(resolve, DELAY));
            }
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
            throw new Error(`Failed to fetch properties on page ${page}`);
        }
    }

    return allProperties;
}

export const GET: RequestHandler = async ({ request }) => {
    // Verificar API key
    if (!env.PRIVATE_EASYBROKER_API_KEY) {
        console.error('API key no configurada');
        return json(
            { error: 'Configuración del servidor incompleta' }, 
            { status: 500 }
        );
    }

    try {
        const properties = await getAllProperties();
        
        // Log para monitoreo
        console.log('Propiedades obtenidas:', {
            total: properties.length,
            páginas: Math.ceil(properties.length / LIMIT),
            timestamp: new Date().toISOString()
        });
        
        // Configurar cache headers
        const headers = new Headers({
            'Cache-Control': 'public, max-age=300', // Cache por 5 minutos
            'Content-Type': 'application/json'
        });

        return json(properties, { headers });
    } catch (error) {
        console.error('Error obteniendo propiedades:', error);
        
        return json(
            { error: 'Error al obtener las propiedades' }, 
            { status: 500 }
        );
    }
}; 
