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
	isRefill?: boolean;
	refillScale?: number;
	nowMs?: number;
	runDate?: string;
	baseUrl?: string;
}

export interface CopilotoPlanResult {
	runDate: string;
	isRefill: boolean;
	scaleApplied: number;
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
 * Determina si un contacto fue creado en el día anterior (o en las últimas 48h / hoy sin atender).
 * Se calcula con base en la zona horaria de Chihuahua para alinearse con el calendario operativo.
 */
export function isContactFromYesterdayOrNewer(
	createdAtMs: number | null,
	nowMs: number = Date.now()
): boolean {
	if (createdAtMs === null) return false;
	const ageMs = nowMs - createdAtMs;
	if (ageMs < 0) return false;

	if (ageMs <= 48 * 3600_000) return true;

	const contactDateKey = getChihuahuaDateKey(createdAtMs);
	const todayKey = getChihuahuaDateKey(nowMs);
	const yesterdayKey = getChihuahuaDateKey(nowMs - 24 * 3600_000);

	return contactDateKey === todayKey || contactDateKey === yesterdayKey;
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

	// Detección de recarga (segundo clic o posterior en el mismo día):
	// Si ya existen tareas de Copiloto generadas hoy, cada clic adicional genera el 50% del lote original
	const existingCopilotoTasksToday = (existingTodos || []).filter((t) => {
		if ((t as any)?.source !== 'atair_copiloto') return false;
		const meta = (t as any)?.copilotoMeta;
		return String(meta?.runDate || '').trim() === runDate;
	}).length;

	const isRefill = options.isRefill ?? existingCopilotoTasksToday > 0;
	const refillScale = options.refillScale ?? 0.5;
	const effectiveScale = isRefill ? refillScale : 1.0;

	// Cuotas canónicas definidas por Enrique Marines:
	// E1: Del día anterior; si son menos de 7, completar 14 con los más antiguos (empezando por los más recientes).
	// E4: Buscar prospectos con propiedades afines que no se les hayan enviado, máx 7.
	// E2: 4 de los más recientes (meta: pasar a E4 o descartar a E3).
	// E3: 2 de los más recientes.
	// Meta base total: 14 (E1) + 7 (E4) + 4 (E2) + 2 (E3) = 27 tareas (o 14 en recarga al 50%).
	const baseE1 = Math.max(0, Number(options.e1Quota ?? 14));
	const baseE2 = Math.max(0, Number(options.e2Quota ?? 4));
	const baseE4 = Math.max(0, Number(options.e4Quota ?? 7));
	const baseE3 = Math.max(0, Number(options.e3Quota ?? 2));
	const baseMaxTotal = Math.max(1, Number(options.maxTotalCandidates ?? 27));

	const e1Quota = isRefill ? Math.max(1, Math.round(baseE1 * effectiveScale)) : baseE1;
	const e2Quota = isRefill ? Math.max(1, Math.round(baseE2 * effectiveScale)) : baseE2;
	const e4Quota = isRefill ? Math.max(1, Math.round(baseE4 * effectiveScale)) : baseE4;
	const e3Quota = isRefill ? Math.max(1, Math.round(baseE3 * effectiveScale)) : baseE3;
	const maxTotalCandidates = isRefill
		? Math.max(1, Math.round(baseMaxTotal * effectiveScale))
		: baseMaxTotal;

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

	const e1YesterdayList: CopilotoCandidate[] = [];
	const e1OlderList: CopilotoCandidate[] = [];
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
			const isFromYesterday = isContactFromYesterdayOrNewer(createdAtMs, nowMs);

			if (isFromYesterday) {
				// E1 del día anterior (nuevo): llamada de prospección inicial inmediata
				e1YesterdayList.push(
					buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
						isE1Over10Days: false
					})
				);
			} else {
				// E1 más antiguo (acumulado): aplicar estrategia de 2 pasos si tiene >10 días
				const isE1Over10Days = createdAtMs !== null && nowMs - createdAtMs > 10 * 86_400_000;
				const contactId = String(contact.id || '').trim();

				if (isE1Over10Days) {
					const lastSendMs = getMostRecentPropertySendMs(contactId, binnacles);

					if (lastSendMs !== null) {
						const sendAgeMs = nowMs - lastSendMs;
						// Si el envío de opciones fue hace menos de 20h (hoy), está en tiempo de gracia para revisar
						if (sendAgeMs < gracePeriodMs) {
							skippedGracePeriod++;
							continue;
						}

						// Si fue hace entre 20h y 72h (ayer o antier): Paso 2: Llamada telefónica de seguimiento
						e1OlderList.push(
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

							e1OlderList.push(
								buildCandidateRecord(contact, 'E1', 1, false, summaries, baseUrl, {
									isE1Over10Days: true,
									e1Step: 'send_options'
								})
							);
						} else {
							// Si no hay propiedades en ese rango, fallback a llamada de seguimiento
							e1OlderList.push(
								buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
									isE1Over10Days: true,
									e1Step: 'followup_call'
								})
							);
						}
					}
				} else {
					// E1 entre 2 y 10 días: llamada inmediata de prospección
					e1OlderList.push(
						buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
							isE1Over10Days: false
						})
					);
				}
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

	e1YesterdayList.sort(byMostRecent);
	e1OlderList.sort(byMostRecent); // "empezando con los mas recientes"
	e2List.sort(byMostRecent);
	e4List.sort(byMostRecent);
	e3RecentPool.sort(byMostRecent);
	e3ColdPool.sort(byMostRecent);

	// Selección de E1 bajo regla canónica:
	// "todos los del dia anterior y si son menos de 7, completar 14 con los mas viejos, empezando con los mas recientes."
	let selectedE1: CopilotoCandidate[] = [];
	if (isRefill) {
		const e1Combined = [...e1YesterdayList, ...e1OlderList];
		selectedE1 = e1Combined.slice(0, e1Quota);
	} else {
		if (e1YesterdayList.length < 7) {
			selectedE1 = [...e1YesterdayList];
			const neededFromOlder = Math.max(0, e1Quota - selectedE1.length);
			selectedE1.push(...e1OlderList.slice(0, neededFromOlder));
		} else {
			selectedE1 = [...e1YesterdayList];
		}
	}

	const selectedE4 = e4List.slice(0, e4Quota);
	const selectedE2 = e2List.slice(0, e2Quota);
	const e3Pool = [...e3RecentPool, ...e3ColdPool];
	const selectedE3 = e3Pool.slice(0, e3Quota);

	// Intercalación balanceada (Round-Robin): E4 -> E2 -> E1 -> E3
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

	// Relleno Dinámico con E3 (Backfill):
	// Si se agotaron E1, E2 o E4, o tras el round-robin no se alcanza la garantía mínima de trabajo
	// (20 tareas en corrida inicial o 10 en recarga al 50%), se completa automáticamente con candidatos de E3
	const guaranteedMinimum = isRefill ? 10 : 20;
	if (candidates.length < guaranteedMinimum) {
		const usedContactIds = new Set(candidates.map((c) => c.contactId));
		const remainingE3 = e3Pool.filter((c) => !usedContactIds.has(c.contactId));
		while (candidates.length < guaranteedMinimum && remainingE3.length > 0) {
			candidates.push(remainingE3.shift()!);
		}
	}

	const e3RecentCount = candidates.filter((c) => c.stage === 'E3' && !c.isColdOver2y).length;
	const e3ColdCount = candidates.filter((c) => c.stage === 'E3' && c.isColdOver2y).length;

	return {
		runDate,
		isRefill,
		scaleApplied: effectiveScale,
		e3Quota,
		e3RemainingQuota,
		counts: {
			e1: candidates.filter((c) => c.stage === 'E1').length,
			e2: candidates.filter((c) => c.stage === 'E2').length,
			e4: candidates.filter((c) => c.stage === 'E4').length,
			e3Recent: e3RecentCount,
			e3Cold: e3ColdCount,
			skippedAlreadyOpenOrToday,
			skippedGracePeriod,
			totalCandidates: candidates.length,
			poolAvailable: {
				e1: e1YesterdayList.length + e1OlderList.length,
				e2: e2List.length,
				e4: e4List.length,
				e3: e3Pool.length
			}
		},
		candidates
	};
}
