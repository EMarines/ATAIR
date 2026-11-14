import type { Contact } from '$lib/types';

export interface ContactBadgeInfo {
	isAgent: boolean;
	shape: 'circle' | 'square';
	text: string;
	color: string;
	tooltip: string;
}

export function normalizeStage(stage: any): number | string {
	if (typeof stage === 'string') {
		const s = stage.trim().toUpperCase();
		if (s === 'NA') return 'NA';
		if (s.startsWith('A1')) return 'A1';
		if (s.startsWith('A2')) return 'A2';
		if (s === 'CIERRE') return 5;
		if (s.startsWith('POST')) return 6;
		if (s.startsWith('ETAPA')) {
			const num = parseInt(s.replace('ETAPA', '').trim(), 10) || 1;
			return num <= 0 ? 1 : num;
		}
		if (s.startsWith('E')) {
			const num = parseInt(s.replace('E', '').trim(), 10) || 1;
			return num <= 0 ? 1 : num;
		}
		const num = parseInt(s, 10) || 1;
		return num <= 0 ? 1 : num;
	}

	if (stage === undefined || stage === null || stage === 0) return 1;

	if (typeof stage === 'number') {
		return stage <= 0 ? 1 : stage;
	}

	return 1;
}

export function getContactBadgeInfo(cont: Contact | null | undefined): ContactBadgeInfo {
	if (!cont) return { isAgent: false, shape: 'circle', text: 'E1', color: '#ff4444', tooltip: 'Etapa 1' };
	const raw = cont as any;
	const type = (cont.typeContact || cont.contactType || raw.tipo || '').toLowerCase();
	const notes = (cont.notes || raw.comContact || raw.notas || '').toLowerCase();

	const isAgent = (
		type.includes('agente') ||
		type.includes('constructor') ||
		type.includes('inmobiliaria') ||
		type.includes('colaborador') ||
		type.includes('asesor') ||
		notes.includes('sinergia') ||
		notes.includes('agente') ||
		notes.includes('constructor') ||
		notes.includes('inmobiliaria') ||
		Boolean(cont.procedencia)
	);

	if (isAgent) {
		let code = (cont.procedencia || '').toUpperCase();
		if (!['S1', 'S2', 'S3', 'MH'].includes(code)) {
			if (notes.includes('sinergia 1') || /\b(s1)\b/i.test(notes)) code = 'S1';
			else if (notes.includes('sinergia 2') || /\b(s2)\b/i.test(notes)) code = 'S2';
			else if (notes.includes('sinergia 3') || /\b(s3)\b/i.test(notes)) code = 'S3';
			else if (notes.includes('match home') || /\b(mh)\b/i.test(notes)) code = 'MH';
			else code = 'S1';
		}

		const roleLabel = type.includes('constructor') ? 'Constructor' : 'Agente Inmobiliario';

		switch (code) {
			case 'S1':
				return { isAgent: true, shape: 'square', text: 'S1', color: '#10b981', tooltip: `${roleLabel} - Sinergia 1 (S1)` };
			case 'S2':
				return { isAgent: true, shape: 'square', text: 'S2', color: '#06b6d4', tooltip: `${roleLabel} - Sinergia 2 (S2)` };
			case 'S3':
				return { isAgent: true, shape: 'square', text: 'S3', color: '#f59e0b', tooltip: `${roleLabel} - Sinergia 3 (S3)` };
			case 'MH':
				return { isAgent: true, shape: 'square', text: 'MH', color: '#6366f1', tooltip: `${roleLabel} - Directa Match Home` };
			default:
				return { isAgent: true, shape: 'square', text: code || 'S1', color: '#10b981', tooltip: roleLabel };
		}
	}

	// Arrendatarios / Leads de Renta (A1: Primer Contacto, A2: Búsqueda con Sinergias)
	const isArrendatario = (
		type.includes('arrendatario') ||
		type.includes('inquilino') ||
		raw.tipoOperacion === 'Renta' ||
		raw.typeOperation === 'Renta' ||
		notes.includes('arrendatario') ||
		notes.includes('interesado por un local')
	);

	if (isArrendatario) {
		const rawStage = String(cont.contactStage || '').toUpperCase().trim();
		let text = 'A1';
		let tooltip = 'Arrendatario - A1: Primer Contacto';

		if (rawStage.includes('A2') || rawStage.includes('SINERGIA') || rawStage === '4' || rawStage === 'ETAPA 4') {
			text = 'A2';
			tooltip = 'Arrendatario - A2: Búsqueda con Sinergias';
		} else if (rawStage.includes('A1') || rawStage === '1' || rawStage === 'ETAPA 1') {
			text = 'A1';
			tooltip = 'Arrendatario - A1: Primer Contacto';
		} else if (rawStage.startsWith('A')) {
			text = rawStage;
			tooltip = text === 'A2' ? 'Arrendatario - A2: Búsqueda con Sinergias' : 'Arrendatario - A1: Primer Contacto';
		}

		return {
			isAgent: false,
			shape: 'circle',
			text,
			color: text === 'A2' ? '#0284c7' : '#0ea5e9',
			tooltip
		};
	}

	const normalizedStage = normalizeStage(cont.contactStage);
	if (normalizedStage === 'NA') {
		return { isAgent: false, shape: 'circle', text: 'NA', color: '#808080', tooltip: 'Sin etapa asignada' };
	}
	switch (normalizedStage) {
		case 2:
			return { isAgent: false, shape: 'circle', text: 'E2', color: '#ff8844', tooltip: 'Etapa 2' };
		case 3:
			return { isAgent: false, shape: 'circle', text: 'E3', color: '#ffcc44', tooltip: 'Etapa 3' };
		case 4:
			return { isAgent: false, shape: 'circle', text: 'E4', color: '#44cc44', tooltip: 'Etapa 4' };
		case 5:
			return { isAgent: false, shape: 'circle', text: 'E5', color: '#8844cc', tooltip: 'Etapa 5' };
		default:
			return { isAgent: false, shape: 'circle', text: `E${normalizedStage}`, color: '#ff4444', tooltip: 'Etapa 1' };
	}
}

