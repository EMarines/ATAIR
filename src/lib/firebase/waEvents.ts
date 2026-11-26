import {
	collection,
	doc,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	query,
	setDoc,
	type Firestore,
	type Unsubscribe
} from 'firebase/firestore';
import {
	getDownloadURL,
	ref,
	uploadBytes,
	type FirebaseStorage
} from 'firebase/storage';
import type { WaAttachment, WaEvent } from '$lib/types';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB por adjunto WA

export interface IncomingWaMediaInput {
	base64?: string;
	url?: string;
	authHeader?: string;
	mimeType?: string;
	filename?: string;
	mediaType?: string;
}

export interface SaveWaEventParams {
	db: Firestore;
	storageInstance?: FirebaseStorage | null;
	contactId: string;
	event: Omit<WaEvent, 'id' | 'contactId' | 'hasAttachments' | 'createdAt'> & {
		id?: string;
		createdAt?: number;
	};
	incomingMedia?: IncomingWaMediaInput[];
	syncBinnacle?: boolean;
	binnacleAction?: string;
}

/**
 * Genera un ID determinístico para wa_events y binnacles evitando duplicados ante reintentos.
 */
export function buildWaEventId(
	direction: 'inbound' | 'outbound',
	messageId?: string,
	fallbackTs: number = Date.now(),
	contactId?: string
): string {
	const prefix = direction === 'outbound' ? 'waout' : 'wain';
	const cleanMsgId = String(messageId || '')
		.replace(/[^a-zA-Z0-9_-]/g, '')
		.slice(-48);
	const uniquePart = cleanMsgId || `${fallbackTs}`;
	return contactId ? `${prefix}_${contactId}_${uniquePart}` : `${prefix}_${uniquePart}`;
}

/**
 * Normaliza el nombre de archivo para rutas seguras en Firebase Storage.
 */
export function sanitizeWaFilename(filename?: string, mimeType?: string): string {
	const clean = String(filename || '')
		.trim()
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/_+/g, '_');

	if (clean && clean !== '_' && clean !== '.') {
		return clean.slice(-80);
	}

	const extMap: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'application/pdf': 'pdf',
		'audio/ogg': 'ogg',
		'audio/mpeg': 'mp3',
		'audio/mp4': 'm4a',
		'video/mp4': 'mp4'
	};
	const normalizedMime = String(mimeType || '').split(';')[0].trim().toLowerCase();
	const ext = extMap[normalizedMime] || 'bin';
	return `archivo_${Date.now()}.${ext}`;
}

/**
 * Construye la ruta estándar en Firebase Storage por contacto y evento.
 */
export function buildWaStoragePath(
	contactId: string,
	eventId: string,
	filename?: string,
	mimeType?: string
): string {
	const safeContact = String(contactId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
	const safeEvent = String(eventId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
	const safeFile = sanitizeWaFilename(filename, mimeType);
	return `wa_media/${safeContact}/${safeEvent}_${safeFile}`;
}

/**
 * Decodifica una cadena base64 (o Data URL) a Uint8Array compatible con Node y Browser.
 */
export function decodeBase64Payload(rawInput: string): {
	bytes: Uint8Array;
	detectedMimeType?: string;
} {
	const trimmed = String(rawInput || '').trim();
	const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
	const detectedMimeType = dataUrlMatch?.[1]?.trim();
	const base64Body = (dataUrlMatch?.[2] || trimmed).replace(/\s+/g, '');

	if (typeof Buffer !== 'undefined') {
		const buf = Buffer.from(base64Body, 'base64');
		return { bytes: new Uint8Array(buf), detectedMimeType };
	}

	const binary = atob(base64Body);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return { bytes, detectedMimeType };
}

/**
 * Sube un adjunto binario de WhatsApp a Firebase Storage y devuelve metadatos listos para Firestore.
 */
export async function uploadWaAttachmentToStorage(params: {
	storageInstance: FirebaseStorage;
	contactId: string;
	eventId: string;
	bytes: Uint8Array;
	mimeType?: string;
	filename?: string;
	mediaType?: string;
}): Promise<WaAttachment> {
	if (params.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
		throw new Error(
			`Adjunto excede el máximo permitido (${Math.round(params.bytes.byteLength / 1024 / 1024)} MB > 15 MB)`
		);
	}

	const contentType = String(params.mimeType || 'application/octet-stream')
		.split(';')[0]
		.trim();
	const safeFilename = sanitizeWaFilename(params.filename, contentType);
	const storagePath = buildWaStoragePath(params.contactId, params.eventId, safeFilename, contentType);
	const fileRef = ref(params.storageInstance, storagePath);

	const snapshot = await uploadBytes(fileRef, params.bytes, { contentType });
	const url = await getDownloadURL(snapshot.ref);

	return {
		url,
		path: storagePath,
		mimeType: contentType,
		filename: safeFilename,
		sizeBytes: params.bytes.byteLength,
		...(params.mediaType ? { mediaType: params.mediaType } : {})
	};
}

/**
 * Procesa adjuntos entrantes (base64 o URL remota) y los persiste en Firebase Storage cuando está disponible.
 */
export async function stageWaMediaAttachments(params: {
	storageInstance?: FirebaseStorage | null;
	contactId: string;
	eventId: string;
	incomingMedia?: IncomingWaMediaInput[];
}): Promise<WaAttachment[]> {
	const items = Array.isArray(params.incomingMedia) ? params.incomingMedia : [];
	if (!items.length || !params.storageInstance) {
		return [];
	}

	const uploaded: WaAttachment[] = [];

	for (const item of items) {
		try {
			let bytes: Uint8Array | null = null;
			let resolvedMime = item.mimeType || '';

			if (item.base64) {
				const decoded = decodeBase64Payload(item.base64);
				bytes = decoded.bytes;
				resolvedMime = resolvedMime || decoded.detectedMimeType || 'application/octet-stream';
			} else if (item.url && /^https?:\/\//i.test(item.url)) {
				const headers: Record<string, string> = {};
				if (item.authHeader) {
					headers.Authorization = item.authHeader;
				}
				const resp = await fetch(item.url, { headers });
				if (!resp.ok) {
					console.warn(`[waEvents] No se pudo descargar media (${resp.status}) desde ${item.url}`);
					continue;
				}
				const arrBuf = await resp.arrayBuffer();
				bytes = new Uint8Array(arrBuf);
				resolvedMime =
					resolvedMime || resp.headers.get('content-type') || 'application/octet-stream';
			}

			if (!bytes || bytes.byteLength === 0) continue;

			const attachment = await uploadWaAttachmentToStorage({
				storageInstance: params.storageInstance,
				contactId: params.contactId,
				eventId: params.eventId,
				bytes,
				mimeType: resolvedMime,
				filename: item.filename,
				mediaType: item.mediaType
			});
			uploaded.push(attachment);
		} catch (err) {
			console.warn('[waEvents] Error subiendo adjunto WA a Storage:', err);
		}
	}

	return uploaded;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
	const clean: Record<string, any> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) {
			clean[key] = value;
		}
	}
	return clean as T;
}

