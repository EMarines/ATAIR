import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';

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

export const GET: RequestHandler = async ({ params }) => {
	const accounts = getApiKeys();
	const cleanId = (params.id || '').trim().toUpperCase();

	let lastStatus = 404;

	// 1. Intentar propiedades propias en ambas cuentas de EasyBroker (en cascada)
	for (const acc of accounts) {
		try {
			const headers = {
				'X-Authorization': acc.key,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			};
			const response = await fetch(`https://api.easybroker.com/v1/properties/${cleanId}`, { headers });
			if (response.ok) {
				const property = await response.json();
				property._eb_account = acc.account;
				return json(property);
			}
			lastStatus = response.status;
		} catch (e) {
			console.warn(`Error consultando EasyBroker (${acc.account}):`, e);
		}
	}

	return json({
		error: `La clave "${cleanId}" no fue encontrada en ninguna de tus 2 cuentas de EasyBroker (JGCapital ni MatchHome Personal). Puedes capturarla pegando su texto en la herramienta "Pegar Texto de WhatsApp" abajo.`
	}, { status: 404 });
}; 