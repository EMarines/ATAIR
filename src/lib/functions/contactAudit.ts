import type { Contact } from '$lib/types';
import {
	getContactBadgeInfo,
	getContactCreatedAtMs,
	isStage4ForBroadcast,
	isWithinMaxAgeYears,
	normalizeStage,
	type ContactBadgeInfo
} from './contactBadge';

export type AuditBucketKey =
	| 'active_e4_eligible'
	| 'active_calls_recent'
	| 'cold_over_2y_buyers'
	| 'protected_non_buyer'
	| 'missing_created_at'
	| 'inactive';

export type AgeStatus = 'within_2y' | 'over_2y' | 'missing';

export type ProtectedRole =
	| 'agent'
	| 'seller_or_landlord'
	| 'tenant'
	| 'closed_or_post_sale';

export type ColdSubFilter =
	| 'all'
	| 'to_move_e3'
	| 'already_e3'
	| 'recent_activity_1y'
	| 'no_recent_activity';

export type ProtectedSubFilter =
	| 'all'
	| 'over_2y_only'
	| 'sellers_landlords'
	| 'agents'
	| 'tenants'
	| 'e5_e6';

export interface AuditedContact {
	contact: Contact;
	badge: ContactBadgeInfo;
	bucket: AuditBucketKey;
	ageStatus: AgeStatus;
	createdMs: number | null;
	lastActivityMs: number | null;
	hasRecentActivity1y: boolean;
	hasValidPhone: boolean;
	isE4BroadcastEligible: boolean;
	protectedRole: ProtectedRole | null;
	normalizedStage: number | string;
}

export interface ContactsPortfolioAudit {
	total: number;
	generatedAt: number;
	items: AuditedContact[];
	counts: Record<AuditBucketKey, number>;
	e4Breakdown: {
		totalRecentE4: number;
		validPhoneReadyForWa: number;
		missingOrShortPhone: number;
	};
	recentCallsBreakdown: {
		total: number;
		e1: number;
		e2: number;
		e3: number;
		na: number;
	};
	coldOver2yBreakdown: {
		total: number;
		toMoveToE3: number;
		alreadyE3: number;
		e1: number;
		e2: number;
		e4: number;
		na: number;
		withRecentActivity1y: number;
		noRecentActivity: number;
	};
	protectedBreakdown: {
		total: number;
		over2yCount: number;
		sellersAndLandlords: number;
		agents: number;
		tenants: number;
		closedOrPostSale: number;
		missingDateCount: number;
	};
	missingDateBreakdown: {
		total: number;
		inE4: number;
		inE1E2E3: number;
		inOther: number;
	};
}

const RAW_TYPE_ALIASES: Record<string, string> = {
	Cliente: 'Comprador',
	Venta: 'Comprador',
	Propietario: 'Vendedor',
	Inmobiliaria: 'Agente Inmobiliario',
	Colaborador: 'Agente Inmobiliario',
	Renta: 'Arrendatario'
};

export const AUDIT_BUCKET_LABELS: Record<AuditBucketKey, string> = {
	active_e4_eligible: 'Cajón 1A · E4 ≤ 2 años (WA)',
	active_calls_recent: 'Cajón 1B · Llamadas ≤ 2 años',
	cold_over_2y_buyers: 'Cajón 2 · Fríos +2 años (Lote E3)',
	protected_non_buyer: 'Intocables (No compradores / E5-E6)',
	missing_created_at: 'Sin createdAt en Firestore',
	inactive: 'Ya inactivos (isActive=false)'
};

/**
 * Normaliza un documento crudo de Firestore preservando `createdAt` tal como viene
 * almacenado (sin sustituir faltantes con `Date.now()`).
 */
export function normalizeRawContactForAudit(
	id: string,
	data: Record<string, any>
): Contact {
	const rawType = String(data.typeContact || data.contactType || data.tipo || '');
	const cleanType = RAW_TYPE_ALIASES[rawType] ?? rawType;

	return {
		...data,
		id,
		// Preservar raw createdAt sin fallback Date.now() para detectar registros históricos sin fecha.
		createdAt: (data.createdAt ?? null) as any,
		name: data.name || '',
		lastname: data.lastname || '',
		email: data.email || '',
		telephon: data.telephon || '',
		selecMC: data.selecMC || '',
		comContact: data.comContact || '',
		contactStage: data.contactStage ?? '',
		isActive: data.isActive !== undefined ? data.isActive : true,
		budget: data.budget || 0,
		selecTP: data.selecTP || '',
		rangeProp: data.rangeProp || '',
		numBaths: data.numBaths || 0,
		numBeds: data.numBeds || 0,
		numParks: data.numParks || 0,
		halfBathroom: data.halfBathroom || '',
		locaProperty: Array.isArray(data.locaProperty) ? data.locaProperty : [],
		tagsProperty: Array.isArray(data.tagsProperty) ? data.tagsProperty : [],
		modePay: data.modePay || '',
		typeContact: cleanType
	};
}

