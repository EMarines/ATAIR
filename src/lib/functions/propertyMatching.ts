import type { Binnacle, Contact, Property } from '$lib/types';
import { getContactCreatedAtMs, normalizeStage } from './contactBadge';
import { tagToFeatures, tagToUbicacion } from './tagConverters';

export interface PropertyMatchOptions {
	synergyOnly?: boolean;
	prioritizeInventory?: boolean;
	excludeAlreadySent?: boolean;
	binnacles?: Binnacle[];
	maxResults?: number;
}

export interface ContactMatchOptions {
	includeInactive?: boolean;
}

export interface MatchEvaluation {
	matched: boolean;
	score: number;
	exactLocation: boolean;
	amenityMatches: number;
}

export interface ContactFilterCriteria {
	startDate?: string;
	endDate?: string;
	typeContact?: string;
	typeProperty?: string;
	contactStage?: string;
	budget?: number;
	rangeProp?: string;
	bedrooms?: string;
	bathrooms?: string;
	parking?: string;
	locaProperty?: string;
	tagsProperty?: string[];
}

const INACTIVE_PROPERTY_STATUSES = new Set([
	'sold',
	'rented',
	'suspended',
	'cancelled',
	'canceled',
	'inactive',
	'closed',
	'vendida',
	'rentada',
	'suspendida',
	'inactiva'
]);

const CODE_RANGE_BOUNDS: Record<string, { min: number; max: number }> = {
	PRM: { min: 0, max: 1_000_000 },
	SGN: { min: 1_000_001, max: 2_500_000 },
	TRC: { min: 2_500_001, max: 5_000_000 },
	CRT: { min: 5_000_001, max: 8_000_000 },
	QNT: { min: 8_000_001, max: 12_000_000 },
	SXT: { min: 12_000_001, max: Number.POSITIVE_INFINITY },
	SCT: { min: 12_000_001, max: Number.POSITIVE_INFINITY }
};

const AMENITY_ALIASES: Record<string, string> = {
	'fracc privado': 'fraccionamiento privado',
	'fraccionamiento privado': 'fraccionamiento privado',
	'fraccionamiento cerrado': 'fraccionamiento privado',
	privada: 'fraccionamiento privado',
	'condominio cerrado': 'fraccionamiento privado',
	coto: 'fraccionamiento privado',
	'recamara en pb': 'recamara en planta baja',
	'recamara en p b': 'recamara en planta baja',
	'recamara en planta baja': 'recamara en planta baja',
	'recamara abajo': 'recamara en planta baja',
	'lista para habitarse': 'lista para habitar',
	'lista para habitar': 'lista para habitar',
	'llave en mano': 'lista para habitar',
	'en avenida': 'sobre avenida principal',
	'sobre avenida': 'sobre avenida principal',
	'sobre avenida principal': 'sobre avenida principal',
	'avenida principal': 'sobre avenida principal',
	'patio amplio': 'patio amplio',
	'amplio patio': 'patio amplio',
	'frente a parque': 'frente a parque',
	'frente al parque': 'frente a parque',
	'una planta': 'una planta',
	'1 planta': 'una planta',
	alberca: 'alberca',
	piscina: 'alberca',
	nueva: 'nueva',
	nuevo: 'nueva',
	'a estrenar': 'nueva',
	oportunidad: 'oportunidad',
	remate: 'oportunidad'
};

