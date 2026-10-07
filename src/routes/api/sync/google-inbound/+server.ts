import { json } from '@sveltejs/kit';
import { processInboundGoogleSync } from '$lib/services/googleSyncService';

export async function POST({ request }) {
	try {
		const payload = await request.json();
		const result = await processInboundGoogleSync(payload);
		return json(result);
	} catch (error: any) {
		console.error('❌ [API /api/sync/google-inbound] Error:', error);
		return json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
	}
}
