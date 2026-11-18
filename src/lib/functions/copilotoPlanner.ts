import type { Binnacle, Contact, Property, Todo } from '$lib/types';
import { getContactBadgeInfo, getContactCreatedAtMs, isWithinMaxAgeYears, normalizeStage } from './contactBadge';
import {
	findPropertiesInPriceRangeForContact,
	getMostRecentPropertySendMs,
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
	e1Quota?: number;
	e2Quota?: number;
	e4Quota?: number;
	e3Quota?: number;
	maxTotalCandidates?: number;
	gracePeriodHours?: number;
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
		skippedGracePeriod: number;
		totalCandidates: number;
		poolAvailable: {
			e1: number;
			e2: number;
			e4: number;
			e3: number;
		};
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

/**
 * Determina si un contacto se encuentra en período de gracia (ha tenido interacción en las últimas X horas).
 * Si fue tocado recientemente (WhatsApp saliente/entrante, llamada o última actividad < 20h), se le da tiempo
 * de reaccionar y no se le genera una nueva tarea hoy.
 */
export function isContactInGracePeriod(
	contact: Contact,
	binnacles: Binnacle[] = [],
	gracePeriodMs: number = 20 * 3600_000,
	nowMs: number = Date.now()
): boolean {
	if (!contact) return false;
	const threshold = nowMs - gracePeriodMs;

	// 1. Verificar lastContact (último contacto registrado)
	const lastContactMs = getContactCreatedAtMs((contact as any)?.lastContact);
	if (lastContactMs !== null && lastContactMs >= threshold) return true;

	// 2. Verificar lastResponse (última respuesta del lead)
	const lastResponseMs = getContactCreatedAtMs((contact as any)?.lastResponse);
	if (lastResponseMs !== null && lastResponseMs >= threshold) return true;

	// 3. Verificar bitácoras dirigidas a este contacto en la ventana de gracia
	const contactId = String(contact.id || '').trim();
	if (contactId && Array.isArray(binnacles)) {
		for (const b of binnacles) {
			if (String(b.to || '').trim() !== contactId) continue;
			const bDate = getContactCreatedAtMs((b as any)?.date ?? (b as any)?.createdAt);
			if (bDate !== null && bDate >= threshold) {
				return true;
			}
		}
	}

	return false;
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
 * Aplica cuotas balanceadas por etapa (E4, E2, E1, E3), tiempo de gracia de 20-24h
 * e intercalación (Round-Robin) para que la Agenda ofrezca una visión integral del embudo.
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
	const gracePeriodHours = options.gracePeriodHours ?? 20;
	const gracePeriodMs = gracePeriodHours * 3600_000;
	const baseUrl = options.baseUrl || 'https://matchhome.vercel.app';

	// Cuotas balanceadas por etapa (default: 5 de cada etapa = 20 total)
	const e1Quota = Math.max(0, Number(options.e1Quota ?? 5));
	const e2Quota = Math.max(0, Number(options.e2Quota ?? 5));
	const e4Quota = Math.max(0, Number(options.e4Quota ?? 5));
	const e3Quota = Math.max(0, Number(options.e3Quota ?? 5));
	const maxTotalCandidates = Math.max(1, Number(options.maxTotalCandidates ?? 20));

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
	let skippedGracePeriod = 0;

	for (const contact of contacts || []) {
		if (!contact?.id) continue;
		if (isProtectedOrNonBuyer(contact)) continue;

		if (blockedContactIds.has(contact.id)) {
			skippedAlreadyOpenOrToday++;
			continue;
		}

		// Tiempo de Gracia: si el contacto tuvo interacción en las últimas 20h, respetar tiempo de reacción
		if (isContactInGracePeriod(contact, binnacles, gracePeriodMs, nowMs)) {
			skippedGracePeriod++;
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
				const lastSendMs = getMostRecentPropertySendMs(contactId, binnacles);

				if (lastSendMs !== null) {
					const sendAgeMs = nowMs - lastSendMs;
					// Si el envío de opciones fue hace menos de 20h (hoy), está en tiempo de gracia para revisar
					if (sendAgeMs < gracePeriodMs) {
						skippedGracePeriod++;
						continue;
					}

					// Si fue hace entre 20h y 72h (ayer o antier): Paso 2: Llamada telefónica de seguimiento
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

	// Aplicar cuotas balanceadas por etapa
	const selectedE4 = e4List.slice(0, e4Quota);
	const selectedE2 = e2List.slice(0, e2Quota);
	const selectedE1 = e1List.slice(0, e1Quota);
	const selectedE3 = [...e3RecentPool, ...e3ColdPool].slice(0, e3RemainingQuota);
	const e3RecentCount = selectedE3.filter((c) => !c.isColdOver2y).length;
	const e3ColdCount = selectedE3.filter((c) => c.isColdOver2y).length;

	// Intercalación balanceada (Round-Robin): E4 -> E2 -> E1 -> E3
	// Así cada lote de 4 tarjetas presenta variedad integral del embudo comercial
	const candidates: CopilotoCandidate[] = [];
	const pools = [
		{ stage: 'E4', items: [...selectedE4] },
		{ stage: 'E2', items: [...selectedE2] },
		{ stage: 'E1', items: [...selectedE1] },
		{ stage: 'E3', items: [...selectedE3] }
	];

	while (candidates.length < maxTotalCandidates) {
		let addedInRound = 0;
		for (const pool of pools) {
			if (pool.items.length > 0 && candidates.length < maxTotalCandidates) {
				candidates.push(pool.items.shift()!);
				addedInRound++;
			}
		}
		if (addedInRound === 0) break;
	}

	return {
		runDate,
		e3Quota,
		e3RemainingQuota,
		counts: {
			e1: selectedE1.length,
			e2: selectedE2.length,
			e4: selectedE4.length,
			e3Recent: e3RecentCount,
			e3Cold: e3ColdCount,
			skippedAlreadyOpenOrToday,
			skippedGracePeriod,
			totalCandidates: candidates.length,
			poolAvailable: {
				e1: e1List.length,
				e2: e2List.length,
				e4: e4List.length,
				e3: e3RecentPool.length + e3ColdPool.length
			}
		},
		candidates
	};
}
