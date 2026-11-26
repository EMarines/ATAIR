import type { Binnacle } from '$lib/types';
import {
	evaluateColdReactivationState,
	type CopilotoCandidate,
	type CopilotoColdStep,
	type CopilotoStage
} from './copilotoPlanner';
import { getContactCreatedAtMs } from './contactBadge';

export type CopilotoExecutionType = 'call' | 'whatsapp' | 'e3_form';
export type CopilotoSuggestedStage = 'NONE' | 'E2' | 'E3' | 'E4';

export interface BinnacleSummary {
	totalEntries: number;
	recentTimeline: string[];
	callsWithoutReply: number;
	propertySendsWithoutReply: number;
	lastInboundMs: number | null;
	lastOutboundMs: number | null;
	hoursSinceLastTouch: number | null;
	daysSinceLastTouch: number | null;
	isColdOver180Days: boolean;
	coldStep?: CopilotoColdStep;
	repliedToStep1: boolean;
	shouldSuggestE3Drop: boolean;
}

export interface CopilotoAnalyzedCard {
	contactId: string;
	fullName: string;
	telephon: string;
	stage: CopilotoStage;
	priority: number;
	taskTitle: string;
	action: string;
	objective: string;
	why: string;
	recommendedExecution: CopilotoExecutionType;
	whatsappDraft: string;
	suggestedStageChange: CopilotoSuggestedStage;
	propertyIds: string[];
	propertyLinks: string[];
	e3FormUrl: string;
	callsWithoutReply: number;
	propertySendsWithoutReply: number;
	usedFallback: boolean;
	isE1Over10Days?: boolean;
	e1Step?: 'send_options' | 'followup_call';
	isColdOver180Days?: boolean;
	coldStep?: CopilotoColdStep;
	repliedToStep1?: boolean;
	daysSinceLastTouch?: number | null;
}

const GEMINI_RESPONSE_SCHEMA = {
	type: 'OBJECT',
	required: [
		'taskTitle',
		'action',
		'objective',
		'why',
		'recommendedExecution',
		'whatsappDraft',
		'suggestedStageChange'
	],
	properties: {
		taskTitle: {
			type: 'STRING',
			description: 'Título breve de 1 línea para la fila de la Agenda (máx 75 caracteres).'
		},
		action: {
			type: 'STRING',
			description: 'Acción concreta que debe ejecutar el asesor hoy.'
		},
		objective: {
			type: 'STRING',
			description: 'Objetivo comercial estratégico detrás de la acción.'
		},
		why: {
			type: 'STRING',
			description: 'Explicación clara del porqué basada en la etapa y la bitácora.'
		},
		recommendedExecution: {
			type: 'STRING',
			enum: ['call', 'whatsapp', 'e3_form'],
			description: 'Canal principal recomendado para ejecutar hoy.'
		},
		whatsappDraft: {
			type: 'STRING',
			description: 'Borrador natural y amable de WhatsApp listo para enviar, incluyendo los links proporcionados.'
		},
		suggestedStageChange: {
			type: 'STRING',
			enum: ['NONE', 'E2', 'E3', 'E4'],
			description: 'Sugerir E3 si es E1/E2 con >=2 llamadas y >=2 envíos sin respuesta; si no, NONE.'
		}
	}
};

function parseBinnacleMs(entry: Binnacle): number {
	const raw = entry as any;
	return getContactCreatedAtMs(raw.date ?? raw.createdAt) ?? 0;
}

function isInboundEntry(entry: Binnacle): boolean {
	const act = String(entry.action || '').toLowerCase();
	return act.includes('whatsapp recibido') || act.includes('respuesta') || act.includes('inbound');
}

function isCallEntry(entry: Binnacle): boolean {
	const raw = entry as any;
	const act = String(entry.action || '').toLowerCase();
	const com = String(entry.comment || raw.content || '').toLowerCase();
	return act.includes('llamada') || act.includes('call') || com.includes('llamada');
}

function isPropertySendEntry(entry: Binnacle): boolean {
	const act = String(entry.action || '').toLowerCase();
	return (
		act.includes('propiedad enviada') ||
		act.includes('propuesta enviada') ||
		act.includes('enviada por whatsapp')
	);
}