function isEligibleLeadBase(cont: Contact | null | undefined): ContactBadgeInfo | null {
	if (!cont) return null;
	if (cont.isActive === false) return null;

	const raw = cont as any;
	const type = String(cont.typeContact || cont.contactType || raw.tipo || '').toLowerCase();
	if (type.includes('vendedor') || type.includes('propietario') || type.includes('arrendador')) {
		return null;
	}

	const cleanPhone = String(cont.telephon || '').replace(/\D/g, '');
	if (cleanPhone.length < 10) return null;

	const badge = getContactBadgeInfo(cont);
	if (badge.isAgent) return null;

	return badge;
}

/**
 * Extrae el timestamp en milisegundos de `createdAt` soportando milisegundos, segundos Unix,
 * strings ISO/numéricos o Firestore Timestamp.
 */
export function getContactCreatedAtMs(rawCreatedAt: any): number | null {
	if (rawCreatedAt === undefined || rawCreatedAt === null || rawCreatedAt === '') return null;

	if (typeof rawCreatedAt === 'number' && Number.isFinite(rawCreatedAt)) {
		if (rawCreatedAt <= 0) return null;
		return rawCreatedAt < 1e11 ? rawCreatedAt * 1000 : rawCreatedAt;
	}

	if (typeof rawCreatedAt === 'object') {
		if (typeof rawCreatedAt.toMillis === 'function') {
			const ms = rawCreatedAt.toMillis();
			return Number.isFinite(ms) && ms > 0 ? ms : null;
		}
		if (typeof rawCreatedAt.seconds === 'number') {
			return rawCreatedAt.seconds * 1000;
		}
	}

	if (typeof rawCreatedAt === 'string') {
		const trimmed = rawCreatedAt.trim();
		if (!trimmed) return null;
		if (/^\d+(\.\d+)?$/.test(trimmed)) {
			const num = Number(trimmed);
			return num > 0 ? (num < 1e11 ? num * 1000 : num) : null;
		}
		const parsed = Date.parse(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

/**
 * Valida que el contacto tenga como máximo `maxYears` años desde su fecha de alta (`createdAt`).
 */
export function isWithinMaxAgeYears(
	cont: Contact | null | undefined,
	maxYears: number = 2,
	nowMs: number = Date.now()
): boolean {
	if (!cont) return false;
	const createdMs = getContactCreatedAtMs((cont as any).createdAt);
	if (createdMs === null) return false;

	const cutoff = new Date(nowMs);
	cutoff.setFullYear(cutoff.getFullYear() - maxYears);
	return createdMs >= cutoff.getTime();
}

/**
 * Valida perfil base de Etapa 4 (E4) antes de aplicar el límite de antigüedad.
 */
export function isStage4Base(cont: Contact | null | undefined): boolean {
	const badge = isEligibleLeadBase(cont);
	return badge !== null && badge.text === 'E4';
}

/**
 * Valida estrictamente si un contacto es elegible para difusión de propiedades (Manual o WhatsApp Cloud API).
 * Regla de Negocio Inquebrantable:
 * 1) SOLO contactos activos de Comprador/Cliente en Etapa 4 (E4).
 * 2) Antigüedad máxima de 2 años desde su alta (`createdAt`).
 * Quedan excluidos: Etapa 1, Etapa 2, Etapa 3, Cierre, Post-Venta, Vendedores, Arrendadores, Agentes y Arrendatarios,
 * así como contactos con más de 2 años desde su registro.
 */
export function isStage4ForBroadcast(cont: Contact | null | undefined): boolean {
	return isStage4Base(cont) && isWithinMaxAgeYears(cont, 2);
}

/**
 * Valida contactos en Etapa 3 o Etapa 4 (reservado exclusivamente para plantillas de reactivación E3).
 */
export function isStage3Or4ForBroadcast(cont: Contact | null | undefined): boolean {
	const badge = isEligibleLeadBase(cont);
	return badge !== null && (badge.text === 'E3' || badge.text === 'E4');
}
