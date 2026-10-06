// src/lib/functions/normalizeProperty.ts
// Normalizador canónico de propiedades para ATAIR CRM

import type { Property } from '$lib/types';
import { getProposalUrl } from './urlUtils';

export const CANONICAL_UBICACIONES = [
	'norte',
	'noreste',
	'noroeste',
	'oeste',
	'este',
	'centronorte',
	'centrosur',
	'sureste',
	'suroeste',
	'sur'
];

export function tagToUbicacion(input: any): string | null {
	if (!input) return null;

	if (typeof input === 'object' && !Array.isArray(input)) {
		if (input.ubicacion && typeof input.ubicacion === 'string') {
			const z = tagToUbicacion(input.ubicacion);
			if (z) return z;
		}
		if (input.zona && typeof input.zona === 'string') {
			const z = tagToUbicacion(input.zona);
			if (z) return z;
		}
		if (Array.isArray(input.locaProperty) && input.locaProperty.length > 0) {
			const z = tagToUbicacion(input.locaProperty);
			if (z) return z;
		}
		if (Array.isArray(input.tags) && input.tags.length > 0) {
			const z = tagToUbicacion(input.tags);
			if (z) return z;
		}
		if (typeof input.location === 'string') {
			const z = tagToUbicacion(input.location);
			if (z) return z;
		}
		return null;
	}

	if (Array.isArray(input)) {
		for (const item of input) {
			const z = tagToUbicacion(item);
			if (z) return z;
		}
		return null;
	}

	if (typeof input === 'string') {
		const clean = input.toLowerCase().trim();
		const norm = clean.replace(/[\s\-_]+/g, '');
		if (CANONICAL_UBICACIONES.includes(norm)) {
			return norm;
		}
		for (const u of CANONICAL_UBICACIONES) {
			if (norm.includes(u)) {
				return u;
			}
		}
	}

	return null;
}

export function formatZona(zonaOrProp: any): string {
	const rawZona = tagToUbicacion(zonaOrProp);
	if (!rawZona) return '';

	const map: Record<string, string> = {
		centronorte: 'Centronorte',
		centrosur: 'Centrosur',
		norte: 'Norte',
		sur: 'Sur',
		noreste: 'Noreste',
		noroeste: 'Noroeste',
		este: 'Este',
		oeste: 'Oeste',
		sureste: 'Sureste',
		suroeste: 'Suroeste'
	};
	return map[rawZona.toLowerCase()] || (rawZona.charAt(0).toUpperCase() + rawZona.slice(1));
}