export function summarizeContactBinnacles(
	binnacles: Binnacle[],
	candidate: CopilotoCandidate,
	nowMs: number = Date.now()
): BinnacleSummary {
	const sorted = [...(binnacles || [])].sort((a, b) => parseBinnacleMs(b) - parseBinnacleMs(a));

	let lastInboundMs: number | null = candidate.lastResponseMs ?? null;
	let lastOutboundMs: number | null = candidate.lastContactMs ?? null;

	for (const item of sorted) {
		const ms = parseBinnacleMs(item);
		if (!ms) continue;
		if (isInboundEntry(item)) {
			if (!lastInboundMs || ms > lastInboundMs) lastInboundMs = ms;
		} else {
			if (!lastOutboundMs || ms > lastOutboundMs) lastOutboundMs = ms;
		}
	}

	const sinceMs = lastInboundMs ?? 0;
	let callsWithoutReply = 0;
	let propertySendsWithoutReply = 0;

	for (const item of sorted) {
		const ms = parseBinnacleMs(item);
		if (sinceMs > 0 && ms > 0 && ms <= sinceMs) continue;
		if (isInboundEntry(item)) continue;
		if (isCallEntry(item)) callsWithoutReply++;
		if (isPropertySendEntry(item)) propertySendsWithoutReply++;
	}

	const latestTouchMs = Math.max(lastInboundMs ?? 0, lastOutboundMs ?? 0, candidate.createdAtMs ?? 0);
	const hoursSinceLastTouch =
		latestTouchMs > 0 ? Math.max(0, Math.round((nowMs - latestTouchMs) / 3600_000)) : null;
	const daysSinceLastTouch =
		latestTouchMs > 0 ? Math.max(0, Math.floor((nowMs - latestTouchMs) / 86_400_000)) : null;

	// Evaluar estado de reactivación >180d con el historial completo de bitácoras del contacto
	const isColdEligibleStage =
		candidate.stage === 'E1' || candidate.stage === 'E2' || candidate.stage === 'E3';
	const coldState = isColdEligibleStage
		? evaluateColdReactivationState(
				{
					id: candidate.contactId,
					createdAtMs: candidate.createdAtMs,
					lastContactMs: candidate.lastContactMs,
					lastResponseMs: candidate.lastResponseMs
				},
				sorted,
				[],
				nowMs
			)
		: null;

	let isColdOver180Days = Boolean(coldState?.isColdOver180Days && coldState?.coldStep);
	let coldStep: CopilotoColdStep | undefined = coldState?.coldStep;
	let repliedToStep1 = Boolean(coldState?.repliedToStep1);

	// Respaldar si el planner detectó Paso 2 mediante todo completado aunque no estuviera en bitácoras
	if (isColdEligibleStage && coldState?.lastStep1Ms === null && candidate.coldStep === 'step2_send_link') {
		isColdOver180Days = true;
		coldStep = 'step2_send_link';
		repliedToStep1 = Boolean(candidate.repliedToStep1);
	}

	const completedColdStep2 =
		Boolean(coldState?.lastStep2Ms) &&
		(!lastInboundMs || lastInboundMs <= (coldState?.lastStep2Ms ?? 0));

	const recentTimeline = sorted.slice(0, 15).map((item) => {
		const raw = item as any;
		const ms = parseBinnacleMs(item);
		const dateStr = ms ? new Date(ms).toISOString().slice(0, 10) : 'sin-fecha';
		const act = String(item.action || raw.type || 'Nota').trim();
		const com = String(item.comment || raw.content || '').replace(/\s+/g, ' ').trim().slice(0, 140);
		return `[${dateStr}] ${act}${com ? `: ${com}` : ''}`;
	});

	const shouldSuggestE3Drop =
		(candidate.stage === 'E1' || candidate.stage === 'E2') &&
		coldStep !== 'step1_check' &&
		!repliedToStep1 &&
		((callsWithoutReply >= 2 && propertySendsWithoutReply >= 2) ||
			propertySendsWithoutReply >= 5 ||
			completedColdStep2);

	return {
		totalEntries: sorted.length,
		recentTimeline,
		callsWithoutReply,
		propertySendsWithoutReply,
		lastInboundMs,
		lastOutboundMs,
		hoursSinceLastTouch,
		daysSinceLastTouch,
		isColdOver180Days,
		coldStep,
		repliedToStep1,
		shouldSuggestE3Drop
	};
}

function getEffectiveBuscarUrl(candidate: CopilotoCandidate): string {
	if (candidate.e3FormUrl) return candidate.e3FormUrl;
	if (!candidate.contactId) return '';
	return `https://matchhome.vercel.app/buscar?c=${encodeURIComponent(candidate.contactId)}`;
}

