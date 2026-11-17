import type { Binnacle, Contact, Property, Todo } from '$lib/types';
import { getContactBadgeInfo, getContactCreatedAtMs, isWithinMaxAgeYears, normalizeStage } from './contactBadge';
import {
	findPropertiesInPriceRangeForContact,
	hasRecentPropertySend,
	matchPropertiesForContact
} from './propertyMatching';
import { getProposalUrl } from './urlUtils';

export type CopilotoStage = 'E1' | 'E2' | 'E3' | 'E4';

export interface CopilotoMatchedPropertySummary {
	id: string;
	public_id: string;
	title: string;
	price: number;
	zona: string;
	proposalUrl: string;
}

export interface CopilotoCandidate {
	contactId: string;
	name: string;
	lastname: string;
	fullName: string;
	telephon: string;
	stage: CopilotoStage;
	priority: number;
	createdAtMs: number | null;
	lastContactMs: number | null;
	lastResponseMs: number | null;
	isColdOver2y: boolean;
	propCont: string;
	selecTP: string;
	budget: number;
	rangeProp: string;
	locaProperty: string[];
	tagsProperty: string[];
	notes: string;
	matchedProperties: CopilotoMatchedPropertySummary[];
	e3FormUrl?: string;
	isE1Over10Days?: boolean;
	e1Step?: 'send_options' | 'followup_call';
}

export interface CopilotoPlanOptions {
	e3Quota?: number;
	nowMs?: number;
	runDate?: string;
	baseUrl?: string;
}

export interface CopilotoPlanResult {
	runDate: string;
	e3Quota: number;
	e3RemainingQuota: number;
	counts: {
		e1: number;
		e2: number;
		e4: number;
		e3Recent: number;
		e3Cold: number;
		skippedAlreadyOpenOrToday: number;
		totalCandidates: number;
	};
	candidates: CopilotoCandidate[];
}

export function getChihuahuaDateKey(nowMs: number = Date.now()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Chihuahua',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(nowMs));
}

function isProtectedOrNonBuyer(contact: Contact): boolean {
	if (!contact || contact.isActive === false) return true;
	const raw = contact as any;
	const typeLower = String(contact.typeContact || contact.contactType || raw.tipo || '').toLowerCase();
	if (
		typeLower.includes('vendedor') ||
		typeLower.includes('propietario') ||
		typeLower.includes('arrendador') ||
		typeLower.includes('arrendatario') ||
		typeLower.includes('inquilino')
	) {
		return true;
	}

	const badge = getContactBadgeInfo(contact);
	if (badge.isAgent || badge.text.startsWith('A')) return true;

	const stage = normalizeStage(contact.contactStage);
	if (stage === 5 || stage === 6) return true;

	const cleanPhone = String(contact.telephon || '').replace(/\D/g, '');
	return cleanPhone.length < 10;
}

function buildCandidateRecord(
	contact: Contact,
	stage: CopilotoStage,
	priority: number,
	isColdOver2y: boolean,
	matchedProperties: CopilotoMatchedPropertySummary[],
	baseUrl: string,
	extra?: { isE1Over10Days?: boolean; e1Step?: 'send_options' | 'followup_call' }
): CopilotoCandidate {
	const fullName = `${contact.name || ''} ${contact.lastname || ''}`.trim() || 'Sin nombre';
	const contactId = String(contact.id || '').trim();
	const cleanBase = baseUrl.replace(/\/+$/, '');
	return {
		contactId,
		name: contact.name || '',
		lastname: contact.lastname || '',
		fullName,
		telephon: String(contact.telephon || '').trim(),
		stage,
		priority,
		createdAtMs: getContactCreatedAtMs((contact as any).createdAt),
		lastContactMs: getContactCreatedAtMs((contact as any).lastContact),
		lastResponseMs: getContactCreatedAtMs((contact as any).lastResponse),
		isColdOver2y,
		propCont: String(contact.propCont || '').trim(),
		selecTP: String(contact.selecTP || '').trim(),
		budget: Number(contact.budget || 0),
		rangeProp: String(contact.rangeProp || '').trim(),
		locaProperty: Array.isArray(contact.locaProperty) ? contact.locaProperty : [],
		tagsProperty: Array.isArray(contact.tagsProperty) ? contact.tagsProperty : [],
		notes: String(contact.notes || contact.comContact || '').trim(),
		matchedProperties,
		isE1Over10Days: extra?.isE1Over10Days,
		e1Step: extra?.e1Step,
		...(stage === 'E3'
			? { e3FormUrl: `${cleanBase}/buscar?c=${encodeURIComponent(contactId)}` }
			: {})
	};
}

