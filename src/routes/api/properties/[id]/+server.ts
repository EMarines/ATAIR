import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_EASYBROKER_API_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ params }) => {
    const response = await fetch(
        `https://api.easybroker.com/v1/properties/${params.id}`, {
        headers: {
            'X-Authorization': PRIVATE_EASYBROKER_API_KEY,
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