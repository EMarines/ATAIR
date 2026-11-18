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
		let body: {
			e3Quota?: number;
			e1Quota?: number;
			e2Quota?: number;
			e4Quota?: number;
			maxTotalCandidates?: number;
			gracePeriodHours?: number;
		} = {};
		try {
			body = await request.json();
		} catch {
			body = {};
		}

		const e1Quota =
			typeof body?.e1Quota === 'number' && Number.isFinite(body.e1Quota) && body.e1Quota >= 0
				? Math.floor(body.e1Quota)
				: 5;
		const e2Quota =
			typeof body?.e2Quota === 'number' && Number.isFinite(body.e2Quota) && body.e2Quota >= 0
				? Math.floor(body.e2Quota)
				: 5;
		const e4Quota =
			typeof body?.e4Quota === 'number' && Number.isFinite(body.e4Quota) && body.e4Quota >= 0
				? Math.floor(body.e4Quota)
				: 5;
		const e3Quota =
			typeof body?.e3Quota === 'number' && Number.isFinite(body.e3Quota) && body.e3Quota >= 0
				? Math.floor(body.e3Quota)
				: 5;
		const maxTotalCandidates =
			typeof body?.maxTotalCandidates === 'number' &&
			Number.isFinite(body.maxTotalCandidates) &&
			body.maxTotalCandidates > 0
				? Math.floor(body.maxTotalCandidates)
				: 20;
		const gracePeriodHours =
			typeof body?.gracePeriodHours === 'number' &&
			Number.isFinite(body.gracePeriodHours) &&
			body.gracePeriodHours >= 0
				? body.gracePeriodHours
				: 20;

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
			e1Quota,
			e2Quota,
			e4Quota,
			e3Quota,
			maxTotalCandidates,
			gracePeriodHours,
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
