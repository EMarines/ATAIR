import type { Property } from '$lib/types';
import { getProposalUrl } from './urlUtils';
import { formatZona, tagToUbicacion } from './tagConverters';

/**
 * Normaliza cualquier formato de documento de propiedad de Firestore (inglés o español)
 * al formato estándar de la interfaz Property que espera la UI.
 */
export function normalizeProperty(raw: any, docId?: string): Property {
	if (!raw) return {} as Property;

	// Identificador
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

	// Zona Geográfica (Centronorte, Centrosur, Norte, etc.)
	const zonaGeografica = formatZona(raw) || '';
	const locaProperty = Array.isArray(raw.locaProperty) && raw.locaProperty.length > 0
		? raw.locaProperty
		: (zonaGeografica ? [zonaGeografica] : []);

	// Ubicación / Colonia / Dirección física
	let location: string = 'Sin Dirección';
	if (typeof raw.colonia === 'string' && raw.colonia.trim() !== '') {
		location = raw.colonia;
	} else if (typeof raw.location === 'string' && raw.location.trim() !== '') {
		location = raw.location;
	} else if (raw.location && typeof raw.location === 'object' && raw.location.name) {
		location = raw.location.name;
	} else if (typeof raw.direccion === 'string' && raw.direccion.trim() !== '') {
		location = raw.direccion;
	} else if (typeof raw.ubicacion === 'string' && raw.ubicacion.trim() !== '' && !tagToUbicacion(raw.ubicacion)) {
		location = raw.ubicacion;
	} else if (zonaGeografica) {
		location = zonaGeografica;
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
	} else if (Array.isArray(raw.property_images) && raw.property_images[0]?.url) {
		title_image_thumb = raw.property_images[0].url;
	} else if (Array.isArray(raw.property_images) && typeof raw.property_images[0] === 'string') {
		title_image_thumb = raw.property_images[0];
	} else if (Array.isArray(raw.images) && raw.images[0]?.url) {
		title_image_thumb = raw.images[0].url;
	} else if (Array.isArray(raw.images) && typeof raw.images[0] === 'string') {
		title_image_thumb = raw.images[0];
	} else if (Array.isArray(raw.fotos) && typeof raw.fotos[0] === 'string') {
		title_image_thumb = raw.fotos[0];
	} else if (Array.isArray(raw.photos) && raw.photos[0]?.url) {
		title_image_thumb = raw.photos[0].url;
	}

	// Recámaras
	const bedrooms = Number(
		raw.bedrooms ?? raw.recamaras ?? raw.habitaciones ?? raw.beds ?? raw.numBeds ?? 0
	);

	// Baños
	const bathrooms = Number(
		raw.bathrooms ?? raw.banos ?? raw.baños ?? raw.bathroom ?? raw.numBaths ?? 0
	);

	// Medios Baños
	const half_bathrooms = Number(
		raw.half_bathrooms ?? raw.mediosBanos ?? raw.medioBano ?? raw.halfBathroom ?? 0
	);

	// Estacionamientos
	const parking_spaces = Number(
		raw.parking_spaces ?? raw.estacionamientos ?? raw.cocheras ?? raw.park ?? raw.numParks ?? 0
	);

	// Construcción
	const construction_size = Number(
		raw.construction_size ?? raw.construccion ?? raw.areaBuilding ?? 0
	);

	// Terreno
	const lot_size = Number(raw.lot_size ?? raw.terreno ?? raw.areaTotal ?? 0);

	// Tipo de Propiedad
	const property_type =
		raw.property_type || raw.tipoPropiedad || raw.tipo || raw.selecTP || 'Propiedad';

	// Tipo de Operación
	const selecTO = raw.selecTO || raw.tipoOperacion || raw.operations?.[0]?.type || 'sale';

	// Título y Descripción
	const title = raw.title || raw.titulo || raw.nameProperty || `${property_type} en ${location}`;
	const description = raw.description || raw.descripcion || '';

	// Agente
	const agent = raw.agent || raw.agente || '';

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
			created_at = rawCreated.seconds * 1000 + Math.round((rawCreated.nanoseconds || 0) / 1e6);
		} else if (typeof rawCreated === 'string') {
			const parsedTime = new Date(rawCreated).getTime();
			if (!isNaN(parsedTime)) {
				created_at = parsedTime;
			}
		}
	}

	let updated_at: any = new Date().toISOString();
	const rawUpdated = raw.updated_at ?? raw.updatedAt;
	if (rawUpdated) {
		if (typeof rawUpdated === 'number') {
			updated_at = rawUpdated;
		} else if (typeof rawUpdated.toMillis === 'function') {
			updated_at = rawUpdated.toMillis();
		} else if (typeof rawUpdated.toDate === 'function') {
			updated_at = rawUpdated.toDate().getTime();
		} else if (typeof rawUpdated.seconds === 'number') {
			updated_at = rawUpdated.seconds * 1000;
		} else if (typeof rawUpdated === 'string') {
			updated_at = rawUpdated;
		}
	}

	// Origen / Fuente de la propiedad
	const rawKey = String(public_id || raw.clavePropiedad || raw.claveEB || '');
	const isEB = raw.source === 'easybroker' || rawKey.startsWith('EB-');
	const isSyn = !isEB && (raw.source === 'synergy' || raw.procedencia === 'S1' || raw.procedencia === 'S2' || raw.procedencia === 'S3' || rawKey.startsWith('S1-') || rawKey.startsWith('S2-') || rawKey.startsWith('S3-'));
	
	let source = raw.source || (isEB ? 'easybroker' : (isSyn ? 'synergy' : 'direct'));
	if (source === 'manual') source = isSyn ? 'synergy' : 'direct';

	let sourceName = raw.sourceName || (
		source === 'easybroker'
			? 'MatchHome (EasyBroker)'
			: (source === 'synergy'
				? `Sinergia (${raw.procedencia || 'Red'})`
				: 'Captura Directa (Manual)')
	);
	let isOwn = raw.isOwn !== undefined ? Boolean(raw.isOwn) : (source === 'easybroker' || source === 'direct');

	return {
		...raw,
		id: docId || raw.id || public_id,
		docId: docId || raw.docId || raw.id || '',
		public_id,
		price,
		budget: price,
		location,
		colonia: location,
		zona: zonaGeografica,
		ubicacion: zonaGeografica || location,
		locaProperty,
		title_image_thumb,
		bedrooms,
		bathrooms,
		half_bathrooms,
		parking_spaces,
		construction_size,
		lot_size,
		property_type,
		selecTP: property_type,
		selecTO,
		title,
		description,
		agent,
		created_at,
		updated_at,
		property_status: raw.property_status || 'available',
		public_url: public_id ? getProposalUrl(public_id) : (raw.public_url || ''),
		tags: Array.isArray(raw.tags) ? raw.tags : [],
		range: raw.range || '',
		selecMC: raw.selecMC || '',
		source,
		sourceName,
		isOwn
	};
}
