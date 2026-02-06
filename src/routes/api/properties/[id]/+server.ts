import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ params }) => {
    const response = await fetch(
        `https://api.easybroker.com/v1/properties/${params.id}`, {
        headers: {
            'X-Authorization': env.VITE_EASYBROKER_API_KEY,
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