function resolveProtectedRole(
	contact: Contact,
	badge: ContactBadgeInfo,
	stage: number | string
): ProtectedRole | null {
	if (badge.isAgent) return 'agent';

	const raw = contact as any;
	const typeLower = String(contact.typeContact || contact.contactType || raw.tipo || '').toLowerCase();
	if (
		typeLower.includes('vendedor') ||
		typeLower.includes('propietario') ||
		typeLower.includes('arrendador')
	) {
		return 'seller_or_landlord';
	}

	if (
		badge.text.startsWith('A') ||
		typeLower.includes('arrendatario') ||
		typeLower.includes('inquilino')
	) {
		return 'tenant';
	}

	if (stage === 5 || stage === 6) {
		return 'closed_or_post_sale';
	}

	return null;
}

function resolveLastActivityMs(contact: Contact): number | null {
	const lastContactMs = getContactCreatedAtMs((contact as any).lastContact) ?? 0;
	const lastResponseMs = getContactCreatedAtMs((contact as any).lastResponse) ?? 0;
	const latest = Math.max(lastContactMs, lastResponseMs);
	return latest > 0 ? latest : null;
}

/**
 * Clasifica un contacto en exactamente uno de los 6 cajones excluyentes de auditoría.
 */
export function classifyContactForAudit(
	contact: Contact,
	nowMs: number = Date.now()
): AuditedContact {
	const badge = getContactBadgeInfo(contact);
	const normalizedStage = normalizeStage(contact.contactStage);
	const createdMs = getContactCreatedAtMs((contact as any).createdAt);
	const lastActivityMs = resolveLastActivityMs(contact);

	const cutoff1y = new Date(nowMs);
	cutoff1y.setFullYear(cutoff1y.getFullYear() - 1);
	const hasRecentActivity1y = lastActivityMs !== null && lastActivityMs >= cutoff1y.getTime();

	const cleanPhone = String(contact.telephon || '').replace(/\D/g, '');
	const hasValidPhone = cleanPhone.length >= 10;
	const isE4BroadcastEligible = isStage4ForBroadcast(contact);

	const ageStatus: AgeStatus =
		createdMs === null
			? 'missing'
			: isWithinMaxAgeYears(contact, 2, nowMs)
				? 'within_2y'
				: 'over_2y';

	const protectedRole = resolveProtectedRole(contact, badge, normalizedStage);

	let bucket: AuditBucketKey;
	if (contact.isActive === false) {
		bucket = 'inactive';
	} else if (protectedRole !== null) {
		bucket = 'protected_non_buyer';
	} else if (ageStatus === 'missing') {
		bucket = 'missing_created_at';
	} else if (ageStatus === 'within_2y') {
		bucket = badge.text === 'E4' ? 'active_e4_eligible' : 'active_calls_recent';
	} else {
		bucket = 'cold_over_2y_buyers';
	}

	return {
		contact,
		badge,
		bucket,
		ageStatus,
		createdMs,
		lastActivityMs,
		hasRecentActivity1y,
		hasValidPhone,
		isE4BroadcastEligible,
		protectedRole,
		normalizedStage
	};
}

/**
 * Ejecuta la radiografía completa en memoria sin mutar ningún documento de Firestore.
 */
