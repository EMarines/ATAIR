import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';

function getApiKey(): string {
	const pEnv = privateEnv as Record<string, string>;
	const procEnv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string>;
	return (
		pEnv.VITE_EASYBROKER_API_KEY ||
		pEnv.PRIVATE_EASYBROKER_API_KEY ||
		procEnv.VITE_EASYBROKER_API_KEY ||
		procEnv.PRIVATE_EASYBROKER_API_KEY ||
		''
	);
}

export const GET: RequestHandler = async ({ params }) => {
    const response = await fetch(
        `https://api.easybroker.com/v1/properties/${params.id}`, {
        headers: {
            'X-Authorization': getApiKey(),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        return json({ error: 'Failed to fetch property' }, { status: response.status });
    }

    const property = await response.json();
    return json(property);
}; 