import type { Binnacle, Contact, Property, Todo } from '$lib/types';
import { getContactBadgeInfo, getContactCreatedAtMs, isWithinMaxAgeYears, normalizeStage } from './contactBadge';
import {
	findPropertiesInPriceRangeForContact,
	getMostRecentPropertySendMs,
	hasRecentPropertySend,
	matchPropertiesForContact
} from './propertyMatching';
import { getProposalUrl } from './urlUtils';

export type CopilotoStage = 'E1' | 'E2' | 'E3' | 'E4' | 'PAU';
export type CopilotoColdStep = 'step1_check' | 'step2_send_link' | 'post_step2_inactive';

export const COLD_REACTIVATION_DAYS = 180;
export const COLD_REACTIVATION_MS = COLD_REACTIVATION_DAYS * 86_400_000;
export const COLD_STEP2_WAIT_HOURS = 48;
export const COLD_STEP2_WAIT_MS = COLD_STEP2_WAIT_HOURS * 3600_000;
export const E1_E2_MAX_DAYS = 30;
export const E1_E2_MAX_MS = E1_E2_MAX_DAYS * 86_400_000;
export const CALL_RETRY_WAIT_HOURS = 48;
export const CALL_RETRY_WAIT_MS = CALL_RETRY_WAIT_HOURS * 3600_000;
export const POST_STEP2_INACTIVE_DAYS = 7;
export const POST_STEP2_INACTIVE_MS = POST_STEP2_INACTIVE_DAYS * 86_400_000;
export const PAUSE_CHECKIN_DAYS = 90;
export const PAUSE_CHECKIN_MS = PAUSE_CHECKIN_DAYS * 86_400_000;

export interface ColdReactivationState {
	isUnifiedE3Flow: boolean;
	isColdOver180Days: boolean;
	coldStep?: CopilotoColdStep;
	repliedToStep1: boolean;
	waitingForStep2: boolean;
	waitingAfterStep2: boolean;
	daysSinceLastTouch: number | null;
	lastStep1Ms: number | null;
	lastStep2Ms: number | null;
}

export interface ContactActivitySnapshot {
	lastTouchMs: number;
	lastOutboundMs: number;
	lastInboundMs: number;
	hasUnansweredInbound: boolean;
	callsWithoutReply: number;
	lastCallMs: number | null;
}