function ensureRequiredLinksInDraft(
	draft: string,
	candidate: CopilotoCandidate,
	summary?: BinnacleSummary
): string {
	let text = String(draft || '').trim();
	const effectiveBuscarUrl = getEffectiveBuscarUrl(candidate);

	// En Paso 1 (>180d) NO debe enviarse link todavía (se reserva para Paso 2 o si contesta "sí")
	if (summary?.isColdOver180Days && summary?.coldStep === 'step1_check') {
		if (effectiveBuscarUrl && text.includes(effectiveBuscarUrl)) {
			text = text.replaceAll(effectiveBuscarUrl, '').replace(/\n{3,}/g, '\n\n').trim();
		}
		return text;
	}

	// En Paso 2 (>180d) SIEMPRE debe incluirse el link literal /buscar?c=...
	if (summary?.isColdOver180Days && summary?.coldStep === 'step2_send_link' && effectiveBuscarUrl) {
		if (!text.includes(effectiveBuscarUrl)) {
			text = `${text}\n\n${effectiveBuscarUrl}`.trim();
		}
		return text;
	}

	if (
		(candidate.stage === 'E4' || (candidate.stage === 'E1' && candidate.e1Step === 'send_options')) &&
		candidate.matchedProperties.length > 0
	) {
		const missingLinks = candidate.matchedProperties
			.map((p) => p.proposalUrl)
			.filter((url) => url && !text.includes(url));
		if (missingLinks.length > 0) {
			text = `${text}\n\n${missingLinks.join('\n')}`.trim();
		}
	} else if (candidate.stage === 'E3' && effectiveBuscarUrl) {
		if (!text.includes(effectiveBuscarUrl)) {
			text = `${text}\n\n${effectiveBuscarUrl}`.trim();
		}
	}
	return text;
}

