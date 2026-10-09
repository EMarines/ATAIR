// src/lib/functions/matchingEngine.ts
// Motor Canónico de Matching Inverso: Propiedad -> Contactos Calificados (ATAIR CRM)

import type { Property, Contact } from '$lib/types';

export interface MatchResult {
	contact: Contact;
	score: number; // 0 a 100
	grade: 'elite' | 'qualified' | 'partial' | 'low';
	gradeLabel: string;
	reasons: string[];
	isRecommended: boolean;
}

/**
 * Calcula la afinidad entre una propiedad y un prospecto considerando perfil rápido y perfilamiento profundo (Etapa 2).
 */
export function calculatePropertyContactMatch(property: Property, contact: Contact): MatchResult {
	const reasons: string[] = [];
	let score = 0;

	// 1. Tipo de Operación (Filtro Descalificador Estricto)
	const propOp = String(property.tipoOperacion || property.operation_type || 'venta').toLowerCase();
	const isPropRental = propOp.includes('rent');
	const isContactTenant = String(contact.typeContact || '').toLowerCase().includes('arrendat') || contact.contactStage === 'A1' || contact.contactStage === 'A2';

	if (isPropRental && !isContactTenant) {
		// Casa en renta pero cliente busca compra
		return {
			contact,
			score: 0,
			grade: 'low',
			gradeLabel: 'Incompatible (Renta vs Compra)',
			reasons: ['El cliente busca comprar y la propiedad es en arrendamiento.'],
			isRecommended: false
		};
	}

	if (!isPropRental && isContactTenant) {
		// Casa en venta pero cliente busca renta
		return {
			contact,
			score: 0,
			grade: 'low',
			gradeLabel: 'Incompatible (Compra vs Renta)',
			reasons: ['El cliente busca rentar y la propiedad es en venta.'],
			isRecommended: false
		};
	}

	score += 25;
	reasons.push(isPropRental ? 'Operación de Renta coincidente' : 'Operación de Compraventa coincidente');

	// 2. Ciudad / Plaza
	const propCity = String(property.city_id || property.plaza || 'cuu').toLowerCase();
	const contactCity = String(contact.city_id || 'cuu').toLowerCase();

	if (propCity && contactCity) {
		if (propCity === contactCity) {
			score += 25;
			reasons.push(propCity === 'del' ? 'Plaza Delicias' : 'Plaza Chihuahua capital');
		} else {
			// Plazas distintas descalifican
			return {
				contact,
				score: 10,
				grade: 'low',
				gradeLabel: 'Plaza Diferente',
				reasons: ['Ubicación en plaza diferente.'],
				isRecommended: false
			};
		}
	} else {
		score += 15;
	}

	// 3. Presupuesto vs Precio
	const propPrice = Number(property.price || property.precio || 0);
	const rawBudget = contact.presupuestoMax || contact.budget || contact.montoAutorizado || contact.budgetTope;
	const contactBudget = typeof rawBudget === 'number' 
		? rawBudget 
		: Number(String(rawBudget || '').replace(/\D/g, '')) || 0;

	if (contactBudget > 0 && propPrice > 0) {
		const ratio = propPrice / contactBudget;
		if (ratio >= 0.70 && ratio <= 1.05) {
			score += 30;
			reasons.push(`Precio exacto dentro del presupuesto ($${propPrice.toLocaleString('es-MX')})`);
		} else if (ratio > 1.05 && ratio <= 1.15) {
			score += 20;
			reasons.push(`Precio con ligera tolerancia +15% ($${propPrice.toLocaleString('es-MX')})`);
		} else if (ratio < 0.70 && ratio >= 0.50) {
			score += 15;
			reasons.push('Precio por debajo del tope presupuestal');
		} else {
			score += 5;
			reasons.push('Desfase en rango presupuestal');
		}
	} else {
		score += 15; // Neutral si el lead aún no declara presupuesto exacto
	}

	// 4. Perfilamiento Total (Etapa 2 - Calificación Financiera y Gustos)
	// 4.1 Estatus Financiero
	if (contact.estatusCredito === 'Autorizado' || contact.metodoPago === 'Contado') {
		score += 10;
		reasons.push(`Comprador Calificado (${contact.metodoPago || 'Recurso Listo'})`);
	} else if (contact.estatusCredito === 'En Trámite') {
		score += 5;
	}

	// 4.2 Zonas de Interés
	if (contact.zonasInteres && property.colonia) {
		const desiredZones = contact.zonasInteres.toLowerCase();
		const propColonia = property.colonia.toLowerCase();
		if (desiredZones.includes(propColonia) || propColonia.includes(desiredZones)) {
			score += 10;
			reasons.push(`Zona de interés prioritaria: ${property.colonia}`);
		}
	}

	// 4.3 Requisitos Físicos (Recámaras y Plantas)
	if (contact.recamarasMin && property.bedrooms) {
		if (Number(property.bedrooms) >= Number(contact.recamarasMin)) {
			score += 5;
			reasons.push(`Cumple recámaras mínimas (${property.bedrooms} habs)`);
		}
	}

	// 4.4 Urgencia
	if (contact.urgenciaCompra && contact.urgenciaCompra.includes('<30d')) {
		score += 5;
		reasons.push('Urgencia de compra inmediata (<30 días)');
	}

	// Normalizar entre 0 y 100
	const finalScore = Math.min(100, Math.max(0, score));

	let grade: 'elite' | 'qualified' | 'partial' | 'low' = 'low';
	let gradeLabel = 'Baja Afinidad';

	if (finalScore >= 85) {
		grade = 'elite';
		gradeLabel = 'Match Élite (Alta Probabilidad)';
	} else if (finalScore >= 70) {
		grade = 'qualified';
		gradeLabel = 'Match Calificado';
	} else if (finalScore >= 50) {
		grade = 'partial';
		gradeLabel = 'Match Parcial';
	}

	return {
		contact,
		score: finalScore,
		grade,
		gradeLabel,
		reasons,
		isRecommended: finalScore >= 65
	};
}

/**
 * Escanea una lista de contactos y devuelve los que hacen match con la propiedad ordenados de mayor a menor afinidad.
 */
export function matchPropertyAgainstContacts(property: Property, contacts: Contact[]): MatchResult[] {
	return contacts
		.map((c) => calculatePropertyContactMatch(property, c))
		.filter((res) => res.score >= 45) // Descartar los totalmente incompatibles
		.sort((a, b) => b.score - a.score);
}
