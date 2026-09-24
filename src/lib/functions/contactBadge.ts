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
	}

	if (stage === undefined || stage === null || stage === 0) return 1;

	if (typeof stage === 'number') {
		return stage <= 0 ? 1 : stage;
	}

	if (typeof stage === 'string') {
		if (stage.startsWith('Etapa')) {
			const num = parseInt(stage.replace('Etapa', '')) || 1;
			return num <= 0 ? 1 : num;
		}
		if (stage.startsWith('E')) {
			const num = parseInt(stage.replace('E', '')) || 1;
			return num <= 0 ? 1 : num;
		}
		const num = parseInt(stage) || 1;
		return num <= 0 ? 1 : num;
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
