import { json } from '@sveltejs/kit';
import { processInboundGoogleSync } from '$lib/services/googleSyncService';

export async function POST() {
	try {
		console.log('🚀 [API /api/sync/trigger] Disparando sincronización con n8n desde backend Vercel...');

		const [tasksRes, calRes] = await Promise.allSettled([
			fetch('https://n8n-atair.duckdns.org/webhook/atair-google-tasks-inbound-sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			}).then(async (r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status} desde n8n tasks`);
				return r.json();
			}),
			fetch('https://n8n-atair.duckdns.org/webhook/atair-google-calendar-inbound-sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			}).then(async (r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status} desde n8n calendar`);
				return r.json();
			})
		]);

		const syncResults: Record<string, any> = {};

		if (tasksRes.status === 'fulfilled' && tasksRes.value) {
			console.log('📦 [API /api/sync/trigger] Procesando lote de Google Tasks...');
			syncResults.tasks = await processInboundGoogleSync(tasksRes.value);
		} else {
			const err = tasksRes.status === 'rejected' ? tasksRes.reason?.message : 'Sin datos';
			console.warn('⚠️ [API /api/sync/trigger] Falló obtención de tasks:', err);
			syncResults.tasks = { success: false, error: err };
		}

		if (calRes.status === 'fulfilled' && calRes.value) {
			console.log('📅 [API /api/sync/trigger] Procesando lote de Google Calendar...');
			syncResults.calendar = await processInboundGoogleSync(calRes.value);
		} else {
			const err = calRes.status === 'rejected' ? calRes.reason?.message : 'Sin datos';
			console.warn('⚠️ [API /api/sync/trigger] Falló obtención de calendar:', err);
			syncResults.calendar = { success: false, error: err };
		}

		return json({
			success: true,
			...syncResults
		});
	} catch (error: any) {
		console.error('❌ [API /api/sync/trigger] Error crítico:', error);
		return json({ success: false, error: error?.message || 'Internal error' }, { status: 500 });
	}
}