export function runContactsPortfolioAudit(
	contacts: Contact[],
	nowMs: number = Date.now()
): ContactsPortfolioAudit {
	const items = contacts.map((c) => classifyContactForAudit(c, nowMs));

	const counts: Record<AuditBucketKey, number> = {
		active_e4_eligible: 0,
		active_calls_recent: 0,
		cold_over_2y_buyers: 0,
		protected_non_buyer: 0,
		missing_created_at: 0,
		inactive: 0
	};

	const e4Breakdown = { totalRecentE4: 0, validPhoneReadyForWa: 0, missingOrShortPhone: 0 };
	const recentCallsBreakdown = { total: 0, e1: 0, e2: 0, e3: 0, na: 0 };
	const coldOver2yBreakdown = {
		total: 0,
		toMoveToE3: 0,
		alreadyE3: 0,
		e1: 0,
		e2: 0,
		e4: 0,
		na: 0,
		withRecentActivity1y: 0,
		noRecentActivity: 0
	};
	const protectedBreakdown = {
		total: 0,
		over2yCount: 0,
		sellersAndLandlords: 0,
		agents: 0,
		tenants: 0,
		closedOrPostSale: 0,
		missingDateCount: 0
	};
	const missingDateBreakdown = { total: 0, inE4: 0, inE1E2E3: 0, inOther: 0 };

	for (const item of items) {
		counts[item.bucket]++;

		switch (item.bucket) {
			case 'active_e4_eligible':
				e4Breakdown.totalRecentE4++;
				if (item.hasValidPhone) e4Breakdown.validPhoneReadyForWa++;
				else e4Breakdown.missingOrShortPhone++;
				break;

			case 'active_calls_recent':
				recentCallsBreakdown.total++;
				if (item.badge.text === 'E1') recentCallsBreakdown.e1++;
				else if (item.badge.text === 'E2') recentCallsBreakdown.e2++;
				else if (item.badge.text === 'E3') recentCallsBreakdown.e3++;
				else recentCallsBreakdown.na++;
				break;

			case 'cold_over_2y_buyers':
				coldOver2yBreakdown.total++;
				if (item.badge.text === 'E3') {
					coldOver2yBreakdown.alreadyE3++;
				} else {
					coldOver2yBreakdown.toMoveToE3++;
					if (item.badge.text === 'E1') coldOver2yBreakdown.e1++;
					else if (item.badge.text === 'E2') coldOver2yBreakdown.e2++;
					else if (item.badge.text === 'E4') coldOver2yBreakdown.e4++;
					else coldOver2yBreakdown.na++;
				}
				if (item.hasRecentActivity1y) coldOver2yBreakdown.withRecentActivity1y++;
				else coldOver2yBreakdown.noRecentActivity++;
				break;

			case 'protected_non_buyer':
				protectedBreakdown.total++;
				if (item.ageStatus === 'over_2y') protectedBreakdown.over2yCount++;
				if (item.ageStatus === 'missing') protectedBreakdown.missingDateCount++;
				if (item.protectedRole === 'seller_or_landlord') protectedBreakdown.sellersAndLandlords++;
				else if (item.protectedRole === 'agent') protectedBreakdown.agents++;
				else if (item.protectedRole === 'tenant') protectedBreakdown.tenants++;
				else if (item.protectedRole === 'closed_or_post_sale') protectedBreakdown.closedOrPostSale++;
				break;

			case 'missing_created_at':
				missingDateBreakdown.total++;
				if (item.badge.text === 'E4') missingDateBreakdown.inE4++;
				else if (['E1', 'E2', 'E3'].includes(item.badge.text)) missingDateBreakdown.inE1E2E3++;
				else missingDateBreakdown.inOther++;
				break;
		}
	}

	return {
		total: items.length,
		generatedAt: nowMs,
		items,
		counts,
		e4Breakdown,
		recentCallsBreakdown,
		coldOver2yBreakdown,
		protectedBreakdown,
		missingDateBreakdown
	};
}

/**
 * Filtra los resultados auditados por cajón, subfiltro opcional y término de búsqueda.
 */
export function filterAuditedContacts(
	items: AuditedContact[],
	bucket: AuditBucketKey | 'all',
	coldSubFilter: ColdSubFilter,
	protectedSubFilter: ProtectedSubFilter,
	searchTerm: string
): AuditedContact[] {
	const term = searchTerm.trim().toLowerCase();

	return items.filter((item) => {
		if (bucket !== 'all' && item.bucket !== bucket) return false;

		if (bucket === 'cold_over_2y_buyers' && coldSubFilter !== 'all') {
			if (coldSubFilter === 'to_move_e3' && item.badge.text === 'E3') return false;
			if (coldSubFilter === 'already_e3' && item.badge.text !== 'E3') return false;
			if (coldSubFilter === 'recent_activity_1y' && !item.hasRecentActivity1y) return false;
			if (coldSubFilter === 'no_recent_activity' && item.hasRecentActivity1y) return false;
		}

		if (bucket === 'protected_non_buyer' && protectedSubFilter !== 'all') {
			if (protectedSubFilter === 'over_2y_only' && item.ageStatus !== 'over_2y') return false;
			if (protectedSubFilter === 'sellers_landlords' && item.protectedRole !== 'seller_or_landlord')
				return false;
			if (protectedSubFilter === 'agents' && item.protectedRole !== 'agent') return false;
			if (protectedSubFilter === 'tenants' && item.protectedRole !== 'tenant') return false;
			if (protectedSubFilter === 'e5_e6' && item.protectedRole !== 'closed_or_post_sale')
				return false;
		}

		if (term) {
			const hay = [
				item.contact.name || '',
				item.contact.lastname || '',
				item.contact.telephon || '',
				item.contact.typeContact || '',
				item.badge.text
			]
				.join(' ')
				.toLowerCase();
			if (!hay.includes(term)) return false;
		}

		return true;
	});
}

function escapeCsvCell(value: any): string {
	const str = String(value ?? '').replace(/"/g, '""');
	return `"${str}"`;
}

function formatIsoDay(ms: number | null): string {
	if (!ms) return 'Sin fecha';
	return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Genera CSV de solo lectura para inspección externa del segmento filtrado.
 */
export function buildAuditCsv(items: AuditedContact[]): string {
	const headers = [
		'ID',
		'Nombre',
		'Apellido',
		'Telefono',
		'Tipo',
		'Etapa_Badge',
		'Cajon_Auditoria',
		'Fecha_Alta_Firestore',
		'Ultimo_Contacto',
		'Activo'
	];

	const rows = items.map((item) => [
		item.contact.id || '',
		item.contact.name || '',
		item.contact.lastname || '',
		item.contact.telephon || '',
		item.contact.typeContact || '',
		item.badge.text,
		AUDIT_BUCKET_LABELS[item.bucket],
		formatIsoDay(item.createdMs),
		formatIsoDay(item.lastActivityMs),
		item.contact.isActive === false ? 'No' : 'Si'
	]);

	return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}