function normalizeActionText(raw: unknown): string {
	return String(raw ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

export function isColdStep1Binnacle(entry: Binnacle): boolean {
	const act = normalizeActionText(entry?.action);
	return (
		act.includes('reactivacion >180d paso 1') ||
		act.includes('reactivacion e3 paso 1') ||
		act.includes('reactivacion paso 1')
	);
}

export function isColdStep2Binnacle(entry: Binnacle): boolean {
	const act = normalizeActionText(entry?.action);
	return (
		act.includes('reactivacion >180d paso 2') ||
		act.includes('reactivacion e3 paso 2') ||
		act.includes('reactivacion paso 2') ||
		act.includes('link /buscar (copiloto)')
	);
}

function isInboundBinnacleEntry(entry: Binnacle): boolean {
	const act = normalizeActionText(entry?.action);
	if (act.includes('sin respuesta') || act.includes('no contesto')) return false;
	return act.includes('whatsapp recibido') || act.includes('respuesta') || act.includes('inbound');
}

function isCallBinnacleEntry(entry: Binnacle): boolean {
	const raw = entry as any;
	const act = normalizeActionText(entry?.action);
	const com = normalizeActionText(entry?.comment || raw?.content || '');
	return act.includes('llamada') || act.includes('call') || com.includes('llamada');
}

/**
 * Calcula el historial real de último contacto y conteo de llamadas sin respuesta
 * cruzando el contacto, sus bitácoras y tarjetas completadas de Copiloto.
 */
export function getContactActivitySnapshot(
	contact: {
		id?: string;
		lastContactMs?: number | null;
		lastResponseMs?: number | null;
		lastContact?: any;
		lastResponse?: any;
	},
	contactBinnacles: Binnacle[] = [],
	existingTodos: Todo[] = []
): ContactActivitySnapshot {
	const contactId = String(contact?.id || '').trim();
	const baseOutbound =
		(contact?.lastContactMs !== undefined
			? contact.lastContactMs
			: getContactCreatedAtMs(contact?.lastContact)) ?? 0;
	const baseInbound =
		(contact?.lastResponseMs !== undefined
			? contact.lastResponseMs
			: getContactCreatedAtMs(contact?.lastResponse)) ?? 0;

	let lastOutboundMs = baseOutbound;
	let lastInboundMs = baseInbound;
	let lastBinnacleMs = 0;

	for (const b of contactBinnacles || []) {
		if (contactId && b?.to && String(b.to).trim() !== contactId) continue;
		const ms = getContactCreatedAtMs((b as any)?.date ?? (b as any)?.createdAt) ?? 0;
		if (!ms) continue;
		if (ms > lastBinnacleMs) lastBinnacleMs = ms;
		if (isInboundBinnacleEntry(b)) {
			if (ms > lastInboundMs) lastInboundMs = ms;
		} else {
			if (ms > lastOutboundMs) lastOutboundMs = ms;
		}
	}

	if (contactId && Array.isArray(existingTodos)) {
		for (const todo of existingTodos) {
			if ((todo as any)?.source !== 'atair_copiloto') continue;
			const meta = (todo as any)?.copilotoMeta;
			if (String(meta?.contactId || (todo as any)?.contactId || '').trim() !== contactId) continue;
			const isDone = Boolean((todo as any)?.isCompleted ?? (todo as any)?.completed);
			if (!isDone) continue;
			const doneMs =
				getContactCreatedAtMs((todo as any)?.completedAt) ??
				getContactCreatedAtMs(meta?.executedAt) ??
				getContactCreatedAtMs((todo as any)?.createdAt) ??
				0;
			if (doneMs > lastOutboundMs) lastOutboundMs = doneMs;
		}
	}

	let callsWithoutReply = 0;
	let lastCallMs: number | null = null;
	for (const b of contactBinnacles || []) {
		if (contactId && b?.to && String(b.to).trim() !== contactId) continue;
		const ms = getContactCreatedAtMs((b as any)?.date ?? (b as any)?.createdAt) ?? 0;
		if (lastInboundMs > 0 && ms > 0 && ms <= lastInboundMs) continue;
		if (isInboundBinnacleEntry(b)) continue;
		if (isCallBinnacleEntry(b)) {
			callsWithoutReply++;
			if (ms > 0 && (lastCallMs === null || ms > lastCallMs)) {
				lastCallMs = ms;
			}
		}
	}

	const lastTouchMs = Math.max(lastOutboundMs, lastInboundMs, lastBinnacleMs);
	const hasUnansweredInbound = lastInboundMs > 0 && lastInboundMs > lastOutboundMs;

	return {
		lastTouchMs,
		lastOutboundMs,
		lastInboundMs,
		hasUnansweredInbound,
		callsWithoutReply,
		lastCallMs
	};
}

/**
 * Evalúa el estado de reactivación unificada E3 en 2 pasos (aplica a todo E3, E1/E2 >30d o >=2 llam., y >180d):
 * - Paso 1 (sin link): preguntar si sigue buscando casa y si le interesa nuestra nueva herramienta rápida.
 * - Espera 2 días (48h) sin respuesta; si el lead responde antes, acelera de inmediato el Paso 2.
 * - Paso 2 (con link /buscar): enviar link personalizado para capturar características de la casa de sus sueños.
 * - Post-Paso 2 (>=7 días sin respuesta ni registro): proponer depuración a Etapa 8 · Inactivo (IN).
 */
export function evaluateColdReactivationState(
	contact: {
		id?: string;
		createdAtMs?: number | null;
		lastContactMs?: number | null;
		lastResponseMs?: number | null;
		createdAt?: any;
		lastContact?: any;
		lastResponse?: any;
	},
	contactBinnacles: Binnacle[],
	existingTodos: Todo[] = [],
	nowMs: number = Date.now(),
	options: { forceE3Flow?: boolean } = {}
): ColdReactivationState {
	const contactId = String(contact?.id || '').trim();
	const createdAtMs =
		contact?.createdAtMs !== undefined
			? contact.createdAtMs
			: getContactCreatedAtMs(contact?.createdAt);
	const activity = getContactActivitySnapshot(contact, contactBinnacles, existingTodos);

	let lastStep1Ms: number | null = null;
	let lastStep2Ms: number | null = null;

	for (const b of contactBinnacles || []) {
		if (contactId && b?.to && String(b.to).trim() !== contactId) continue;
		const ms = getContactCreatedAtMs((b as any)?.date ?? (b as any)?.createdAt);
		if (!ms) continue;

		if (isColdStep1Binnacle(b)) {
			if (!lastStep1Ms || ms > lastStep1Ms) lastStep1Ms = ms;
		}
		if (isColdStep2Binnacle(b)) {
			if (!lastStep2Ms || ms > lastStep2Ms) lastStep2Ms = ms;
		}
	}

	// Respaldo con todos completados recientes de Copiloto por si las 800 bitácoras globales no alcanzaron el Paso 1/2
	if (contactId && Array.isArray(existingTodos)) {
		for (const todo of existingTodos) {
			if ((todo as any)?.source !== 'atair_copiloto') continue;
			const meta = (todo as any)?.copilotoMeta;
			if (String(meta?.contactId || '').trim() !== contactId) continue;
			const isDone = Boolean((todo as any)?.isCompleted ?? (todo as any)?.completed);
			if (!isDone) continue;
			const doneMs =
				getContactCreatedAtMs((todo as any)?.completedAt) ??
				getContactCreatedAtMs(meta?.executedAt) ??
				getContactCreatedAtMs((todo as any)?.createdAt);
			if (!doneMs) continue;
			if (meta?.coldStep === 'step1_check' && (!lastStep1Ms || doneMs > lastStep1Ms)) {
				lastStep1Ms = doneMs;
			}
			if (meta?.coldStep === 'step2_send_link' && (!lastStep2Ms || doneMs > lastStep2Ms)) {
				lastStep2Ms = doneMs;
			}
		}
	}

	const latestTouchWithCreatedMs = Math.max(activity.lastTouchMs, createdAtMs ?? 0);
	const daysSinceLastTouch =
		latestTouchWithCreatedMs > 0
			? Math.max(0, Math.floor((nowMs - latestTouchWithCreatedMs) / 86_400_000))
			: null;

	const isOver180Days =
		latestTouchWithCreatedMs > 0
			? nowMs - latestTouchWithCreatedMs > COLD_REACTIVATION_MS
			: true;

	// 1. ¿Hay un Paso 1 activo pendiente de Paso 2? (dentro de los últimos 30 días y sin Paso 2 posterior)
	const hasPendingStep1 =
		lastStep1Ms !== null &&
		nowMs - lastStep1Ms <= 30 * 86_400_000 &&
		(lastStep2Ms === null || lastStep2Ms < lastStep1Ms);

	if (hasPendingStep1 && lastStep1Ms !== null) {
		const repliedAfterStep1 = activity.lastInboundMs > lastStep1Ms;
		const advisorRepliedAfterInbound =
			repliedAfterStep1 && activity.lastOutboundMs > activity.lastInboundMs;

		if (repliedAfterStep1 && !advisorRepliedAfterInbound) {
			return {
				isUnifiedE3Flow: true,
				isColdOver180Days: isOver180Days,
				coldStep: 'step2_send_link',
				repliedToStep1: true,
				waitingForStep2: false,
				waitingAfterStep2: false,
				daysSinceLastTouch,
				lastStep1Ms,
				lastStep2Ms
			};
		}

		if (repliedAfterStep1 && advisorRepliedAfterInbound) {
			return {
				isUnifiedE3Flow: false,
				isColdOver180Days: false,
				repliedToStep1: true,
				waitingForStep2: false,
				waitingAfterStep2: false,
				daysSinceLastTouch,
				lastStep1Ms,
				lastStep2Ms
			};
		}

		const elapsedSinceStep1 = nowMs - lastStep1Ms;
		if (elapsedSinceStep1 < COLD_STEP2_WAIT_MS) {
			return {
				isUnifiedE3Flow: true,
				isColdOver180Days: isOver180Days,
				repliedToStep1: false,
				waitingForStep2: true,
				waitingAfterStep2: false,
				daysSinceLastTouch,
				lastStep1Ms,
				lastStep2Ms
			};
		}

		return {
			isUnifiedE3Flow: true,
			isColdOver180Days: isOver180Days,
			coldStep: 'step2_send_link',
			repliedToStep1: false,
			waitingForStep2: false,
			waitingAfterStep2: false,
			daysSinceLastTouch,
			lastStep1Ms,
			lastStep2Ms
		};
	}

	// 2. ¿Ya se envió Paso 2 recientemente (últimos 45 días) sin respuesta posterior? -> esperar 7d y luego proponer IN
	if (lastStep2Ms !== null && nowMs - lastStep2Ms <= 45 * 86_400_000) {
		const repliedAfterStep2 = activity.lastInboundMs > lastStep2Ms;
		if (!repliedAfterStep2) {
			if (nowMs - lastStep2Ms < POST_STEP2_INACTIVE_MS) {
				return {
					isUnifiedE3Flow: true,
					isColdOver180Days: isOver180Days,
					repliedToStep1: false,
					waitingForStep2: false,
					waitingAfterStep2: true,
					daysSinceLastTouch,
					lastStep1Ms,
					lastStep2Ms
				};
			}

			return {
				isUnifiedE3Flow: true,
				isColdOver180Days: isOver180Days,
				coldStep: 'post_step2_inactive',
				repliedToStep1: false,
				waitingForStep2: false,
				waitingAfterStep2: false,
				daysSinceLastTouch,
				lastStep1Ms,
				lastStep2Ms
			};
		}
	}

	// 3. Si aplica flujo E3 (forzado por etapa E3, >30d/2 llam., o >180d) -> Paso 1 sin link
	if (options.forceE3Flow || isOver180Days) {
		return {
			isUnifiedE3Flow: true,
			isColdOver180Days: isOver180Days,
			coldStep: 'step1_check',
			repliedToStep1: false,
			waitingForStep2: false,
			waitingAfterStep2: false,
			daysSinceLastTouch,
			lastStep1Ms,
			lastStep2Ms
		};
	}

	return {
		isUnifiedE3Flow: false,
		isColdOver180Days: false,
		repliedToStep1: false,
		waitingForStep2: false,
		waitingAfterStep2: false,
		daysSinceLastTouch,
		lastStep1Ms,
		lastStep2Ms
	};
}

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
	selecTO?: string;
	budget: number;
	rangeProp: string;
	numBeds?: number;
	modePay?: string;
	locaProperty: string[];
	tagsProperty: string[];
	notes: string;
	matchedProperties: CopilotoMatchedPropertySummary[];
	e3FormUrl?: string;
	isE1Over10Days?: boolean;
	e1Step?: 'send_options' | 'followup_call';
	e2Step?: 'send_options' | 'followup_call';
	isColdOver180Days?: boolean;
	coldStep?: CopilotoColdStep;
	repliedToStep1?: boolean;
	hasUnansweredInbound?: boolean;
	daysSinceLastTouch?: number | null;
	lastTouchMs?: number;
	isPausedCheckIn?: boolean;
	pausedReactivateAt?: number | null;
}

export interface CopilotoPlanOptions {
	e1Quota?: number;
	e2Quota?: number;
	e4Quota?: number;
	e3Quota?: number;
	pauQuota?: number;
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
		pausedCheckIn?: number;
		skippedAlreadyOpenOrToday: number;
		skippedGracePeriod: number;
		totalCandidates: number;
		poolAvailable: {
			e1: number;
			e2: number;
			e4: number;
			e3: number;
			pau?: number;
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

function isNonBuyerRoleOrInvalidPhone(contact: Contact): boolean {
	if (!contact) return true;
	const raw = contact as any;
	const typeLower = String(contact.typeContact || contact.contactType || raw.tipo || '').toLowerCase();
	if (
		typeLower.includes('vendedor') ||
		typeLower.includes('propietario') ||
		typeLower.includes('arrendador') ||
		typeLower.includes('arrendatario') ||
		typeLower.includes('inquilino') ||
		typeLower.includes('agente') ||
		typeLower.includes('constructor') ||
		typeLower.includes('inmobiliaria') ||
		typeLower.includes('colaborador') ||
		typeLower.includes('asesor')
	) {
		return true;
	}

	const stage = normalizeStage(contact.contactStage);
	if (stage === 5 || stage === 6 || stage === 'OW' || stage === 'A1' || stage === 'A2') return true;

	const cleanPhone = String(contact.telephon || '').replace(/\D/g, '');
	return cleanPhone.length < 10;
}

function isPausedDueForCheckIn(contact: Contact, nowMs: number): { due: boolean; reactivateAtMs: number | null } {
	if (!contact || contact.isActive !== false) return { due: false, reactivateAtMs: null };
	const reason = String((contact as any).inactiveReason || '').toLowerCase().trim();
	if (reason !== 'pausado') return { due: false, reactivateAtMs: null };
	const reactivateAtMs = getContactCreatedAtMs((contact as any).reactivateAt);
	if (reactivateAtMs === null) return { due: false, reactivateAtMs: null };
	return { due: nowMs >= reactivateAtMs, reactivateAtMs };
}

function isProtectedOrNonBuyer(contact: Contact): boolean {
	if (!contact || contact.isActive === false) return true;
	if (isNonBuyerRoleOrInvalidPhone(contact)) return true;

	const stage = normalizeStage(contact.contactStage);
	if (stage === 'PAU' || stage === 'IN') return true;

	const badge = getContactBadgeInfo(contact);
	if (badge.isAgent || badge.text.startsWith('A') || badge.text === 'PAU' || badge.text === 'IN') return true;

	return false;
}

function buildCandidateRecord(
	contact: Contact,
	stage: CopilotoStage,
	priority: number,
	isColdOver2y: boolean,
	matchedProperties: CopilotoMatchedPropertySummary[],
	baseUrl: string,
	extra?: {
		isE1Over10Days?: boolean;
		e1Step?: 'send_options' | 'followup_call';
		e2Step?: 'send_options' | 'followup_call';
		isColdOver180Days?: boolean;
		coldStep?: CopilotoColdStep;
		repliedToStep1?: boolean;
		hasUnansweredInbound?: boolean;
		daysSinceLastTouch?: number | null;
		lastTouchMs?: number;
		isPausedCheckIn?: boolean;
		pausedReactivateAt?: number | null;
	}
): CopilotoCandidate {
	const fullName = `${contact.name || ''} ${contact.lastname || ''}`.trim() || 'Sin nombre';
	const contactId = String(contact.id || '').trim();
	const cleanBase = baseUrl.replace(/\/+$/, '');
	const includeBuscarLink =
		stage === 'E3' ||
		Boolean(extra?.coldStep) ||
		Boolean(extra?.isColdOver180Days) ||
		Boolean(extra?.isPausedCheckIn);
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
		selecTO: String(contact.selecTO || contact.typeOperation || '').trim(),
		budget: Number(contact.budget || 0),
		rangeProp: String(contact.rangeProp || '').trim(),
		numBeds: Number(contact.numBeds || 0),
		modePay: String(contact.modePay || '').trim(),
		locaProperty: Array.isArray(contact.locaProperty) ? contact.locaProperty : [],
		tagsProperty: Array.isArray(contact.tagsProperty) ? contact.tagsProperty : [],
		notes: String(contact.notes || contact.comContact || '').trim(),
		matchedProperties,
		isE1Over10Days: extra?.isE1Over10Days,
		e1Step: extra?.e1Step,
		e2Step: extra?.e2Step,
		isColdOver180Days: extra?.isColdOver180Days,
		coldStep: extra?.coldStep,
		repliedToStep1: extra?.repliedToStep1,
		hasUnansweredInbound: extra?.hasUnansweredInbound,
		daysSinceLastTouch: extra?.daysSinceLastTouch,
		lastTouchMs: extra?.lastTouchMs ?? 0,
		isPausedCheckIn: extra?.isPausedCheckIn,
		pausedReactivateAt: extra?.pausedReactivateAt,
		...(includeBuscarLink
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
	const basePau = Math.max(0, Number(options.pauQuota ?? 3));
	const baseMaxTotal = Math.max(1, Number(options.maxTotalCandidates ?? 27));

	const e1Quota = isRefill ? Math.max(1, Math.round(baseE1 * effectiveScale)) : baseE1;
	const e2Quota = isRefill ? Math.max(1, Math.round(baseE2 * effectiveScale)) : baseE2;
	const e4Quota = isRefill ? Math.max(1, Math.round(baseE4 * effectiveScale)) : baseE4;
	const e3Quota = isRefill ? Math.max(1, Math.round(baseE3 * effectiveScale)) : baseE3;
	const pauQuota = isRefill ? Math.max(1, Math.round(basePau * effectiveScale)) : basePau;
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
	const pausedDuePool: CopilotoCandidate[] = [];
	let skippedAlreadyOpenOrToday = 0;
	let skippedGracePeriod = 0;

	// Pre-indexar bitácoras por contacto para acelerar búsquedas de estado frío y periodo de gracia
	const binnaclesByContact = new Map<string, Binnacle[]>();
	for (const b of binnacles || []) {
		const toId = String(b?.to || '').trim();
		if (!toId) continue;
		const arr = binnaclesByContact.get(toId);
		if (arr) arr.push(b);
		else binnaclesByContact.set(toId, [b]);
	}

	for (const contact of contacts || []) {
		if (!contact?.id) continue;

		// Chequeo trimestral de contactos PAUSADOS (isActive=false, inactiveReason='pausado', reactivateAt <= hoy):
		// Se les envía un mensaje preguntando si retomaron búsqueda, manteniéndolos pausados hasta confirmación.
		const pausedCheck = isPausedDueForCheckIn(contact, nowMs);
		if (pausedCheck.due) {
			if (isNonBuyerRoleOrInvalidPhone(contact)) continue;
			if (blockedContactIds.has(contact.id)) {
				skippedAlreadyOpenOrToday++;
				continue;
			}
			const contactId = String(contact.id || '').trim();
			const contactBinnacles = binnaclesByContact.get(contactId) || [];
			if (isContactInGracePeriod(contact, contactBinnacles, gracePeriodMs, nowMs)) {
				skippedGracePeriod++;
				continue;
			}
			pausedDuePool.push(
				buildCandidateRecord(contact, 'PAU', 3, false, [], baseUrl, {
					isPausedCheckIn: true,
					pausedReactivateAt: pausedCheck.reactivateAtMs
				})
			);
			continue;
		}

		if (isProtectedOrNonBuyer(contact)) continue;

		if (blockedContactIds.has(contact.id)) {
			skippedAlreadyOpenOrToday++;
			continue;
		}

		const contactId = String(contact.id || '').trim();
		const contactBinnacles = binnaclesByContact.get(contactId) || [];
		const badge = getContactBadgeInfo(contact);
		const within2y = isWithinMaxAgeYears(contact, 2, nowMs);
		const activity = getContactActivitySnapshot(contact, contactBinnacles, existingTodos);
		const createdAtMs = getContactCreatedAtMs((contact as any).createdAt);

		// E4 (Búsqueda Activa): todo el inventario compatible no enviado, con prioridad MH -> EB -> Sinergias,
		// sin enfriamiento artificial entre días (solo idempotencia diaria vía blockedContactIds).
		if (within2y && badge.text === 'E4') {
			const matches = matchPropertiesForContact(contact, properties, {
				synergyOnly: false,
				prioritizeInventory: true,
				excludeAlreadySent: true,
				binnacles: contactBinnacles,
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

			e4List.push(
				buildCandidateRecord(contact, 'E4', 3, false, summaries, baseUrl, {
					hasUnansweredInbound: activity.hasUnansweredInbound,
					lastTouchMs: activity.lastTouchMs
				})
			);
			continue;
		}

		const isOver30Days = createdAtMs !== null ? nowMs - createdAtMs > E1_E2_MAX_MS : false;
		const isE1OrE2ToE3 =
			(badge.text === 'E1' || badge.text === 'E2') &&
			(isOver30Days || (activity.callsWithoutReply >= 2 && !activity.hasUnansweredInbound));
		const forceE3Flow = !within2y || badge.text === 'E3' || isE1OrE2ToE3;
		const effectiveStage = !within2y ? 'E3' : badge.text;

		// Regla unificada E3 (aplica a todo E3, E1/E2 >30d o >=2 llam. sin respuesta, y >180d)
		const coldState =
			effectiveStage === 'E1' || effectiveStage === 'E2' || effectiveStage === 'E3'
				? evaluateColdReactivationState(contact, contactBinnacles, existingTodos, nowMs, {
						forceE3Flow
					})
				: null;

		if (coldState?.waitingForStep2 || coldState?.waitingAfterStep2) {
			// Dentro de ventana de espera (48h tras Paso 1 o 7d tras Paso 2)
			skippedGracePeriod++;
			continue;
		}

		// Si el lead respondió (al Paso 1 o en general sin respuesta nuestra posterior), no esperar gracia
		const fastTrackReply = Boolean(
			(coldState?.repliedToStep1 && coldState?.coldStep === 'step2_send_link') ||
				activity.hasUnansweredInbound
		);

		// Tiempo de Gracia: si el contacto tuvo interacción en las últimas 20h, respetar tiempo de reacción
		if (!fastTrackReply && isContactInGracePeriod(contact, contactBinnacles, gracePeriodMs, nowMs)) {
			skippedGracePeriod++;
			continue;
		}

		const coldExtra =
			coldState?.isUnifiedE3Flow && coldState?.coldStep
				? {
						isColdOver180Days: coldState.isColdOver180Days,
						coldStep: coldState.coldStep,
						repliedToStep1: coldState.repliedToStep1,
						hasUnansweredInbound: activity.hasUnansweredInbound,
						daysSinceLastTouch: coldState.daysSinceLastTouch,
						lastTouchMs: activity.lastTouchMs
					}
				: undefined;

		// Leads con más de 2 años (o sin fecha) se tratan como E3 en cola fría
		if (!within2y) {
			e3ColdPool.push(buildCandidateRecord(contact, 'E3', 4, true, [], baseUrl, coldExtra));
			continue;
		}

		if (badge.text === 'E1') {
			if (coldExtra) {
				// Lead E1 >30d, >=2 llamadas sin respuesta o >180d -> flujo unificado E3
				const rec = buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
					isE1Over10Days: false,
					...coldExtra
				});
				if (coldExtra.repliedToStep1 || activity.hasUnansweredInbound) {
					e1YesterdayList.push(rec);
				} else {
					e1OlderList.push(rec);
				}
				continue;
			}

			// Si tuvo 1 llamada sin respuesta en E1, respetar 1 día completo de diferencia (48h) antes de la 2a llamada
			if (
				activity.callsWithoutReply === 1 &&
				activity.lastCallMs !== null &&
				nowMs - activity.lastCallMs < CALL_RETRY_WAIT_MS &&
				!activity.hasUnansweredInbound
			) {
				skippedGracePeriod++;
				continue;
			}

			const isFromYesterday = isContactFromYesterdayOrNewer(createdAtMs, nowMs);

			if (isFromYesterday) {
				// E1 del día anterior (nuevo): llamada de prospección inicial inmediata
				e1YesterdayList.push(
					buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
						isE1Over10Days: false,
						hasUnansweredInbound: activity.hasUnansweredInbound,
						lastTouchMs: activity.lastTouchMs
					})
				);
			} else {
				// E1 entre 2 y 30 días: aplicar estrategia de 2 pasos si tiene >10 días
				const isE1Over10Days = createdAtMs !== null && nowMs - createdAtMs > 10 * 86_400_000;

				if (isE1Over10Days) {
					const lastSendMs = getMostRecentPropertySendMs(contactId, contactBinnacles);

					if (lastSendMs !== null && lastSendMs >= activity.lastInboundMs) {
						const sendAgeMs = nowMs - lastSendMs;
						if (sendAgeMs < gracePeriodMs && !activity.hasUnansweredInbound) {
							skippedGracePeriod++;
							continue;
						}

						e1OlderList.push(
							buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
								isE1Over10Days: true,
								e1Step: 'followup_call',
								hasUnansweredInbound: activity.hasUnansweredInbound,
								lastTouchMs: activity.lastTouchMs
							})
						);
					} else {
						// Paso 1: Enviar 2 a 3 opciones en el rango de precio (±25%)
						const matchedProps = findPropertiesInPriceRangeForContact(contact, properties, {
							tolerance: 0.25,
							excludeAlreadySent: true,
							binnacles: contactBinnacles,
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
									e1Step: 'send_options',
									hasUnansweredInbound: activity.hasUnansweredInbound,
									lastTouchMs: activity.lastTouchMs
								})
							);
						} else {
							e1OlderList.push(
								buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
									isE1Over10Days: true,
									e1Step: 'followup_call',
									hasUnansweredInbound: activity.hasUnansweredInbound,
									lastTouchMs: activity.lastTouchMs
								})
							);
						}
					}
				} else {
					// E1 entre 2 y 10 días: llamada inmediata de prospección
					e1OlderList.push(
						buildCandidateRecord(contact, 'E1', 1, false, [], baseUrl, {
							isE1Over10Days: false,
							hasUnansweredInbound: activity.hasUnansweredInbound,
							lastTouchMs: activity.lastTouchMs
						})
					);
				}
			}
		} else if (badge.text === 'E2') {
			if (coldExtra) {
				e2List.push(buildCandidateRecord(contact, 'E2', 2, false, [], baseUrl, coldExtra));
				continue;
			}

			// Si tuvo 1 llamada sin respuesta en E2, respetar 1 día completo de diferencia (48h)
			if (
				activity.callsWithoutReply === 1 &&
				activity.lastCallMs !== null &&
				nowMs - activity.lastCallMs < CALL_RETRY_WAIT_MS &&
				!activity.hasUnansweredInbound
			) {
				skippedGracePeriod++;
				continue;
			}

			const lastSendMs = getMostRecentPropertySendMs(contactId, contactBinnacles);
			if (lastSendMs !== null && lastSendMs >= activity.lastInboundMs) {
				const sendAgeMs = nowMs - lastSendMs;
				if (sendAgeMs < gracePeriodMs && !activity.hasUnansweredInbound) {
					skippedGracePeriod++;
					continue;
				}
				e2List.push(
					buildCandidateRecord(contact, 'E2', 2, false, [], baseUrl, {
						e2Step: 'followup_call',
						hasUnansweredInbound: activity.hasUnansweredInbound,
						lastTouchMs: activity.lastTouchMs
					})
				);
			} else {
				const hasSearchCriteria = Boolean(
					contact.selecTP ||
						Number(contact.budget || 0) > 0 ||
						contact.rangeProp ||
						(Array.isArray(contact.locaProperty) && contact.locaProperty.length > 0) ||
						(Array.isArray(contact.tagsProperty) && contact.tagsProperty.length > 0)
				);
				const matches = hasSearchCriteria
					? matchPropertiesForContact(contact, properties, {
							synergyOnly: false,
							prioritizeInventory: true,
							excludeAlreadySent: true,
							binnacles: contactBinnacles,
							maxResults: 3
						})
					: [];

				if (matches.length > 0) {
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
					e2List.push(
						buildCandidateRecord(contact, 'E2', 2, false, summaries, baseUrl, {
							e2Step: 'send_options',
							hasUnansweredInbound: activity.hasUnansweredInbound,
							lastTouchMs: activity.lastTouchMs
						})
					);
				} else {
					e2List.push(
						buildCandidateRecord(contact, 'E2', 2, false, [], baseUrl, {
							e2Step: 'followup_call',
							hasUnansweredInbound: activity.hasUnansweredInbound,
							lastTouchMs: activity.lastTouchMs
						})
					);
				}
			}
		} else if (badge.text === 'E3') {
			e3RecentPool.push(buildCandidateRecord(contact, 'E3', 4, false, [], baseUrl, coldExtra));
		}
	}

	// Rotación justa (Anti-repetición):
	// 1) Respuestas entrantes sin atender o respuestas al Paso 1
	// 2) Contactos sin toque previo (lastTouchMs === 0) primero, o con más tiempo sin contacto (lastTouchMs ASC)
	// 3) Desempate por fecha de alta más reciente
	const byFairRotation = (a: CopilotoCandidate, b: CopilotoCandidate) => {
		const aReply = a.repliedToStep1 || a.hasUnansweredInbound ? 1 : 0;
		const bReply = b.repliedToStep1 || b.hasUnansweredInbound ? 1 : 0;
		if (aReply !== bReply) return bReply - aReply;

		const aTouch = a.lastTouchMs ?? 0;
		const bTouch = b.lastTouchMs ?? 0;
		if (aTouch !== bTouch) {
			if (aTouch === 0) return -1;
			if (bTouch === 0) return 1;
			return aTouch - bTouch;
		}
		return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
	};

	e1YesterdayList.sort(byFairRotation);
	e1OlderList.sort(byFairRotation);
	e2List.sort(byFairRotation);
	e4List.sort(byFairRotation);
	e3RecentPool.sort(byFairRotation);
	e3ColdPool.sort(byFairRotation);

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
	pausedDuePool.sort((a, b) => (a.pausedReactivateAt ?? 0) - (b.pausedReactivateAt ?? 0));
	const selectedPau = pausedDuePool.slice(0, pauQuota);

	// Intercalación balanceada (Round-Robin): E4 -> E2 -> E1 -> PAU -> E3
	const candidates: CopilotoCandidate[] = [];
	const pools = [
		{ stage: 'E4', items: [...selectedE4] },
		{ stage: 'E2', items: [...selectedE2] },
		{ stage: 'E1', items: [...selectedE1] },
		{ stage: 'PAU', items: [...selectedPau] },
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
	const pausedCheckInCount = candidates.filter((c) => c.stage === 'PAU').length;

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
			pausedCheckIn: pausedCheckInCount,
			skippedAlreadyOpenOrToday,
			skippedGracePeriod,
			totalCandidates: candidates.length,
			poolAvailable: {
				e1: e1YesterdayList.length + e1OlderList.length,
				e2: e2List.length,
				e4: e4List.length,
				e3: e3Pool.length,
				pau: pausedDuePool.length
			}
		},
		candidates
	};
}