/**
 * Guarda un evento completo en /contacts/{contactId}/wa_events/{eventId}
 * y opcionalmente escribe su resumen compacto en la colección binnacles.
 */
export async function saveWaEventAndBinnacle(params: SaveWaEventParams): Promise<{
	eventId: string;
	binnacleId?: string;
	attachments: WaAttachment[];
}> {
	const { db, storageInstance, contactId, event, incomingMedia, syncBinnacle = true } = params;
	const timestampMs = Number(event.timestampMs) > 0 ? Math.floor(Number(event.timestampMs)) : Date.now();
	const eventId =
		event.id || buildWaEventId(event.direction, event.messageId, timestampMs, contactId);

	const uploadedAttachments = await stageWaMediaAttachments({
		storageInstance,
		contactId,
		eventId,
		incomingMedia
	});

	const existingAttachments = Array.isArray(event.attachments) ? event.attachments : [];
	const attachments = [...existingAttachments, ...uploadedAttachments];
	const primaryAttachment = attachments[0];
	const binnacleId = syncBinnacle ? event.binnacleId || eventId : event.binnacleId;

	const waEventDoc: WaEvent = stripUndefined({
		contactId,
		direction: event.direction,
		channel: event.channel || 'waba',
		messageType: event.messageType || 'text',
		messageId: event.messageId,
		fromPhone: event.fromPhone,
		toPhone: event.toPhone,
		recipientPhoneId: event.recipientPhoneId,
		recipientDisplayPhone: event.recipientDisplayPhone,
		text: event.text,
		summary: event.summary,
		timestampMs,
		attachments: attachments.length > 0 ? attachments : undefined,
		hasAttachments: attachments.length > 0,
		binnacleId,
		createdAt: event.createdAt || timestampMs,
		updatedAt: Date.now()
	});

	await setDoc(doc(db, 'contacts', contactId, 'wa_events', eventId), waEventDoc, { merge: true });

	if (syncBinnacle && binnacleId) {
		const defaultAction =
			event.direction === 'outbound' ? 'WhatsApp enviado: ' : 'WhatsApp recibido: ';
		const compactComment = event.summary
			? `${event.summary}${event.text && event.text !== event.summary ? ` — ${event.text}` : ''}`
			: event.text;

		const binnacleDoc = stripUndefined({
			to: contactId,
			date: timestampMs,
			action: params.binnacleAction || defaultAction,
			comment: compactComment.slice(0, 600),
			direction: event.direction,
			channel: event.channel || 'waba',
			messageType: event.messageType || 'text',
			fromPhone: event.fromPhone,
			messageId: event.messageId,
			recipientPhoneId: event.recipientPhoneId,
			recipientDisplayPhone: event.recipientDisplayPhone,
			waEventId: eventId,
			summary: event.summary,
			mediaUrl: primaryAttachment?.url,
			mediaPath: primaryAttachment?.path,
			mediaType: primaryAttachment?.mediaType || (primaryAttachment ? event.messageType : undefined),
			mediaMimeType: primaryAttachment?.mimeType,
			mediaFilename: primaryAttachment?.filename
		});

		await setDoc(doc(db, 'binnacles', binnacleId), binnacleDoc, { merge: true });
	}

	return {
		eventId,
		binnacleId,
		attachments
	};
}

/**
 * Obtiene los eventos de WhatsApp recientes de un contacto desde su subcolección.
 */
export async function getContactWaEvents(
	db: Firestore,
	contactId: string,
	maxItems: number = 100
): Promise<WaEvent[]> {
	if (!contactId) return [];
	const q = query(
		collection(db, 'contacts', contactId, 'wa_events'),
		orderBy('timestampMs', 'desc'),
		limit(maxItems)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as WaEvent) }));
}

/**
 * Suscripción en tiempo real a /contacts/{contactId}/wa_events.
 */
export function subscribeContactWaEvents(
	db: Firestore,
	contactId: string,
	onData: (events: WaEvent[]) => void,
	maxItems: number = 100
): Unsubscribe {
	if (!contactId) return () => {};
	const q = query(
		collection(db, 'contacts', contactId, 'wa_events'),
		orderBy('timestampMs', 'desc'),
		limit(maxItems)
	);
	return onSnapshot(q, (snap) => {
		const events = snap.docs.map((d) => ({ id: d.id, ...(d.data() as WaEvent) }));
		onData(events);
	});
}