export function normalizeMatchText(value: unknown): string {
	return String(value ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeAmenityToken(raw: unknown): string {
	const cleaned = normalizeMatchText(raw)
		.replace(/[.,/_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return '';
	return AMENITY_ALIASES[cleaned] || cleaned;
}

export function normalizeZoneToken(raw: unknown): string {
	const detected = tagToUbicacion(raw);
	if (detected) return detected;
	return normalizeMatchText(raw).replace(/[\s\-_]+/g, '');
}

export function normalizeOperation(raw: unknown): 'sale' | 'rental' | null {
	const text = normalizeMatchText(raw);
	if (!text) return null;
	if (
		text === 'sale' ||
		text === 'venta' ||
		text === 'ventas' ||
		text === 'comprador' ||
		text === 'cliente'
	) {
		return 'sale';
	}
	if (
		text === 'rental' ||
		text === 'rent' ||
		text === 'renta' ||
		text === 'rentas' ||
		text === 'arrendatario' ||
		text === 'arrendamiento' ||
		text === 'arrendador' ||
		text === 'inquilino'
	) {
		return 'rental';
	}
	return null;
}

export function normalizePropertyType(raw: unknown): string {
	const text = normalizeMatchText(raw);
	if (!text || text === 'otro' || text === 'propiedad') return '';
	if (text.startsWith('casa')) return 'casa';
	if (text.startsWith('depto') || text.startsWith('departamento')) return 'departamento';
	if (text.startsWith('terreno')) return 'terreno';
	if (text === 'local' || text.startsWith('local comercial')) return 'local comercial';
	return text;
}

export function parseRangeBounds(rawRange: unknown): { min: number; max: number } | null {
	const raw = String(rawRange ?? '').trim();
	if (!raw) return null;

	const upper = raw.toUpperCase();
	if (CODE_RANGE_BOUNDS[upper]) {
		return CODE_RANGE_BOUNDS[upper];
	}

	const sanitized = raw.replace(/[$,\s]/g, '');
	const plusMatch = sanitized.match(/^(\d+)\+$/);
	if (plusMatch) {
		return { min: Number(plusMatch[1]), max: Number.POSITIVE_INFINITY };
	}

	const rangeMatch = sanitized.match(/^(\d+)[-–](\d+)$/);
	if (rangeMatch) {
		const min = Number(rangeMatch[1]);
		const max = Number(rangeMatch[2]);
		if (Number.isFinite(min) && Number.isFinite(max)) {
			return { min: Math.min(min, max), max: Math.max(min, max) };
		}
	}

	return null;
}

export function extractPropertyPrice(prop: Partial<Property> | any): number {
	if (!prop) return 0;
	const candidates = [
		prop.price,
		prop.precio,
		prop.budget,
		Array.isArray(prop.operations) ? prop.operations[0]?.amount : undefined
	];
	for (const val of candidates) {
		const num = Number(val);
		if (Number.isFinite(num) && num > 0) return num;
	}
	return 0;
}

export function resolvePropertyOperation(prop: Partial<Property> | any): 'sale' | 'rental' | null {
	if (!prop) return null;
	return (
		normalizeOperation(prop.selecTO) ||
		normalizeOperation(prop.operation_type) ||
		normalizeOperation(prop.tipoOperacion) ||
		normalizeOperation(Array.isArray(prop.operations) ? prop.operations[0]?.type : '')
	);
}

export function resolveContactOperation(contact: Partial<Contact> | any): 'sale' | 'rental' | null {
	if (!contact) return null;
	const explicit =
		normalizeOperation(contact.selecTO) ||
		normalizeOperation(contact.typeOperation) ||
		normalizeOperation(contact.tipoOperacion);
	if (explicit) return explicit;

	const role = normalizeMatchText(contact.typeContact || contact.contactType || contact.tipo);
	if (role.includes('arrendatario') || role.includes('inquilino') || role === 'renta') {
		return 'rental';
	}
	if (role.includes('comprador') || role === 'cliente' || role === 'venta') {
		return 'sale';
	}
	return null;
}

export function extractPropertyIdentifiers(prop: Partial<Property> | any): string[] {
	if (!prop) return [];
	const rawIds = [
		prop.public_id,
		prop.id,
		prop.docId,
		prop.clavePropiedad,
		prop.claveEB,
		prop.claveMH,
		prop.easybroker_id
	];
	const unique = new Set<string>();
	for (const item of rawIds) {
		const clean = String(item ?? '').trim();
		if (clean) unique.add(clean);
	}
	return Array.from(unique);
}

export function isSynergyProperty(prop: Partial<Property> | any): boolean {
	if (!prop) return false;
	const source = normalizeMatchText(prop.source);
	if (source === 'easybroker') return false;
	if (source === 'synergy') return true;

	const proc = String(prop.procedencia || '').trim().toUpperCase();
	if (proc === 'S1' || proc === 'S2' || proc === 'S3') return true;

	const ids = extractPropertyIdentifiers(prop).map((id) => id.toUpperCase());
	if (ids.some((id) => id.startsWith('S1-') || id.startsWith('S2-') || id.startsWith('S3-'))) {
		return true;
	}

	return prop.isOwn === false && source !== 'direct';
}

/**
 * Prioridad comercial de inventario para recomendaciones:
 * 1 = Propias Match Home (MH / direct / isOwn)
 * 2 = EasyBroker (EB / source easybroker)
 * 3 = Sinergias (S1 / S2 / S3)
 */
export function getPropertyInventoryPriority(prop: Partial<Property> | any): number {
	if (!prop) return 3;
	if (isSynergyProperty(prop)) return 3;

	const source = normalizeMatchText(prop.source);
	const proc = String(prop.procedencia || '').trim().toUpperCase();
	const ids = extractPropertyIdentifiers(prop).map((id) => id.toUpperCase());

	if (
		source === 'easybroker' ||
		proc === 'EB' ||
		ids.some((id) => id.startsWith('EB-'))
	) {
		return 2;
	}

	return 1;
}

export function isAvailableProperty(prop: Partial<Property> | any): boolean {
	if (!prop) return false;
	const status = normalizeMatchText(prop.property_status || prop.status);
	if (!status) return true;
	return !INACTIVE_PROPERTY_STATUSES.has(status);
}

export function getPropertyAmenities(prop: Partial<Property> | any): string[] {
	if (!prop) return [];
	const rawPool: string[] = [
		...(Array.isArray(prop.tags) ? prop.tags : []),
		...(Array.isArray(prop.propertyTags) ? prop.propertyTags : []),
		...(Array.isArray(prop.amenityTags) ? prop.amenityTags : []),
		...(Array.isArray(prop.features) ? prop.features : []),
		...(Array.isArray(prop.amenidades) ? prop.amenidades : [])
	];
	const withoutLocations = tagToFeatures(rawPool);
	const normalized = new Set<string>();
	for (const item of withoutLocations) {
		const token = normalizeAmenityToken(item);
		if (token) normalized.add(token);
	}
	return Array.from(normalized);
}

export function isPropertySendBinnacle(entry: Binnacle): boolean {
	const action = normalizeMatchText(entry.action);
	return (
		action.includes('propiedad enviada') ||
		action.includes('propuesta enviada') ||
		action.includes('enviada por whatsapp')
	);
}

/**
 * Obtiene el timestamp más reciente (en ms) de envío de propiedad a un contacto.
 */
export function getMostRecentPropertySendMs(
	contactId: string,
	binnacles: Binnacle[] = []
): number | null {
	if (!contactId || !Array.isArray(binnacles)) return null;
	let latestMs: number | null = null;
	for (const item of binnacles) {
		if (String(item.to ?? '').trim() !== contactId) continue;
		if (isPropertySendBinnacle(item) || /^[A-Z0-9]{2,5}-/i.test(String(item.comment ?? ''))) {
			const binnMs = getContactCreatedAtMs((item as any).date ?? (item as any).createdAt);
			if (binnMs !== null && (latestMs === null || binnMs > latestMs)) {
				latestMs = binnMs;
			}
		}
	}
	return latestMs;
}

/**
 * Detecta si se enviaron propiedades a un contacto en una ventana de tiempo,
 * permitiendo opcionalmente exigir una edad mínima (tiempo de gracia).
 */
export function hasRecentPropertySend(
	contactId: string,
	binnacles: Binnacle[] = [],
	withinMs: number = 48 * 3600_000,
	nowMs: number = Date.now(),
	minAgeMs: number = 0
): boolean {
	if (!contactId || !Array.isArray(binnacles)) return false;
	const maxThreshold = nowMs - minAgeMs;
	const minThreshold = nowMs - withinMs;
	for (const item of binnacles) {
		if (String(item.to ?? '').trim() !== contactId) continue;
		const binnMs = getContactCreatedAtMs((item as any).date ?? (item as any).createdAt);
		if (binnMs && binnMs >= minThreshold && binnMs <= maxThreshold) {
			if (isPropertySendBinnacle(item) || /^[A-Z0-9]{2,5}-/i.test(String(item.comment ?? ''))) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Obtiene todos los IDs de propiedad ya enviados a un contacto (sendedProperties + bitácora).
 */
export function getSentPropertyIdsForContact(
	contact: Partial<Contact> | null | undefined,
	binnacles: Binnacle[] = []
): Set<string> {
	const sent = new Set<string>();
	if (!contact) return sent;

	if (Array.isArray(contact.sendedProperties)) {
		for (const id of contact.sendedProperties) {
			const clean = String(id ?? '').trim().toUpperCase();
			if (clean) sent.add(clean);
		}
	}

	const contactId = String(contact.id ?? '').trim();
	if (contactId && Array.isArray(binnacles)) {
		for (const item of binnacles) {
			if (String(item.to ?? '').trim() !== contactId) continue;
			const commentId = String(item.comment ?? '').trim();
			if (!commentId) continue;
			if (isPropertySendBinnacle(item) || /^[A-Z0-9]{2,5}-/i.test(commentId)) {
				sent.add(commentId.toUpperCase());
			}
		}
	}

	return sent;
}

/**
 * Determina si una propiedad ya fue enviada previamente a un contacto.
 */
export function wasPropertySentToContact(
	prop: Partial<Property> | any,
	contact: Partial<Contact> | null | undefined,
	binnacles: Binnacle[] = []
): boolean {
	if (!prop || !contact) return false;
	const sentSet = getSentPropertyIdsForContact(contact, binnacles);
	if (sentSet.size === 0) return false;
	return extractPropertyIdentifiers(prop).some((id) => sentSet.has(id.toUpperCase()));
}

/**
 * Obtiene los IDs de contactos que ya recibieron la propiedad (bitácora + sendedProperties).
 */
export function getSentContactIdsForProperty(
	prop: Partial<Property> | null | undefined,
	contacts: Contact[] = [],
	binnacles: Binnacle[] = []
): Set<string> {
	const sentContacts = new Set<string>();
	if (!prop) return sentContacts;

	const propIds = new Set(extractPropertyIdentifiers(prop).map((id) => id.toUpperCase()));
	if (propIds.size === 0) return sentContacts;

	for (const item of binnacles) {
		const comment = String(item.comment ?? '').trim().toUpperCase();
		const targetContactId = String(item.to ?? '').trim();
		if (targetContactId && comment && propIds.has(comment)) {
			sentContacts.add(targetContactId);
		}
	}

	for (const c of contacts) {
		if (!c?.id || !Array.isArray(c.sendedProperties)) continue;
		if (c.sendedProperties.some((id) => propIds.has(String(id ?? '').trim().toUpperCase()))) {
			sentContacts.add(c.id);
		}
	}

	return sentContacts;
}

function getContactZones(contact: Partial<Contact> | any): string[] {
	const rawList = Array.isArray(contact?.locaProperty) ? contact.locaProperty : [];
	const zones = new Set<string>();
	for (const z of rawList) {
		const norm = normalizeZoneToken(z);
		if (norm) zones.add(norm);
	}
	return Array.from(zones);
}

function getContactAmenities(contact: Partial<Contact> | any): string[] {
	const rawList = [
		...(Array.isArray(contact?.tagsProperty) ? contact.tagsProperty : []),
		...(Array.isArray(contact?.tags) ? contact.tags : [])
	];
	const amenities = new Set<string>();
	for (const t of rawList) {
		const norm = normalizeAmenityToken(t);
		if (norm) amenities.add(norm);
	}
	return Array.from(amenities);
}

/**
 * Evalúa compatibilidad bidireccional entre una Propiedad y un Contacto.
 */
export function evaluatePropertyContactMatch(
	property: Partial<Property> | any,
	contact: Partial<Contact> | any,
	options: { synergyOnly?: boolean; includeInactive?: boolean } = {}
): MatchEvaluation {
	const fail: MatchEvaluation = {
		matched: false,
		score: 0,
		exactLocation: false,
		amenityMatches: 0
	};

	if (!property || !contact) return fail;
	if (!options.includeInactive && contact.isActive === false) return fail;
	if (!isAvailableProperty(property)) return fail;
	if (options.synergyOnly && !isSynergyProperty(property)) return fail;

	// 1. Tipo de propiedad
	const contactType = normalizePropertyType(contact.selecTP || contact.typeProperty);
	if (contactType) {
		const propType = normalizePropertyType(
			property.property_type || property.selecTP || property.tipoPropiedad
		);
		if (propType && propType !== contactType) return fail;
	}

	// 2. Tipo de operación (Venta vs Renta)
	const contactOp = resolveContactOperation(contact);
	const propOp = resolvePropertyOperation(property);
	if (contactOp && propOp && contactOp !== propOp) {
		return fail;
	}

	// 3. Mínimos de recámaras, baños y estacionamientos
	const reqBeds = Number(contact.numBeds || 0);
	if (reqBeds > 0 && Number(property.bedrooms || 0) < reqBeds) return fail;

	const reqBaths = Number(contact.numBaths || 0);
	if (reqBaths > 0 && Number(property.bathrooms || 0) < reqBaths) return fail;

	const reqParks = Number(contact.numParks || 0);
	if (reqParks > 0 && Number(property.parking_spaces || 0) < reqParks) return fail;

	// 4. Presupuesto (-30% a +10%) o Rango predefinido
	const propPrice = extractPropertyPrice(property);
	const contactBudget = Number(contact.budget || 0);
	let budgetScore = 10;

	if (contactBudget > 0) {
		const low = contactBudget * 0.7;
		const high = contactBudget * 1.1;
		if (propPrice <= 0 || propPrice < low || propPrice > high) return fail;
		const distanceRatio = Math.abs(propPrice - contactBudget) / contactBudget;
		budgetScore = Math.max(0, Math.round(30 * (1 - distanceRatio)));
	} else if (contact.rangeProp) {
		const bounds = parseRangeBounds(contact.rangeProp);
		if (bounds) {
			if (propPrice <= 0 || propPrice < bounds.min || propPrice > bounds.max) return fail;
			budgetScore = 20;
		}
	}

	// 5. Zona geográfica
	const contactZones = getContactZones(contact);
	const propZone = tagToUbicacion(property);
	let exactLocation = false;
	if (contactZones.length > 0 && propZone) {
		if (!contactZones.includes(propZone)) return fail;
		exactLocation = true;
	}

	// 6. Amenidades / Preferencias (normalizadas)
	const contactAmenities = getContactAmenities(contact);
	const propAmenities = getPropertyAmenities(property);
	let amenityMatches = 0;

	if (contactAmenities.length > 0) {
		const allPresent = contactAmenities.every((req) => propAmenities.includes(req));
		if (!allPresent) return fail;
		amenityMatches = contactAmenities.length;
	} else {
		amenityMatches = propAmenities.length > 0 ? 1 : 0;
	}

	// Ranking para ordenar mejores recomendaciones primero
	let score = budgetScore + amenityMatches * 10;
	if (exactLocation) score += 40;
	if (property.public_id) score += 5;

	const createdMs = getContactCreatedAtMs(property.created_at);
	if (createdMs && Date.now() - createdMs <= 30 * 86400_000) {
		score += 10;
	}

	return {
		matched: true,
		score,
		exactLocation,
		amenityMatches
	};
}

/**
 * Propiedad → Contactos compatibles (usado por "Buscar Contactos" en /property/[id]).
 */
export function matchContactsForProperty(
	property: Property,
	contacts: Contact[],
	options: ContactMatchOptions = {}
): Contact[] {
	if (!property || !Array.isArray(contacts)) return [];
	return contacts.filter(
		(contact) => evaluatePropertyContactMatch(property, contact, options).matched
	);
}

/**
 * Contacto → Propiedades compatibles ordenadas por afinidad.
 * En ATAIR Copiloto E4: { synergyOnly: true, excludeAlreadySent: true, binnacles, maxResults: 3 }.
 */
export function matchPropertiesForContact(
	contact: Contact,
	properties: Property[],
	options: PropertyMatchOptions = {}
): Property[] {
	if (!contact || !Array.isArray(properties)) return [];

	const sentSet =
		options.excludeAlreadySent
			? getSentPropertyIdsForContact(contact, options.binnacles || [])
			: null;

	const prioritizeInventory = options.prioritizeInventory ?? !options.synergyOnly;
	const scored: Array<{
		property: Property;
		inventoryPriority: number;
		score: number;
		createdAtMs: number;
	}> = [];

	for (const property of properties) {
		if (sentSet && sentSet.size > 0) {
			const propIds = extractPropertyIdentifiers(property);
			if (propIds.some((id) => sentSet.has(id.toUpperCase()))) {
				continue;
			}
		}

		const evalRes = evaluatePropertyContactMatch(property, contact, {
			synergyOnly: options.synergyOnly,
			includeInactive: true
		});

		if (!evalRes.matched) continue;

		scored.push({
			property,
			inventoryPriority: getPropertyInventoryPriority(property),
			score: evalRes.score,
			createdAtMs: getContactCreatedAtMs(property.created_at) ?? 0
		});
	}

	scored.sort((a, b) => {
		if (prioritizeInventory && a.inventoryPriority !== b.inventoryPriority) {
			return a.inventoryPriority - b.inventoryPriority;
		}
		if (b.score !== a.score) return b.score - a.score;
		return b.createdAtMs - a.createdAtMs;
	});

	const limit = options.maxResults && options.maxResults > 0 ? options.maxResults : scored.length;
	return scored.slice(0, limit).map((item) => item.property);
}

/**
 * Filtro multicriterio para la consola /actions/cont-filter (#036).
 */
export function filterContactsByCriteria(
	contacts: Contact[],
	criteria: ContactFilterCriteria
): Contact[] {
	if (!Array.isArray(contacts)) return [];

	const startMs = criteria.startDate ? new Date(`${criteria.startDate}T00:00:00`).getTime() : null;
	const endMs = criteria.endDate ? new Date(`${criteria.endDate}T23:59:59.999`).getTime() : null;
	const filterTypeContact = normalizeMatchText(criteria.typeContact);
	const filterPropType = normalizePropertyType(criteria.typeProperty);
	const filterStage = criteria.contactStage ? normalizeStage(criteria.contactStage) : null;
	const filterZone = criteria.locaProperty ? normalizeZoneToken(criteria.locaProperty) : '';
	const filterTags = (criteria.tagsProperty || []).map(normalizeAmenityToken).filter(Boolean);
	const filterBudget = Number(criteria.budget || 0);
	const filterRangeBounds = criteria.rangeProp ? parseRangeBounds(criteria.rangeProp) : null;

	return contacts.filter((contact) => {
		if (!contact) return false;

		if (startMs && endMs) {
			const createdMs = getContactCreatedAtMs((contact as any).createdAt);
			if (!createdMs || createdMs < startMs || createdMs > endMs) return false;
		}

		if (filterTypeContact) {
			const tc = normalizeMatchText(contact.typeContact || contact.contactType);
			let typeMatched = tc === filterTypeContact;
			if (!typeMatched && filterTypeContact === 'vendedor') {
				typeMatched = tc === 'propietario';
			} else if (!typeMatched && filterTypeContact === 'comprador') {
				typeMatched = tc === 'cliente' || tc === 'venta';
			} else if (!typeMatched && filterTypeContact === 'arrendatario') {
				typeMatched = tc === 'renta' || tc === 'inquilino';
			} else if (!typeMatched && filterTypeContact === 'agente inmobiliario') {
				typeMatched = tc === 'inmobiliaria' || tc === 'colaborador' || tc === 'inmobiliario';
			}
			if (!typeMatched) return false;
		}

		if (filterPropType) {
			const cPropType = normalizePropertyType(contact.selecTP || contact.typeProperty);
			if (cPropType !== filterPropType) return false;
		}

		if (filterBudget > 0) {
			const minBudget = filterBudget * 0.7;
			const maxBudget = filterBudget * 1.1;
			const cBudget = Number(contact.budget || 0);
			if (cBudget > 0) {
				if (cBudget < minBudget || cBudget > maxBudget) return false;
			} else if (contact.rangeProp) {
				const cBounds = parseRangeBounds(contact.rangeProp);
				if (!cBounds || filterBudget < cBounds.min || filterBudget > cBounds.max) return false;
			} else {
				return false;
			}
		} else if (filterRangeBounds) {
			const cBudget = Number(contact.budget || 0);
			if (cBudget > 0) {
				if (cBudget < filterRangeBounds.min || cBudget > filterRangeBounds.max) return false;
			} else if (contact.rangeProp) {
				const cBounds = parseRangeBounds(contact.rangeProp);
				if (!cBounds || cBounds.max < filterRangeBounds.min || cBounds.min > filterRangeBounds.max) {
					return false;
				}
			} else {
				return false;
			}
		}

		if (criteria.bedrooms) {
			const maxBeds = Number(String(criteria.bedrooms).replace('+', ''));
			if (Number(contact.numBeds || 0) > maxBeds) return false;
		}

		if (filterStage !== null) {
			const tc = normalizeMatchText(contact.typeContact || contact.contactType);
			const isOwner = tc === 'vendedor' || tc === 'propietario' || tc === 'arrendador';
			if (filterStage === 'PAU') {
				const reason = String((contact as any).inactiveReason || '').toLowerCase().trim();
				const isPaused =
					(contact.isActive === false && reason === 'pausado') ||
					normalizeStage(contact.contactStage) === 'PAU';
				if (!isPaused) return false;
			} else if (filterStage === 'IN') {
				const reason = String((contact as any).inactiveReason || '').toLowerCase().trim();
				const isInactiveDef =
					(contact.isActive === false && reason !== 'pausado') ||
					normalizeStage(contact.contactStage) === 'IN';
				if (!isInactiveDef) return false;
			} else if (isOwner) {
				if (filterStage !== 'OW') return false;
			} else if (contact.isActive === false || normalizeStage(contact.contactStage) !== filterStage) {
				return false;
			}
		}

		if (criteria.bathrooms) {
			const maxBaths = Number(String(criteria.bathrooms).replace('+', ''));
			if (Number(contact.numBaths || 0) > maxBaths) return false;
		}

		if (criteria.parking) {
			const maxParks = Number(String(criteria.parking).replace('+', ''));
			if (Number(contact.numParks || 0) > maxParks) return false;
		}

		if (filterZone) {
			const zones = getContactZones(contact);
			if (!zones.includes(filterZone)) return false;
		}

		if (filterTags.length > 0) {
			const cAmenities = getContactAmenities(contact);
			if (!filterTags.some((tag) => cAmenities.includes(tag))) return false;
		}

		return true;
	});
}

export interface PriceRangeMatchOptions {
	tolerance?: number;
	excludeAlreadySent?: boolean;
	binnacles?: Binnacle[];
	maxResults?: number;
	synergyOnly?: boolean;
}

/**
 * Encuentra 2 a 3 propiedades en el rango de precio (±25% por defecto)
 * de la propiedad que consultó el lead (propCont) o de su presupuesto (#040).
 */
export function findPropertiesInPriceRangeForContact(
	contact: Partial<Contact> | null | undefined,
	properties: Property[],
	options: PriceRangeMatchOptions = {}
): Property[] {
	if (!contact || !Array.isArray(properties) || properties.length === 0) return [];

	const tolerance =
		typeof options.tolerance === 'number' && options.tolerance > 0 ? options.tolerance : 0.25;

	const sentSet =
		options.excludeAlreadySent !== false
			? getSentPropertyIdsForContact(contact, options.binnacles || [])
			: new Set<string>();

	let targetPrice = 0;
	let targetType = normalizePropertyType(contact.selecTP || contact.typeProperty);
	let targetZone = '';
	const refPropKey = String(contact.propCont || '').trim().toUpperCase();
	const refPropIds = new Set<string>();

	if (refPropKey) {
		refPropIds.add(refPropKey);
		const refProp = properties.find((p) => {
			const ids = extractPropertyIdentifiers(p).map((id) => id.toUpperCase());
			return ids.includes(refPropKey);
		});
		if (refProp) {
			targetPrice = extractPropertyPrice(refProp);
			if (!targetType) {
				targetType = normalizePropertyType(
					refProp.property_type || refProp.selecTP || (refProp as any).tipoPropiedad
				);
			}
			targetZone = tagToUbicacion(refProp);
			for (const id of extractPropertyIdentifiers(refProp)) {
				refPropIds.add(id.toUpperCase());
			}
		}
	}

	if (targetPrice === 0) {
		targetPrice = Number(contact.budget || 0);
	}
	if (targetPrice === 0 && contact.rangeProp) {
		const bounds = parseRangeBounds(contact.rangeProp);
		if (bounds) targetPrice = (bounds.min + bounds.max) / 2;
	}

	if (targetPrice <= 0) return [];

	const minPrice = targetPrice * (1 - tolerance);
	const maxPrice = targetPrice * (1 + tolerance);
	const contactOp = resolveContactOperation(contact) || 'sale';
	const contactZones = getContactZones(contact);
	if (targetZone && !contactZones.includes(targetZone)) {
		contactZones.push(targetZone);
	}

	const scored: Array<{
		property: Property;
		inventoryPriority: number;
		score: number;
		priceDiff: number;
		createdAtMs: number;
	}> = [];

	for (const prop of properties) {
		if (!prop) continue;
		if (!isAvailableProperty(prop)) continue;
		if (options.synergyOnly && !isSynergyProperty(prop)) continue;

		const propIds = extractPropertyIdentifiers(prop).map((id) => id.toUpperCase());
		// Excluir la propiedad de referencia consultada
		if (propIds.some((id) => refPropIds.has(id))) continue;
		// Excluir propiedades ya enviadas
		if (propIds.some((id) => sentSet.has(id))) continue;

		// Operación (Venta / Renta)
		const propOp = resolvePropertyOperation(prop);
		if (propOp && propOp !== contactOp) continue;

		// Rango de precio
		const propPrice = extractPropertyPrice(prop);
		if (propPrice < minPrice || propPrice > maxPrice) continue;

		// Tipo de propiedad
		const propType = normalizePropertyType(
			prop.property_type || prop.selecTP || (prop as any).tipoPropiedad
		);
		let typeScore = 0;
		if (targetType) {
			if (targetType === 'casa' || targetType === 'departamento') {
				if (propType !== 'casa' && propType !== 'departamento') continue;
				if (propType === targetType) typeScore = 30;
			} else if (propType === targetType) {
				typeScore = 30;
			} else {
				continue;
			}
		}

		// Proximidad de precio
		const priceDiffRatio = Math.abs(propPrice - targetPrice) / targetPrice;
		const priceScore = Math.max(0, Math.round(50 * (1 - priceDiffRatio)));

		// Zona geográfica
		const propZone = tagToUbicacion(prop);
		let zoneScore = 0;
		if (propZone && contactZones.includes(propZone)) {
			zoneScore = 20;
		}

		let bonus = 0;
		const invPriority = getPropertyInventoryPriority(prop);
		if (invPriority === 1) bonus += 15;
		else if (invPriority === 2) bonus += 10;
		if (prop.public_id) bonus += 5;

		const propCreatedMs = getContactCreatedAtMs(prop.created_at);
		if (propCreatedMs && Date.now() - propCreatedMs <= 60 * 86_400_000) {
			bonus += 10;
		}

		const totalScore = priceScore + typeScore + zoneScore + bonus;
		scored.push({
			property: prop,
			inventoryPriority: invPriority,
			score: totalScore,
			priceDiff: Math.abs(propPrice - targetPrice),
			createdAtMs: propCreatedMs ?? 0
		});
	}

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		if (a.inventoryPriority !== b.inventoryPriority) return a.inventoryPriority - b.inventoryPriority;
		if (a.priceDiff !== b.priceDiff) return a.priceDiff - b.priceDiff;
		return b.createdAtMs - a.createdAtMs;
	});

	const max =
		typeof options.maxResults === 'number' && options.maxResults > 0 ? options.maxResults : 3;
	return scored.slice(0, max).map((item) => item.property);
}
