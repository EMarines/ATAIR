import { json } from '@sveltejs/kit';
import { sendTemplateMessage } from '$lib/services/whatsapp';
import { env } from '$env/dynamic/private';
import { getProposalUrl, ensureContactInProposalUrl } from '$lib/functions/urlUtils';
import { isStage3Or4ForBroadcast } from '$lib/functions/contactBadge';
import { capitalize } from '$lib/functions/capitalize';
import { formatZona } from '$lib/functions/tagConverters';

/**
 * Normaliza un número telefónico para Meta WhatsApp Cloud API (formato E.164 sin '+').
 * En México: 10 dígitos -> '52' + 10 dígitos; '521' + 10 dígitos -> '52' + 10 dígitos.
 */
function formatPhoneForMeta(rawPhone: string): string {
	const digits = String(rawPhone || '').replace(/\D/g, '');
	if (digits.length === 10) {
		return `52${digits}`;
	}
	if (digits.length === 13 && digits.startsWith('521')) {
		return `52${digits.slice(3)}`;
	}
	return digits;
}

/**
 * Limpia saltos de línea, tabulaciones y espacios múltiples prohibidos por Meta Graph API (#132018).
 */
function sanitizeParam(value: any, fallback: string): string {
	const cleaned = String(value ?? '')
		.replace(/[\r\n\t]+/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
	return cleaned || fallback;
}

/**
 * Extrae una ubicación legible (Colonia o Zona) para la plantilla nuevo_inventario_match.
 */
function resolvePropertyLocation(property: any): string {
	if (!property) return 'tu zona de interés';

	let raw = '';
	if (typeof property.colonia === 'string' && property.colonia.trim()) {
		raw = property.colonia;
	} else if (typeof property.location === 'string' && property.location.trim()) {
		raw = property.location;
	} else if (property.location && typeof property.location.name === 'string') {
		raw = property.location.name;
	} else if (typeof property.ubicacion === 'string' && property.ubicacion.trim()) {
		raw = property.ubicacion;
	}

	const cleaned = raw
		.replace(/,?\s*Chihuahua,?\s*Chihuahua/gi, '')
		.replace(/,?\s*Chihuahua/gi, '')
		.replace(/^colonia\s+/i, '')
		.replace(/^col\.?\s+/i, '')
		.trim();

	if (cleaned) {
		return sanitizeParam(cleaned, 'tu zona de interés');
	}

	const zona = formatZona(property);
	if (zona) {
		return sanitizeParam(`Zona ${zona}`, 'tu zona de interés');
	}

	return 'Chihuahua';
}

export async function POST({ request }) {
	try {
		const { contact, property, mode, templateName } = await request.json();

		if (!contact || !contact.telephon) {
			return json({ success: false, error: 'Falta el teléfono del contacto.' }, { status: 400 });
		}

		// Candado estricto de negocio para envíos masivos de propiedades: SOLO Etapas 3 y 4
		if (mode === 'broadcast' && !isStage3Or4ForBroadcast(contact)) {
			return json(
				{
					success: false,
					error:
						'Envío bloqueado por regla de negocio: Los envíos masivos solo están permitidos para contactos activos en Etapa 3 y Etapa 4.'
				},
				{ status: 403 }
			);
		}

		const to = formatPhoneForMeta(contact.telephon);
		if (to.length < 10) {
			return json(
				{ success: false, error: `Número telefónico inválido (${contact.telephon}).` },
				{ status: 400 }
			);
		}

		const rawFirstName = String(contact.name || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
		const firstName = sanitizeParam(capitalize(rawFirstName), 'Cliente');

		const template = templateName || env.TEMPLATE_NAME || 'nuevo_inventario_match';
		let lang = 'es_MX';
		let components: any[] = [];

		const isNewContact = (contact as any)?.isNew ?? !contact?.id;
		const contactIdentifier = isNewContact
			? contact?.name || contact?.id
			: contact?.id || contact?.name;

		const propertyLink = property?.public_id
			? getProposalUrl(property.public_id, contactIdentifier)
			: ensureContactInProposalUrl(contact?.publicUrl, contactIdentifier) ||
				'https://matchhome.vercel.app';

		if (template === 'hello_world') {
			lang = 'en_US';
			components = [];
		} else if (template === 'nuevo_inventario_match') {
			lang = 'es_MX';
			const locationText = resolvePropertyLocation(property);
			const priceNum = Number(property?.price || 0);
			const formattedPrice =
				priceNum > 0
					? `$${new Intl.NumberFormat('es-MX').format(priceNum)}`
					: 'precio de oportunidad';

			components = [
				{
					type: 'body',
					parameters: [
						{ type: 'text', text: firstName },
						{ type: 'text', text: locationText },
						{ type: 'text', text: sanitizeParam(formattedPrice, 'precio de oportunidad') },
						{ type: 'text', text: sanitizeParam(propertyLink, 'https://matchhome.vercel.app') }
					]
				}
			];
		} else if (template === 'reactivacion_permiso_matchhome') {
			lang = 'es_MX';
			const rawZone =
				Array.isArray(contact.locaProperty) && contact.locaProperty.length > 0
					? capitalize(String(contact.locaProperty[0]))
					: resolvePropertyLocation(property);

			components = [
				{
					type: 'body',
					parameters: [
						{ type: 'text', text: firstName },
						{ type: 'text', text: sanitizeParam(rawZone, 'Chihuahua') }
					]
				}
			];
		} else {
			lang = 'es_MX';
			components = [
				{
					type: 'body',
					parameters: [
						{ type: 'text', text: firstName },
						{ type: 'text', text: sanitizeParam(property?.title || 'la propiedad', 'la propiedad') },
						{ type: 'text', text: sanitizeParam(propertyLink, 'https://matchhome.vercel.app') }
					]
				}
			];
		}

		const result = await sendTemplateMessage(to, template, lang, components);

		return json({
			success: true,
			template,
			to,
			data: result
		});
	} catch (error: any) {
		console.error('[API WhatsApp] Error:', error);
		return json(
			{ success: false, error: error?.message || 'Error interno al enviar WhatsApp.' },
			{ status: 500 }
		);
	}
}
