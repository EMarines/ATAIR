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
    const key = getApiKey();
    const headers = {
        'X-Authorization': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    // 1. Intentar propiedades propias
    let response = await fetch(`https://api.easybroker.com/v1/properties/${params.id}`, { headers });

    // 2. Si da 404, intentar propiedades de la Bolsa Inmobiliaria (MLS)
    if (response.status === 404) {
        const mlsResponse = await fetch(`https://api.easybroker.com/v1/mls_properties/${params.id}`, { headers });
        if (mlsResponse.ok) {
            const property = await mlsResponse.json();
            return json(property);
        }
        if (mlsResponse.status === 403) {
            return json({
                error: `La clave "${params.id}" pertenece a otra inmobiliaria externa de EasyBroker. Tu cuenta no tiene activo el add-on API de Bolsa Inmobiliaria (MLS). Para registrarla fácilmente, copia y pega el texto en la herramienta "Pegar Texto de WhatsApp" abajo.`
            }, { status: 403 });
        }
        return json({
            error: `La propiedad "${params.id}" no fue encontrada en tu catálogo de EasyBroker. Puedes capturarla pegando su texto en la herramienta "Pegar Texto de WhatsApp" abajo.`
        }, { status: 404 });
    }

    if (!response.ok) {
        return json({ error: `No se pudo obtener la propiedad "${params.id}" de EasyBroker (${response.status}).` }, { status: response.status });
    }

    const property = await response.json();
    return json(property);
}; 