/**
 * Construye un CopilotoCandidate individual para un contacto recién dado de alta,
 * reutilizando las mismas reglas de etapa y emparejamiento de sinergias del planificador diario.
 * Retorna `null` si el contacto no es un comprador elegible (p. ej. propietario, agente, inactivo o sin teléfono).
 */
export function buildSingleCopilotoCandidate(
	contact: Contact,
	properties: Property[] = [],
	options: { baseUrl?: string; propHint?: string } = {}
): CopilotoCandidate | null {
	if (!contact?.id) return null;
	if (isProtectedOrNonBuyer(contact)) return null;

	const baseUrl = options.baseUrl || 'https://matchhome.vercel.app';
	const badge = getContactBadgeInfo(contact);
	const stageText = badge.text;

	if (stageText !== 'E1' && stageText !== 'E2' && stageText !== 'E3' && stageText !== 'E4') {
		return null;
	}

	const enrichedContact: Contact =
		options.propHint && !contact.propCont
			? { ...contact, propCont: options.propHint }
			: contact;

	let matchedProperties: CopilotoMatchedPropertySummary[] = [];
	if (stageText === 'E4' && Array.isArray(properties) && properties.length > 0) {
		const matches = matchPropertiesForContact(enrichedContact, properties, {
			synergyOnly: false,
			prioritizeInventory: true,
			excludeAlreadySent: false,
			binnacles: [],
			maxResults: 3
		});
		matchedProperties = matches.map((p) => ({
			id: String(p.id || p.docId || p.public_id || ''),
			public_id: String(p.public_id || ''),
			title: String(p.title || `${p.property_type || 'Propiedad'} en ${p.location || 'Chihuahua'}`),
			price: Number(p.price || 0),
			zona: String((p as any).zona || p.location || ''),
			proposalUrl: p.public_id
				? getProposalUrl(p.public_id, enrichedContact)
				: String((p as any).public_url || (p as any).urlProp || '')
		}));
	}

	const priorityMap: Record<'E1' | 'E2' | 'E3' | 'E4', number> = {
		E1: 1,
		E2: 2,
		E4: 3,
		E3: 4
	};

	return buildCandidateRecord(
		enrichedContact,
		stageText,
		priorityMap[stageText],
		false,
		matchedProperties,
		baseUrl,
		stageText === 'E1'
			? { isE1Over10Days: false }
			: stageText === 'E2'
				? { e2Step: 'followup_call' }
				: undefined
	);
}
