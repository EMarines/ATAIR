import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import type { Property } from '$lib/types';

function getApiKeys(): { account: string; key: string }[] {
	const pEnv = privateEnv as Record<string, string>;
	const procEnv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string>;

	const key1 =
		pEnv.EASYBROKER_API_KEY ||
		pEnv.VITE_EASYBROKER_API_KEY ||
		pEnv.PRIVATE_EASYBROKER_API_KEY ||
		procEnv.EASYBROKER_API_KEY ||
		procEnv.VITE_EASYBROKER_API_KEY ||
		procEnv.PRIVATE_EASYBROKER_API_KEY ||
		'pqnjps13ry7iaudododsi455mg22mt';

	const key2 =
		pEnv.EASYBROKER_API_KEY_2 ||
		pEnv.VITE_EASYBROKER_API_KEY_2 ||
		pEnv.PRIVATE_EASYBROKER_API_KEY_2 ||
		procEnv.EASYBROKER_API_KEY_2 ||
		procEnv.VITE_EASYBROKER_API_KEY_2 ||
		procEnv.PRIVATE_EASYBROKER_API_KEY_2 ||
		'x0lk7kyxiuobh016le9znt24222uil';

	const accounts: { account: string; key: string }[] = [];
	if (key1) accounts.push({ account: 'JGCapital', key: key1 });
	if (key2 && key2 !== key1) accounts.push({ account: 'MatchHome Personal', key: key2 });

	return accounts;
}

const LIMIT = 50; // EasyBroker recomienda este límite por página
const DELAY = 600; // Delay entre peticiones para respetar rate limits
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
    const accounts = getApiKeys();
    const seenIds = new Set<string>();
    let allProperties: Property[] = [];

    const statusesQuery = 'search[statuses][]=published&search[statuses][]=not_published&search[statuses][]=suspended';

    for (const acc of accounts) {
        let page = 1;
        let hasMore = true;

        const headers = {
            'X-Authorization': acc.key,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        while (hasMore) {
            try {
                const response = await fetchWithRetry(
                    `${API_BASE_URL}/properties?page=${page}&limit=${LIMIT}&${statusesQuery}`,
                    { headers }
                );

                const data = await response.json();
                
                if (!Array.isArray(data.content)) {
                    throw new Error('Unexpected API response format');
                }

                for (const item of data.content) {
                    if (item.public_id && !seenIds.has(item.public_id)) {
                        seenIds.add(item.public_id);
                        item._eb_account = acc.account;
                        allProperties.push(item);
                    }
                }
                
                hasMore = !!data.pagination?.next_page;
                if (hasMore) {
                    page++;
                    await new Promise(resolve => setTimeout(resolve, DELAY));
                }
            } catch (error) {
                console.error(`Error fetching page ${page} from ${acc.account}:`, error);
                hasMore = false;
            }
        }
    }

    return allProperties;
}

export const GET: RequestHandler = async () => {
    const accounts = getApiKeys();
    if (accounts.length === 0) {
        console.error('API keys de EasyBroker no configuradas en variables de entorno');
        return json(
            { error: 'Falta configurar las variables de EasyBroker API en el archivo .env' }, 
            { status: 500 }
        );
    }

    try {
        const properties = await getAllProperties();
        
        console.log('Propiedades obtenidas (Multi-cuenta EasyBroker):', {
            total: properties.length,
            cuentas: accounts.map(a => a.account),
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
