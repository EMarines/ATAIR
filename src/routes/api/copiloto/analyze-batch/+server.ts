import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Binnacle } from '$lib/types';
import type { CopilotoCandidate } from '$lib/functions/copilotoPlanner';
import { analyzeCandidateWithGemini } from '$lib/functions/copilotoAnalyzer';

const MAX_BATCH_SIZE = 8;

function getGeminiApiKey(): string {
	return (
		env?.GEMINI_API_KEY ||
		env?.VITE_GEMINI_API_KEY ||
		process.env.GEMINI_API_KEY ||
		process.env.VITE_GEMINI_API_KEY ||
		''
	).trim();
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const rawCandidates = Array.isArray(body?.candidates) ? body.candidates : [];

		if (rawCandidates.length === 0) {
			return json({ success: true, results: [], usedFallbackCount: 0 });
		}

		const batch: CopilotoCandidate[] = rawCandidates.slice(0, MAX_BATCH_SIZE);
		const apiKey = getGeminiApiKey();

		const results = await Promise.all(
			batch.map(async (candidate) => {
				let contactBinnacles: Binnacle[] = [];
				if (candidate?.contactId) {
					try {
						const snap = await getDocs(
							query(collection(db, 'binnacles'), where('to', '==', candidate.contactId))
						);
						contactBinnacles = snap.docs.map((docSnap) => ({
							id: docSnap.id,
							...(docSnap.data() as Record<string, any>)
						})) as Binnacle[];
					} catch (binnErr) {
						console.warn(`[Copiloto Analyze] Error leyendo bitácora de ${candidate.contactId}:`, binnErr);
					}
				}
				return analyzeCandidateWithGemini(candidate, contactBinnacles, apiKey, fetch);
			})
		);

		const usedFallbackCount = results.filter((r) => r.usedFallback).length;

		return json({
			success: true,
			results,
			usedFallbackCount
		});
	} catch (error: any) {
		console.error('[Copiloto Analyze] Error analizando lote:', error);
		return json(
			{
				success: false,
				error: error?.message || 'Error interno al analizar lote con IA.'
			},
			{ status: 500 }
		);
	}
};
