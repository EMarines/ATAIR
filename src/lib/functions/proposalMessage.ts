// src/lib/functions/proposalMessage.ts
// Generador canónico de mensajes ligeros de WhatsApp para propuestas de ATAIR CRM

import { getProposalUrl, type ContactUrlOptions } from './urlUtils';

/**
 * Frase conversacional dinámica según el tipo de inmueble:
 * "de la casa", "del departamento", "del terreno", etc.
 */
export function formatPropertyPhrase(rawType?: string, titleOrSearch?: string): string {
	const target = `${rawType || ''} ${titleOrSearch || ''}`.toLowerCase().trim();
	if (target.includes('casa de campo')) return 'de la casa de campo';
	if (target.includes('casa')) return 'de la casa';
	if (target.includes('departamento') || target.includes('depa')) return 'del departamento';
	if (target.includes('terreno') || target.includes('lote')) return 'del terreno';
	if (target.includes('bodega')) return 'de la bodega';
	if (target.includes('local')) return 'del local comercial';
	if (target.includes('oficina')) return 'de la oficina';
	if (target.includes('rancho') || target.includes('huerta')) return 'del rancho';
	if (target.includes('edificio')) return 'del edificio';
	if (target.includes('quinta')) return 'de la quinta';
	if (target.includes('nave')) return 'de la nave industrial';
	return 'de la propiedad';
}

/**
 * Capitalizar nombre propio respetando acentos (ej: "ENRIQUE" -> "Enrique")
 */
export function formatCapitalName(name?: string): string {
	if (!name) return '';
	const clean = name.trim();
	return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

export interface BuildMessageOptions {
	clientName?: string;
	propertyType?: string;
	propertyTitle?: string;
	propertyPublicId: string;
	contactOrIdentifier?: string | ContactUrlOptions | null;
	phone?: string | null;
	isFirstContact?: boolean; // True si es la primera vez (alta inicial)
}

/**
 * Genera el texto limpio y ligero de WhatsApp canónico acordado con Enrique Marines:
 *
 * Hola {Nombre}, gracias por contactarnos.
 * Te comparto la información {de la casa / del departamento} que te interesó:
 *
 * {https://matchhome.vercel.app/propuesta/EB-XXX?c=ID}
 *
 * Quedo al pendiente para cuando desees conocerla.
 */
export function buildProposalWhatsAppMessage(opts: BuildMessageOptions): {
	text: string;
	url: string;
	proposalUrl: string;
} {
	const cleanName = formatCapitalName(opts.clientName || 'Cliente');
	const phrase = formatPropertyPhrase(opts.propertyType, opts.propertyTitle);
	const proposalUrl = getProposalUrl(opts.propertyPublicId, opts.contactOrIdentifier, opts.phone);

	const saludo = opts.isFirstContact !== false
		? `Hola ${cleanName}, gracias por contactarnos.`
		: `Hola ${cleanName}, qué tal.`;

	const text = `${saludo} Te comparto la información ${phrase} que te interesó:

${proposalUrl}

Quedo al pendiente para cuando desees conocerla.`;

	const cleanPhone = opts.phone ? String(opts.phone).replace(/\D/g, '') : '';
	const waUrl = cleanPhone
		? `https://wa.me/52${cleanPhone.startsWith('52') ? cleanPhone.slice(2) : cleanPhone}?text=${encodeURIComponent(text)}`
		: '';

	return {
		text,
		url: waUrl,
		proposalUrl
	};
}