export function buildFallbackCopilotoCard(
	candidate: CopilotoCandidate,
	summary: BinnacleSummary
): CopilotoAnalyzedCard {
	const firstName = candidate.name?.trim() || 'Hola';
	const propertyIds = candidate.matchedProperties.map((p) => p.public_id).filter(Boolean);
	const propertyLinks = candidate.matchedProperties.map((p) => p.proposalUrl).filter(Boolean);
	const e3FormUrl =
		summary.isColdOver180Days || candidate.stage === 'E3'
			? getEffectiveBuscarUrl(candidate)
			: candidate.e3FormUrl || '';
	const suggestedStageChange: CopilotoSuggestedStage = summary.shouldSuggestE3Drop ? 'E3' : 'NONE';

	// Estrategia unificada >180 días para E1, E2 y E3 (2 pasos: Paso 1 sin link -> espera 2 días -> Paso 2 con link)
	if (
		summary.isColdOver180Days &&
		(candidate.stage === 'E1' || candidate.stage === 'E2' || candidate.stage === 'E3')
	) {
		const daysLabel =
			summary.daysSinceLastTouch !== null
				? `hace ${summary.daysSinceLastTouch} días`
				: 'hace más de 180 días';

		if (summary.coldStep === 'step2_send_link') {
			if (summary.repliedToStep1) {
				return {
					contactId: candidate.contactId,
					fullName: candidate.fullName,
					telephon: candidate.telephon,
					stage: candidate.stage,
					priority: candidate.priority,
					taskTitle: `🔥 ${candidate.stage} · Respondió Paso 1: Enviar link a ${candidate.fullName}`.slice(0, 75),
					action: `¡Reaccionar rápido! ${candidate.fullName} respondió al Paso 1; enviarle ahora el link de nuestra herramienta de búsqueda para promoverlo a E4.`,
					objective:
						'Aprovechar su interés inmediato para que capture en 30 seg qué busca y suba automáticamente a Etapa 4 (E4).',
					why: `El prospecto en ${candidate.stage} contestó tras el Paso 1 de reactivación (>180 días). Conviene enviarle el link de inmediato.`,
					recommendedExecution: 'whatsapp',
					whatsappDraft: `Hola ${firstName}, ¡qué gusto saludarte! Te envío el link para que nos digas qué características tiene la casa de tus sueños y poder buscártela:\n\n${e3FormUrl}`,
					suggestedStageChange: 'NONE',
					propertyIds: [],
					propertyLinks: [],
					e3FormUrl,
					callsWithoutReply: summary.callsWithoutReply,
					propertySendsWithoutReply: summary.propertySendsWithoutReply,
					usedFallback: true,
					isColdOver180Days: true,
					coldStep: 'step2_send_link',
					repliedToStep1: true,
					daysSinceLastTouch: summary.daysSinceLastTouch
				};
			}

			return {
				contactId: candidate.contactId,
				fullName: candidate.fullName,
				telephon: candidate.telephon,
				stage: candidate.stage,
				priority: candidate.priority,
				taskTitle: `🔗 ${candidate.stage} (>180d) · Paso 2: Enviar link a ${candidate.fullName}`.slice(0, 75),
				action: `Enviar segundo toque (Paso 2) a ${candidate.fullName} con el link de la herramienta de búsqueda rápida.`,
				objective:
					'Segunda oportunidad tras 2 días sin respuesta: si llena el link sube automático a E4; si tampoco responde, depurar a E3/inactivo.',
				why: `Lead en ${candidate.stage} (>180d): pasaron 2 o más días sin respuesta al Paso 1. Se envía el Paso 2 con el link directo.`,
				recommendedExecution: 'whatsapp',
				whatsappDraft: `Hola ${firstName}, te envío el link para que nos digas qué características tiene la casa de tus sueños y poder buscártela:\n\n${e3FormUrl}`,
				suggestedStageChange,
				propertyIds: [],
				propertyLinks: [],
				e3FormUrl,
				callsWithoutReply: summary.callsWithoutReply,
				propertySendsWithoutReply: summary.propertySendsWithoutReply,
				usedFallback: true,
				isColdOver180Days: true,
				coldStep: 'step2_send_link',
				repliedToStep1: false,
				daysSinceLastTouch: summary.daysSinceLastTouch
			};
		}

		// Paso 1 (sin link, esperando respuesta "¿Te interesa?")
		return {
			contactId: candidate.contactId,
			fullName: candidate.fullName,
			telephon: candidate.telephon,
			stage: candidate.stage,
			priority: candidate.priority,
			taskTitle: `❄️ ${candidate.stage} (>180d) · Paso 1: Confirmar si busca casa — ${candidate.fullName}`.slice(0, 75),
			action: `Preguntar a ${candidate.fullName} si sigue buscando casa y si le interesa nuestra nueva herramienta rápida (Paso 1, sin link).`,
			objective:
				'Tener dos oportunidades: abrir conversación sin presión. Si dice "sí", mandarle rápido el link para subirlo a E4; si no contesta, en 2 días se envía el Paso 2 con el link.',
			why: `Lead en ${candidate.stage} con último contacto ${daysLabel} (${summary.totalEntries} registros en bitácora). Por regla >180 días se aplica reactivación en 2 pasos (Paso 1 sin link; Paso 2 con link a los 2 días).`,
			recommendedExecution: 'whatsapp',
			whatsappDraft: `Hola ${firstName}, hace tiempo que no platicamos y quería saber si sigues buscando casa o si ya lograste resolver. Si sigues en búsqueda, estrenamos una herramienta rápida (30 seg) donde nos indicas qué necesitas y te enviamos solo opciones nuevas que sí encajen contigo, sin llenarte de mensajes. ¿Te interesa?`,
			suggestedStageChange: 'NONE',
			propertyIds: [],
			propertyLinks: [],
			e3FormUrl,
			callsWithoutReply: summary.callsWithoutReply,
			propertySendsWithoutReply: summary.propertySendsWithoutReply,
			usedFallback: true,
			isColdOver180Days: true,
			coldStep: 'step1_check',
			repliedToStep1: false,
			daysSinceLastTouch: summary.daysSinceLastTouch
		};
	}

	if (candidate.stage === 'E1') {
		const propHint = candidate.propCont ? ` por ${candidate.propCont}` : '';

		if (candidate.isE1Over10Days) {
			if (candidate.e1Step === 'send_options') {
				const linksBlock = propertyLinks.join('\n');
				const optionsCount = candidate.matchedProperties.length;
				return {
					contactId: candidate.contactId,
					fullName: candidate.fullName,
					telephon: candidate.telephon,
					stage: candidate.stage,
					priority: candidate.priority,
					taskTitle: `📲 E1 (>10d) · Enviar opciones en rango a ${candidate.fullName}`.slice(0, 75),
					action: `Enviar por WhatsApp ${optionsCount} opciones en el rango de precio de su propiedad consultada (${candidate.propCont || 'interés'}) a ${candidate.fullName}.`,
					objective:
						'Reactivar el lead con alternativas atractivas en su presupuesto antes de realizar la llamada telefónica.',
					why: `Lead en E1 con más de 10 días desde el primer contacto. Se envían opciones hoy para calentar la relación y llamarle mañana.`,
					recommendedExecution: 'whatsapp',
					whatsappDraft: `Hola ${firstName}, espero que estés muy bien. Te escribo para dar seguimiento a tu interés en ${candidate.propCont || 'nuestra propiedad'}. Seleccioné estas ${optionsCount} opciones similares en ese mismo rango de precio que te pueden interesar:\n\n${linksBlock}\n\n¿Cuál te llama más la atención para agendar una visita?`,
					suggestedStageChange,
					propertyIds,
					propertyLinks,
					e3FormUrl,
					callsWithoutReply: summary.callsWithoutReply,
					propertySendsWithoutReply: summary.propertySendsWithoutReply,
					usedFallback: true,
					isE1Over10Days: true,
					e1Step: 'send_options'
				};
			}

			// e1Step === 'followup_call'
			return {
				contactId: candidate.contactId,
				fullName: candidate.fullName,
				telephon: candidate.telephon,
				stage: candidate.stage,
				priority: candidate.priority,
				taskTitle: `📞 E1 (>10d) · Llamada de seguimiento a ${candidate.fullName}`.slice(0, 75),
				action: `Realizar llamada telefónica de seguimiento tras el envío de opciones en rango de precio.`,
				objective:
					'Conocer sus impresiones sobre las opciones enviadas ayer, resolver dudas y avanzar hacia cita o afinar requerimientos.',
				why: `Lead en E1 (>10d): recientemente se le enviaron opciones afines en su presupuesto; corresponde la llamada de seguimiento.`,
				recommendedExecution: 'call',
				whatsappDraft: `Hola ${firstName}, soy Enrique de Match Home. Te llamé hace un momento para platicar sobre las opciones que te envié y saber qué te parecieron. ¿A qué hora te queda mejor que te marque?`,
				suggestedStageChange,
				propertyIds: [],
				propertyLinks: [],
				e3FormUrl,
				callsWithoutReply: summary.callsWithoutReply,
				propertySendsWithoutReply: summary.propertySendsWithoutReply,
				usedFallback: true,
				isE1Over10Days: true,
				e1Step: 'followup_call'
			};
		}

		// Fresh E1 (<10 días)
		return {
			contactId: candidate.contactId,
			fullName: candidate.fullName,
			telephon: candidate.telephon,
			stage: candidate.stage,
			priority: candidate.priority,
			taskTitle: `📞 E1 · Llamar a ${candidate.fullName}${propHint}`.slice(0, 75),
			action: `Realizar contacto telefónico con ${candidate.fullName}${propHint}.`,
			objective:
				'Si le interesó la propiedad, avanzar hacia cita/venta; si no, hacer empatía y sacar más información de lo que busca sin presionar.',
			why: summary.shouldSuggestE3Drop
				? `En E1 acumula ${summary.callsWithoutReply} llamadas y ${summary.propertySendsWithoutReply} envíos sin respuesta; conviene intentar último contacto o confirmar pase a E3.`
				: `Lead en E1 (prioridad máxima). ${summary.hoursSinceLastTouch !== null ? `Último movimiento hace ~${summary.hoursSinceLastTouch}h.` : 'Requiere atención inmediata para salir rápido de E1.'}`,
			recommendedExecution: 'call',
			whatsappDraft: `Hola ${firstName}, soy Enrique de Match Home. Te marqué hace un momento para ver qué te pareció la opción${propHint} y conocer un poco mejor qué estás buscando para mandarte justo lo que te sirva.`,
			suggestedStageChange,
			propertyIds,
			propertyLinks,
			e3FormUrl,
			callsWithoutReply: summary.callsWithoutReply,
			propertySendsWithoutReply: summary.propertySendsWithoutReply,
			usedFallback: true,
			isE1Over10Days: false
		};
	}

	if (candidate.stage === 'E2') {
		return {
			contactId: candidate.contactId,
			fullName: candidate.fullName,
			telephon: candidate.telephon,
			stage: candidate.stage,
			priority: candidate.priority,
			taskTitle: `📞 E2 · Completar perfil de ${candidate.fullName}`.slice(0, 75),
			action: `Contactar a ${candidate.fullName} para completar sus criterios de búsqueda y promover a E4.`,
			objective:
				'Recabar presupuesto, zona y características clave para activar el envío diario de sinergias (E4).',
			why: summary.shouldSuggestE3Drop
				? `En E2 suma ${summary.callsWithoutReply} llamadas y ${summary.propertySendsWithoutReply} propiedades enviadas sin respuesta; candidato a pasar a E3.`
				: `Sigue en E2 (${summary.totalEntries} registros en bitácora). Falta cerrar su perfil para pasarlo a E4 o descartar a E3.`,
			recommendedExecution: 'call',
			whatsappDraft: `Hola ${firstName}, ¿cómo vas con tu búsqueda? Me gustaría confirmar zona, presupuesto aproximado y recámaras para filtrarte solo opciones nuevas que sí te encajen.`,
			suggestedStageChange,
			propertyIds,
			propertyLinks,
			e3FormUrl,
			callsWithoutReply: summary.callsWithoutReply,
			propertySendsWithoutReply: summary.propertySendsWithoutReply,
			usedFallback: true
		};
	}

	if (candidate.stage === 'E4') {
		const count = candidate.matchedProperties.length;
		const titles = candidate.matchedProperties.map((p) => p.title).slice(0, 3).join(', ');
		const linksBlock = propertyLinks.join('\n');
		return {
			contactId: candidate.contactId,
			fullName: candidate.fullName,
			telephon: candidate.telephon,
			stage: candidate.stage,
			priority: candidate.priority,
			taskTitle: `🏠 E4 · Enviar ${count} ${count === 1 ? 'sinergia' : 'sinergias'} a ${candidate.fullName}`.slice(0, 75),
			action: `Enviar por WhatsApp ${count} ${count === 1 ? 'propiedad nueva' : 'propiedades nuevas'} de sinergia (${titles}).`,
			objective: 'Mantener nutrido al cliente calificado con opciones compatibles aún no enviadas y provocar cita.',
			why: `Lead calificado en E4 con ${count} ${count === 1 ? 'propiedad compatible nueva' : 'propiedades compatibles nuevas'} fuera de su historial enviado.`,
			recommendedExecution: 'whatsapp',
			whatsappDraft: `Hola ${firstName}, te comparto ${count === 1 ? 'esta opción nueva que acaba de entrar y cumple' : `estas ${count} opciones nuevas que cumplen`} con lo que buscas:\n\n${linksBlock}\n\n¿Cuál te gustaría que agendemos para visitar?`,
			suggestedStageChange: 'NONE',
			propertyIds,
			propertyLinks,
			e3FormUrl,
			callsWithoutReply: summary.callsWithoutReply,
			propertySendsWithoutReply: summary.propertySendsWithoutReply,
			usedFallback: true
		};
	}

	// E3
	return {
		contactId: candidate.contactId,
		fullName: candidate.fullName,
		telephon: candidate.telephon,
		stage: 'E3',
		priority: candidate.priority,
		taskTitle: `📝 E3 · Enviar filtro a ${candidate.fullName}`.slice(0, 75),
		action: `Enviar el formulario rápido de búsqueda a ${candidate.fullName} para confirmar si sigue interesado.`,
		objective:
			'Filtrar si quiere seguir recibiendo propiedades; si llena el formulario sube automático a E4, si no, queda inactivo.',
		why: candidate.isColdOver2y
			? 'Lead de más de 2 años en cola de reactivación E3 (una vez atendidos los menores a 2 años).'
			: 'Lead en etapa E3 dentro de la meta diaria de 15 para depurar y trabajar solo con interesados.',
		recommendedExecution: 'e3_form',
		whatsappDraft: `Hola ${firstName}, para seguir enviándote solo propiedades que realmente te interesen y no molestarte con opciones que no buscas, ¿nos ayudas llenando este formulario rápido (30 seg)?\n\n${e3FormUrl}`,
		suggestedStageChange: 'NONE',
		propertyIds,
		propertyLinks,
		e3FormUrl,
		callsWithoutReply: summary.callsWithoutReply,
		propertySendsWithoutReply: summary.propertySendsWithoutReply,
		usedFallback: true
	};
}

