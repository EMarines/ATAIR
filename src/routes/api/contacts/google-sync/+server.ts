import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const N8N_WEBHOOK_URL =
	env.N8N_GOOGLE_CONTACTS_WEBHOOK ||
	'https://n8n-atair.duckdns.org/webhook/12c11a13-4b9f-416e-99c7-7e9cb5806fd5';

export async function POST({ request }) {
	try {
		const payload = await request.json();

		console.log('🚀 [API /api/contacts/google-sync] Enviando contacto a n8n:', payload.contact?.name || payload.contact?.fullName);

		const response = await fetch(N8N_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('❌ [API /api/contacts/google-sync] Error desde n8n:', response.status, errorText);
			return json(
				{ success: false, error: `Error n8n: ${response.status}`, details: errorText },
				{ status: response.status }
			);
		}

		const data = await response.json();
		console.log('✅ [API /api/contacts/google-sync] Respuesta exitosa de n8n:', data);
		return json(data);
	} catch (error: any) {
		console.error('❌ [API /api/contacts/google-sync] Excepción interna:', error);
		return json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
	}
}