export function getLocationString(propOrLoc: any): string {
	if (!propOrLoc) return '';
	let rawStr = '';
	if (typeof propOrLoc === 'string') {
		rawStr = propOrLoc;
	} else if (typeof propOrLoc === 'object') {
		if (typeof propOrLoc.name === 'string' && propOrLoc.name) {
			rawStr = propOrLoc.name;
		} else if (typeof propOrLoc.location === 'string' && propOrLoc.location) {
			rawStr = propOrLoc.location;
		} else if (typeof propOrLoc.location === 'object' && propOrLoc.location?.name) {
			rawStr = propOrLoc.location.name;
		} else if (typeof propOrLoc.colonia === 'string' && propOrLoc.colonia) {
			rawStr = propOrLoc.colonia;
		} else if (typeof propOrLoc.ubicacion === 'string' && propOrLoc.ubicacion) {
			rawStr = propOrLoc.ubicacion;
		} else if (typeof propOrLoc.direccion === 'string' && propOrLoc.direccion) {
			rawStr = propOrLoc.direccion;
		}
	}

	if (!rawStr) return '';

	return rawStr
		.replace(/,?\s*Chihuahua,?\s*Chihuahua/gi, '')
		.replace(/,?\s*Chihuahua/gi, '')
		.replaceAll(',', ', ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Normaliza cualquier formato de documento de propiedad de Firestore (inglés o español)
 * al formato estándar de la interfaz Property que espera la UI de ATAIR CRM.
 */
export function normalizeProperty(raw: any, docId?: string): Property {
	if (!raw) return {} as Property;

	// Identificador canónico
	const public_id =
		raw.public_id ||
		raw.id ||
		raw.clavePropiedad ||
		raw.easybroker_id ||
		raw.claveEB ||
		raw.claveMH ||
		docId ||
		'';

	// Precio
	let price = 0;
	if (typeof raw.price === 'number') {
		price = raw.price;
	} else if (typeof raw.precio === 'number') {
		price = raw.precio;
	} else if (raw.operations?.[0]?.amount) {
		price = Number(raw.operations[0].amount) || 0;
	} else if (raw.price) {
		price = Number(raw.price) || 0;
	} else if (raw.precio) {
		price = Number(raw.precio) || 0;
	} else if (raw.budget) {
		price = Number(raw.budget) || 0;
	}

	// Zona Geográfica
	const zonaGeografica = formatZona(raw) || '';
	const locaProperty =
		Array.isArray(raw.locaProperty) && raw.locaProperty.length > 0
			? raw.locaProperty
			: zonaGeografica
				? [zonaGeografica]
				: [];

	// Ubicación / Colonia
	let location: string = getLocationString(raw) || 'Chihuahua, Chih.';
	if (location === 'Sin Dirección' || !location) {
		location = zonaGeografica || 'Chihuahua, Chih.';
	}

	// Colección de imágenes
	let allImages: string[] = [];
	if (Array.isArray(raw.property_images)) {
		allImages = raw.property_images
			.map((img: any) => (typeof img === 'string' ? img : img?.url))
			.filter(Boolean);
	} else if (Array.isArray(raw.images)) {
		allImages = raw.images
			.map((img: any) => (typeof img === 'string' ? img : img?.url))
			.filter(Boolean);
	} else if (Array.isArray(raw.photos)) {
		allImages = raw.photos
			.map((img: any) => (typeof img === 'string' ? img : img?.url))
			.filter(Boolean);
	} else if (Array.isArray(raw.fotos)) {
		allImages = raw.fotos
			.map((img: any) => (typeof img === 'string' ? img : img?.url))
			.filter(Boolean);
	}

	// Imagen Principal
	let title_image_thumb = '/placeholder-property.png';
	if (typeof raw.title_image_thumb === 'string' && raw.title_image_thumb.trim() !== '') {
		title_image_thumb = raw.title_image_thumb;
	} else if (typeof raw.title_image_full === 'string' && raw.title_image_full.trim() !== '') {
		title_image_thumb = raw.title_image_full;
	} else if (typeof raw.urlImage === 'string' && raw.urlImage.trim() !== '') {
		title_image_thumb = raw.urlImage;
	} else if (typeof raw.imagenPrincipal === 'string' && raw.imagenPrincipal.trim() !== '') {
		title_image_thumb = raw.imagenPrincipal;
	} else if (typeof raw.imagen === 'string' && raw.imagen.trim() !== '') {
		title_image_thumb = raw.imagen;
	} else if (allImages.length > 0) {
		title_image_thumb = allImages[0];
	}

	if (allImages.length === 0 && title_image_thumb && title_image_thumb !== '/placeholder-property.png') {
		allImages.push(title_image_thumb);
	}

	// Especificaciones
	const bedrooms = Number(
		raw.bedrooms ?? raw.recamaras ?? raw.habitaciones ?? raw.beds ?? raw.numBeds ?? 0
	);
	const bathrooms = Number(
		raw.bathrooms ?? raw.banos ?? raw.baños ?? raw.bathroom ?? raw.numBaths ?? 0
	);
	const half_bathrooms = Number(
		raw.half_bathrooms ?? raw.mediosBanos ?? raw.medioBano ?? raw.halfBathroom ?? 0
	);
	const parking_spaces = Number(
		raw.parking_spaces ?? raw.estacionamientos ?? raw.cocheras ?? raw.park ?? raw.numParks ?? 0
	);
	const construction_size = Number(
		raw.construction_size ?? raw.construccion ?? raw.areaBuilding ?? 0
	);
	const lot_size = Number(raw.lot_size ?? raw.terreno ?? raw.areaTotal ?? 0);

	// Tipología y Operación
	const property_type =
		raw.property_type || raw.tipoPropiedad || raw.tipo || raw.selecTP || 'Propiedad';

	const rawOp = String(
		raw.selecTO || raw.tipoOperacion || raw.operations?.[0]?.type || raw.operation_type || 'sale'
	).toLowerCase();
	const isRental = rawOp.includes('rent') || rawOp.includes('arrend');
	const operation_type = isRental ? 'rental' : 'sale';
	const tipoOperacion = isRental ? 'Renta' : 'Venta';

	// Título y Descripción
	const title = raw.title || raw.titulo || raw.nameProperty || `${property_type} en ${location}`;
	const description = raw.description || raw.descripcion || '';

	// Fechas
	let created_at = 0;
	const rawCreated = raw.created_at ?? raw.createdAt ?? raw.fechaCreacion ?? raw.syncedAt;
	if (rawCreated) {
		if (typeof rawCreated === 'number') {
			created_at = rawCreated;
		} else if (typeof rawCreated.toMillis === 'function') {
			created_at = rawCreated.toMillis();
		} else if (typeof rawCreated.toDate === 'function') {
			created_at = rawCreated.toDate().getTime();
		} else if (typeof rawCreated.seconds === 'number') {
			created_at = rawCreated.seconds * 1000;
		} else if (typeof rawCreated === 'string') {
			const parsed = new Date(rawCreated).getTime();
			if (!isNaN(parsed)) created_at = parsed;
		}
	}

	// Origen / Fuente
	const rawKey = String(public_id || raw.clavePropiedad || raw.claveEB || '');
	const isEB = raw.source === 'easybroker' || rawKey.startsWith('EB-');
	const isSyn =
		!isEB &&
		(raw.source === 'synergy' ||
			raw.procedencia === 'S1' ||
			raw.procedencia === 'S2' ||
			raw.procedencia === 'S3' ||
			rawKey.startsWith('S1-') ||
			rawKey.startsWith('S2-') ||
			rawKey.startsWith('S3-'));

	let source = raw.source || (isEB ? 'easybroker' : isSyn ? 'synergy' : 'direct');
	if (source === 'manual') source = isSyn ? 'synergy' : 'direct';

	const sourceName =
		raw.sourceName ||
		(source === 'easybroker'
			? 'MatchHome (EasyBroker)'
			: source === 'synergy'
				? `Sinergia (${raw.procedencia || 'Red'})`
				: 'Captura Directa (Manual)');

	return {
		...raw,
		id: docId || raw.id || public_id,
		docId: docId || raw.docId || raw.id || '',
		public_id,
		clavePropiedad: public_id,
		price,
		budget: price,
		location,
		colonia: location,
		zona: zonaGeografica,
		ubicacion: zonaGeografica || location,
		locaProperty,
		title_image_thumb,
		images: allImages,
		bedrooms,
		bathrooms,
		half_bathrooms,
		parking_spaces,
		construction_size,
		lot_size,
		property_type,
		tipoPropiedad: property_type,
		operation_type,
		tipoOperacion,
		selecTO: operation_type,
		title,
		titulo: title,
		description,
		created_at,
		public_url: public_id ? getProposalUrl(public_id) : raw.public_url || '',
		source,
		sourceName
	};
}