/**
 * Tier 1 (Control Plane Determinístico):
 * Selecciona y prioriza los leads del día para ATAIR Copiloto sin invocar al LLM.
 */
export function planCopilotoCandidates(
	contacts: Contact[],
	properties: Property[],
	binnacles: Binnacle[],
	existingTodos: Todo[],
	options: CopilotoPlanOptions = {}
): CopilotoPlanResult {
	const nowMs = options.nowMs ?? Date.now();
	const runDate = options.runDate || getChihuahuaDateKey(nowMs);
	const e3Quota = Math.max(0, Number(options.e3Quota ?? 15));
	const baseUrl = options.baseUrl || 'https://matchhome.vercel.app';

	// Idempotencia diaria: excluir leads con tarjeta abierta o ya procesados hoy
	const blockedContactIds = new Set<string>();
	let e3AlreadyToday = 0;

	for (const todo of existingTodos || []) {
		if ((todo as any)?.source !== 'atair_copiloto') continue;
		const meta = (todo as any)?.copilotoMeta;
		const cid = String(meta?.contactId || (todo as any)?.contactId || '').trim();
		const todoRunDate = String(meta?.runDate || '').trim();
		const isDone = Boolean((todo as any)?.isCompleted ?? (todo as any)?.completed);

		if (todoRunDate === runDate && meta?.stage === 'E3') {
			e3AlreadyToday++;
		}
		if (cid && (!isDone || todoRunDate === runDate)) {
			blockedContactIds.add(cid);
		}
	}

	const e3RemainingQuota = Math.max(0, e3Quota - e3AlreadyToday);

	const e1List: CopilotoCandidate[] = [];
	const e2List: CopilotoCandidate[] = [];
	const e4List: CopilotoCandidate[] = [];
	const e3RecentPool: CopilotoCandidate[] = [];
	const e3ColdPool: CopilotoCandidate[] = [];
	let skippedAlreadyOpenOrToday = 0;

	for (const contact of contacts || []) {
		if (!contact?.id) continue;
		if (isProtectedOrNonBuyer(contact)) continue;

		if (blockedContactIds.has(contact.id)) {
			skippedAlreadyOpenOrToday++;
			continue;
		}

		const badge = getContactBadgeInfo(contact);
		const within2y = isWithinMaxAgeYears(contact, 2, nowMs);

		// Leads con más de 2 años (o sin fecha) se tratan como E3 en cola fría
		if (!within2y) {
			e3ColdPool.push(buildCandidateRecord(contact, 'E3', 4, true, [], baseUrl));
			continue;
		}

		if (badge.text === 'E1') {
			const createdAtMs = getContactCreatedAtMs((contact as any).createdAt);
			const isE1Over10Days = createdAtMs !== null && nowMs - createdAtMs > 10 * 86_400_000;

			if (isE1Over10Days) {
				const contactId = String(contact.id || '').trim();
				const sentRecently = hasRecentPropertySend(contactId, binnacles, 48 * 3600_000, nowMs);

				if (sentRecently) {
					// Paso 2: Llamada telefónica de seguimiento tras envío de opciones
					e1List.push(
						buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
							isE1Over10Days: true,
							e1Step: 'followup_call'
						})
					);
				} else {
					// Paso 1: Enviar 2 a 3 opciones en el rango de precio (±25%)
					const matchedProps = findPropertiesInPriceRangeForContact(contact, properties, {
						tolerance: 0.25,
						excludeAlreadySent: true,
						binnacles,
						maxResults: 3
					});

					if (matchedProps.length > 0) {
						const summaries: CopilotoMatchedPropertySummary[] = matchedProps.map((p) => ({
							id: String(p.id || p.docId || p.public_id || ''),
							public_id: String(p.public_id || ''),
							title: String(
								p.title || `${p.property_type || 'Propiedad'} en ${p.location || 'Chihuahua'}`
							),
							price: Number(p.price || 0),
							zona: String((p as any).zona || p.location || ''),
							proposalUrl: p.public_id
								? getProposalUrl(p.public_id, contact)
								: String((p as any).public_url || (p as any).urlProp || '')
						}));

						e1List.push(
							buildCandidateRecord(contact, 'E1', 1, false, summaries, baseUrl, {
								isE1Over10Days: true,
								e1Step: 'send_options'
							})
						);
					} else {
						// Si no hay propiedades en ese rango, fallback a llamada de seguimiento
						e1List.push(
							buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
								isE1Over10Days: true,
								e1Step: 'followup_call'
							})
						);
					}
				}
			} else {
				// E1 reciente (<10 días): atención telefónica inmediata
				e1List.push(
					buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
						isE1Over10Days: false
					})
				);
			}
		} else if (badge.text === 'E2') {
			e2List.push(buildCandidateRecord(contact, 'E2', 2, false, [], baseUrl));
		} else if (badge.text === 'E4') {
			const matches = matchPropertiesForContact(contact, properties, {
				synergyOnly: true,
				excludeAlreadySent: true,
				binnacles,
				maxResults: 3
			});
			if (matches.length === 0) continue;

			const summaries: CopilotoMatchedPropertySummary[] = matches.map((p) => ({
				id: String(p.id || p.docId || p.public_id || ''),
				public_id: String(p.public_id || ''),
				title: String(p.title || `${p.property_type || 'Propiedad'} en ${p.location || 'Chihuahua'}`),
				price: Number(p.price || 0),
				zona: String((p as any).zona || p.location || ''),
				proposalUrl: p.public_id
					? getProposalUrl(p.public_id, contact)
					: String((p as any).public_url || (p as any).urlProp || '')
			}));

			e4List.push(buildCandidateRecord(contact, 'E4', 3, false, summaries, baseUrl));
		} else if (badge.text === 'E3') {
			e3RecentPool.push(buildCandidateRecord(contact, 'E3', 4, false, [], baseUrl));
		}
	}

	const byMostRecent = (a: CopilotoCandidate, b: CopilotoCandidate) =>
		(b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);

	e1List.sort(byMostRecent);
	e2List.sort(byMostRecent);
	e4List.sort(byMostRecent);
	e3RecentPool.sort(byMostRecent);
	e3ColdPool.sort(byMostRecent);

	// E3: Primero <2 años (reciente -> antiguo), luego >2 años solo si sobra cuota
	const selectedE3 = [...e3RecentPool, ...e3ColdPool].slice(0, e3RemainingQuota);
	const e3RecentCount = selectedE3.filter((c) => !c.isColdOver2y).length;
	const e3ColdCount = selectedE3.filter((c) => c.isColdOver2y).length;

	const candidates = [...e1List, ...e2List, ...e4List, ...selectedE3];

	return {
		runDate,
		e3Quota,
		e3RemainingQuota,
		counts: {
			e1: e1List.length,
			e2: e2List.length,
			e4: e4List.length,
			e3Recent: e3RecentCount,
			e3Cold: e3ColdCount,
			skippedAlreadyOpenOrToday,
			totalCandidates: candidates.length
		},
		candidates
	};
}