export function buildCopilotoPrompt(
	candidate: CopilotoCandidate,
	summary: BinnacleSummary
): string {
	const stageRules: Record<CopilotoStage, string> = {
		E1: candidate.isE1Over10Days
			? candidate.e1Step === 'send_options'
				? 'Etapa E1 (>10 días - Paso 1: Enviar opciones): el lead tiene más de 10 días desde su contacto inicial. Hoy corresponde enviarle por WhatsApp 2 a 3 opciones afines en el rango de precio (±25%) de la propiedad consultada con sus links exactos para calentar la relación antes de la llamada de mañana.'
				: 'Etapa E1 (>10 días - Paso 2: Llamada de seguimiento): ayer o recientemente se le enviaron opciones afines; hoy corresponde llamarle para conocer sus comentarios sobre las opciones y avanzar hacia cita o perfilar mejor.'
			: 'Etapa E1 (Primer Contacto reciente <10 días, prioridad máxima): el objetivo es concretar llamada rápida y sacar más info de lo que busca sin presionar (la cita no es obligatoria; si le gustó la propiedad original buscar venta/cita, si no, empatía y perfilar).',
		E2: 'Etapa E2 (Seguimiento Diario): el objetivo es completar los datos requeridos de búsqueda para promoverlo a E4. Si acumula >=2 llamadas y >=2-3 envíos sin respuesta, sugiere pasar a E3.',
		E4: 'Etapa E4 (Búsqueda Activa Calificada): enviar las propiedades de sinergia nuevas compatibles proporcionadas (máx 3) con sus links exactos y provocar cita.',
		E3: 'Etapa E3 (Filtro / Reactivación): enviar el link exacto del formulario ligero explicando amablemente que si desea seguir recibiendo propiedades nos llene qué busca.'
	};

	const effectiveStageRule =
		summary.isColdOver180Days &&
		(candidate.stage === 'E1' || candidate.stage === 'E2' || candidate.stage === 'E3')
			? summary.coldStep === 'step2_send_link'
				? summary.repliedToStep1
					? `REGLA PRIORITARIA >180 DÍAS - PASO 2 (EL LEAD RESPONDIÓ AL PASO 1): el prospecto acaba de responder al primer mensaje de reactivación. Hoy debes reaccionar rápido por WhatsApp enviándole el link literal de la herramienta de búsqueda para que indique qué características tiene la casa de sus sueños y poder buscársela (sube automático a E4). Canal: whatsapp.`
					: `REGLA UNIFICADA >180 DÍAS (E1/E2/E3) - PASO 2 (TRAS 2 DÍAS SIN RESPUESTA): pasaron 2 o más días desde el Paso 1 sin respuesta. Hoy corresponde el segundo mensaje por WhatsApp enviándole el link literal de la herramienta de búsqueda con un tono breve y amable como: "Hola [Nombre], te envío el link para que nos digas qué características tiene la casa de tus sueños y poder buscártela" seguido del link exacto. Canal: whatsapp.`
				: `REGLA UNIFICADA >180 DÍAS (E1/E2/E3) - PASO 1 (SIN LINK): el último contacto con este lead fue hace más de 180 días. NO asumas que sigue buscando activamente ni le pidas presupuesto/recámaras todavía, y NO incluyas ningún link en el mensaje. Redacta un WhatsApp natural siguiendo fielmente esta estructura: saludar diciendo que hace tiempo no platican, preguntar si sigue buscando casa o si ya logró resolver, comentar que si sigue en búsqueda estrenamos una herramienta rápida (30 seg) donde indica qué necesita y le enviamos solo opciones nuevas que sí encajen con él sin llenarlo de mensajes, y cerrar preguntando "¿Te interesa?". Canal: whatsapp. suggestedStageChange debe ser "NONE".`
			: stageRules[candidate.stage];

	const effectiveBuscarUrl =
		summary.isColdOver180Days || candidate.stage === 'E3'
			? getEffectiveBuscarUrl(candidate)
			: candidate.e3FormUrl || '';

	const propsText =
		candidate.matchedProperties.length > 0
			? candidate.matchedProperties
					.map(
						(p, idx) =>
							`${idx + 1}. [${p.public_id}] ${p.title} | $${p.price.toLocaleString('es-MX')} | Zona: ${p.zona || 'Chihuahua'} | Link: ${p.proposalUrl}`
					)
					.join('\n')
			: 'Ninguna';

	return `Eres ATAIR Copiloto, asistente estratégico de ventas inmobiliarias en Chihuahua, México.
Analiza al siguiente lead y su bitácora para generar la tarjeta de la Agenda de hoy.

REGLA DE LA ETAPA:
${effectiveStageRule}

DATOS DEL LEAD:
- Nombre: ${candidate.fullName}
- Etapa actual: ${candidate.stage}${summary.isColdOver180Days ? ` (>180 días sin contacto, paso: ${summary.coldStep}${summary.repliedToStep1 ? ', RESPONDIÓ PASO 1' : ''})` : candidate.isColdOver2y ? ' (antigüedad > 2 años)' : candidate.isE1Over10Days ? ` (>10 días, paso: ${candidate.e1Step})` : ''}
- Propiedad de interés inicial: ${candidate.propCont || 'No especificada'}
- Tipo buscado: ${candidate.selecTP || 'No especificado'} | Presupuesto: ${candidate.budget > 0 ? `$${candidate.budget.toLocaleString('es-MX')}` : candidate.rangeProp || 'No especificado'}
- Zonas: ${candidate.locaProperty.join(', ') || 'No especificadas'}
- Notas ficha: ${candidate.notes || 'Sin notas'}

MÉTRICAS DE BITÁCORA DESDE ÚLTIMA RESPUESTA:
- Llamadas sin respuesta: ${summary.callsWithoutReply}
- Envíos de propiedades sin respuesta: ${summary.propertySendsWithoutReply}
- Días desde último toque: ${summary.daysSinceLastTouch ?? 'Sin registro'} (${summary.hoursSinceLastTouch ?? 'Sin registro'}h)
- ¿Cumple criterio de caída a E3?: ${summary.shouldSuggestE3Drop ? 'SÍ' : 'NO'}

ÚLTIMOS REGISTROS DE BITÁCORA (más reciente primero):
${summary.recentTimeline.length > 0 ? summary.recentTimeline.join('\n') : 'Sin registros previos en bitácora.'}

PROPIEDADES COMPATIBLES / RECOMENDADAS (para E4 o E1 >10d):
${propsText}

LINK HERRAMIENTA DE BÚSQUEDA (/buscar):
${summary.coldStep === 'step1_check' ? 'NO INCLUIR EN PASO 1 (reservar para Paso 2 o respuesta positiva)' : effectiveBuscarUrl || 'N/A'}

INSTRUCCIONES DE SALIDA:
- Sé concreto, natural y directo (español de México).
- En whatsappDraft: tono cercano, profesional, sin hashtags; si el paso es Paso 1 (>180d) NO incluyas ningún URL ni link; si hay links requeridos (PROPIEDADES o LINK HERRAMIENTA DE BÚSQUEDA en Paso 2 / E3), inclúyelos literalmente sin modificarlos.
- Si etapa es E1 o E2 y "¿Cumple criterio de caída a E3?" es SÍ (y NO es Paso 1 >180d), pon suggestedStageChange="E3" y explícalo en "why".`;
}

