import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { normalizeRawContactForAudit } from '$lib/functions/contactAudit';
import { normalizeProperty } from '$lib/functions/normalizeProperty';
import { planCopilotoCandidates } from '$lib/functions/copilotoPlanner';
import type { Binnacle, Todo } from '$lib/types';

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		let body: { e3Quota?: number } = {};
		try {
			body = await request.json();
		} catch {
			body = {};
		}

		const e3Quota =
			typeof body?.e3Quota === 'number' && Number.isFinite(body.e3Quota) && body.e3Quota >= 0
				? Math.floor(body.e3Quota)
				: 15;

		const [contactsSnap, propertiesSnap, binnaclesSnap, todosSnap] = await Promise.all([
			getDocs(collection(db, 'contacts')),
			getDocs(collection(db, 'properties')),
			getDocs(collection(db, 'binnacles')),
			getDocs(collection(db, 'todos'))
		]);

		const contacts = contactsSnap.docs.map((docSnap) =>
			normalizeRawContactForAudit(docSnap.id, docSnap.data() as Record<string, any>)
		);

		const properties = propertiesSnap.docs.map((docSnap) =>
			normalizeProperty(docSnap.data(), docSnap.id)
		);

		const binnacles: Binnacle[] = binnaclesSnap.docs.map((docSnap) => ({
			id: docSnap.id,
			...(docSnap.data() as Record<string, any>)
		})) as Binnacle[];

		const existingTodos: Todo[] = todosSnap.docs.map((docSnap) => ({
			id: docSnap.id,
			...(docSnap.data() as Record<string, any>)
		})) as Todo[];

		const plan = planCopilotoCandidates(contacts, properties, binnacles, existingTodos, {
			e3Quota,
			baseUrl: 'https://matchhome.vercel.app'
		});

		return json({
			success: true,
			...plan
		});
	} catch (error: any) {
		console.error('[Copiloto Plan] Error planificando candidatos:', error);
		return json(
			{
				success: false,
				error: error?.message || 'Error interno al planificar candidatos del Copiloto.'
			},
			{ status: 500 }
		);
	}
};