export async function analyzeCandidateWithGemini(
	candidate: CopilotoCandidate,
	binnacles: Binnacle[],
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<CopilotoAnalyzedCard> {
	const summary = summarizeContactBinnacles(binnacles, candidate);
	const fallback = buildFallbackCopilotoCard(candidate, summary);

	if (!apiKey) {
		return fallback;
	}

	const prompt = buildCopilotoPrompt(candidate, summary);
	const modelConfigs = [
		{ name: 'gemini-3.1-flash-lite', thinkingZero: true },
		{ name: 'gemini-3-flash-preview', thinkingZero: true },
		{ name: 'gemini-2.5-flash', thinkingZero: true }
	];

	for (const model of modelConfigs) {
		try {
			const genConfig: Record<string, any> = {
				temperature: 0.35,
				maxOutputTokens: 700,
				responseMimeType: 'application/json',
				responseSchema: GEMINI_RESPONSE_SCHEMA
			};
			if (model.thinkingZero) {
				genConfig.thinkingConfig = { thinkingBudget: 0 };
			}

			const response = await fetchFn(
				`https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [{ parts: [{ text: prompt }] }],
						generationConfig: genConfig
					}),
					signal: AbortSignal.timeout(10000)
				}
			);

			if (!response.ok) continue;

			const data = await response.json();
			const rawText = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.text)?.text || '';
			if (!rawText) continue;

			const parsed = JSON.parse(rawText);
			const execType: CopilotoExecutionType =
				parsed.recommendedExecution === 'call' ||
				parsed.recommendedExecution === 'whatsapp' ||
				parsed.recommendedExecution === 'e3_form'
					? parsed.recommendedExecution
					: fallback.recommendedExecution;

			const suggestedStage: CopilotoSuggestedStage =
				parsed.suggestedStageChange === 'E2' ||
				parsed.suggestedStageChange === 'E3' ||
				parsed.suggestedStageChange === 'E4' ||
				parsed.suggestedStageChange === 'NONE'
					? parsed.suggestedStageChange
					: fallback.suggestedStageChange;

			return {
				...fallback,
				taskTitle: String(parsed.taskTitle || fallback.taskTitle).trim().slice(0, 85),
				action: String(parsed.action || fallback.action).trim(),
				objective: String(parsed.objective || fallback.objective).trim(),
				why: String(parsed.why || fallback.why).trim(),
				recommendedExecution: execType,
				whatsappDraft: ensureRequiredLinksInDraft(
					parsed.whatsappDraft || fallback.whatsappDraft,
					candidate,
					summary
				),
				suggestedStageChange: summary.coldStep === 'step1_check' ? 'NONE' : suggestedStage,
				usedFallback: false
			};
		} catch {
			// Intentar siguiente modelo o fallback determinístico
		}
	}

	return fallback;
}
