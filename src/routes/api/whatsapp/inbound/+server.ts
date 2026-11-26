import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db, prodStorage, storage } from '$lib/firebase_toggle';
import {
	buildWaEventId,
	saveWaEventAndBinnacle,
	type IncomingWaMediaInput
} from '$lib/firebase/waEvents';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

/**
 * Extrae los últimos 10 dígitos de un número telefónico (estándar México / Chihuahua)
 */
function getLast10Digits(rawPhone: string | number | undefined | null): string {
	const digits = String(rawPhone ?? '').replace(/\D/g, '');
	if (digits.length >= 10) {
		return digits.slice(-10);
	}
	return digits;
}

/**
 * Genera las variantes de formato telefónico más comunes en la colección 'contacts'
 * para consultar Firestore con 'IN' usando 1 sola lectura por mensaje entrante.
 */
function buildPhoneVariants(last10: string): string[] {
	const p1 = last10.slice(0, 3);
	const p2 = last10.slice(3, 6);
	const p3 = last10.slice(6, 10);
	return [
		last10,
		`52${last10}`,
		`+52${last10}`,
		`521${last10}`,
		`+521${last10}`,
		`${p1} ${p2} ${p3}`,
		`${p1}-${p2}-${p3}`,
		`+52 ${p1} ${p2} ${p3}`
	];
}

export interface NormalizedInboundMessage {
	messageId: string;
	fromPhone: string;
	last10: string;
	text: string;
	summary?: string;
	timestampMs: number;
	messageType: string;
	direction: 'inbound' | 'outbound';
	channel: string;
	recipientPhoneId?: string;
	recipientDisplayPhone?: string;
	incomingMedia: IncomingWaMediaInput[];
	metaMediaId?: string;
	metaMediaMime?: string;
	metaMediaFilename?: string;
}

/**
 * Extrae el texto literal y referencias multimedia de cualquier tipo de mensaje de WhatsApp Cloud API
 */
function extractLiteralTextFromMetaMessage(msg: any): {
	text: string;
	messageType: string;
	metaMediaId?: string;
	metaMediaMime?: string;
	metaMediaFilename?: string;
} {
	const type = String(msg?.type || 'text').toLowerCase();

	if (type === 'text') {
		return {
			text: String(msg?.text?.body || '').trim(),
			messageType: 'text'
		};
	}

	if (type === 'button') {
		const btnText = String(msg?.button?.text || msg?.button?.payload || '').trim();
		return {
			text: btnText ? `[Botón seleccionado]: ${btnText}` : '[Respuesta de botón]',
			messageType: 'button'
		};
	}

	if (type === 'interactive') {
		const replyTitle =
			msg?.interactive?.button_reply?.title ||
			msg?.interactive?.list_reply?.title ||
			msg?.interactive?.button_reply?.id ||
			'';
		const replyDesc = msg?.interactive?.list_reply?.description
			? ` (${msg.interactive.list_reply.description})`
			: '';
		return {
			text: replyTitle ? `${replyTitle}${replyDesc}`.trim() : '[Respuesta interactiva]',
			messageType: 'interactive'
		};
	}

	if (type === 'image') {
		const caption = String(msg?.image?.caption || '').trim();
		return {
			text: caption ? `[Imagen recibida]: ${caption}` : '[Imagen recibida por WhatsApp]',
			messageType: 'image',
			metaMediaId: msg?.image?.id ? String(msg.image.id) : undefined,
			metaMediaMime: msg?.image?.mime_type ? String(msg.image.mime_type) : 'image/jpeg'
		};
	}

	if (type === 'document') {
		const filename = String(msg?.document?.filename || '').trim();
		const caption = String(msg?.document?.caption || '').trim();
		const detail = [filename, caption].filter(Boolean).join(' — ');
		return {
			text: detail ? `[Documento recibido]: ${detail}` : '[Documento recibido por WhatsApp]',
			messageType: 'document',
			metaMediaId: msg?.document?.id ? String(msg.document.id) : undefined,
			metaMediaMime: msg?.document?.mime_type ? String(msg.document.mime_type) : 'application/pdf',
			metaMediaFilename: filename || undefined
		};
	}

	if (type === 'audio' || type === 'voice') {
		const transcript = String(msg?.transcript || msg?.audio?.transcript || '').trim();
		return {
			text: transcript ? `[Audio transcrito]: ${transcript}` : '[Nota de voz recibida por WhatsApp]',
			messageType: 'audio',
			metaMediaId: msg?.audio?.id ? String(msg.audio.id) : undefined,
			metaMediaMime: msg?.audio?.mime_type ? String(msg.audio.mime_type) : 'audio/ogg'
		};
	}

	if (type === 'video') {
		const caption = String(msg?.video?.caption || '').trim();
		return {
			text: caption ? `[Video recibido]: ${caption}` : '[Video recibido por WhatsApp]',
			messageType: 'video',
			metaMediaId: msg?.video?.id ? String(msg.video.id) : undefined,
			metaMediaMime: msg?.video?.mime_type ? String(msg.video.mime_type) : 'video/mp4'
		};
	}

	if (type === 'location') {
		const locName = String(msg?.location?.name || msg?.location?.address || '').trim();
		const coords =
			msg?.location?.latitude && msg?.location?.longitude
				? `(${msg.location.latitude}, ${msg.location.longitude})`
				: '';
		return {
			text: `[Ubicación compartida]: ${[locName, coords].filter(Boolean).join(' ') || 'Coordenadas GPS'}`,
			messageType: 'location'
		};
	}

	if (type === 'reaction') {
		const emoji = String(msg?.reaction?.emoji || '').trim();
		return {
			text: emoji ? `[Reacción del cliente]: ${emoji}` : '',
			messageType: 'reaction'
		};
	}

	const directText = String(msg?.text || msg?.comment || msg?.body || msg?.message || '').trim();
	return {
		text: directText,
		messageType: type
	};
}

/**
 * Extrae adjuntos explícitos enviados desde n8n, GOWA o payloads directos.
 */
function extractIncomingMediaFromItem(item: any, fallbackType: string): IncomingWaMediaInput[] {
	const mediaList: IncomingWaMediaInput[] = [];

	if (Array.isArray(item?.attachments)) {
		for (const att of item.attachments) {
			if (att?.base64 || att?.url) {
				mediaList.push({
					base64: att.base64,
					url: att.url,
					authHeader: att.authHeader,
					mimeType: att.mimeType,
					filename: att.filename,
					mediaType: att.mediaType || fallbackType
				});
			}
		}
	}

	const singleUrl = item?.mediaUrl || item?.media_url || item?.fileUrl;
	const singleBase64 = item?.mediaBase64 || item?.media_base64 || item?.base64;
	if (singleBase64 || singleUrl) {
		mediaList.push({
			base64: singleBase64,
			url: singleUrl,
			authHeader: item?.mediaAuthHeader,
			mimeType: item?.mimeType || item?.mediaMimeType || item?.media_info?.mime_type,
			filename: item?.filename || item?.mediaFilename || item?.media_info?.filename,
			mediaType: item?.mediaType || fallbackType
		});
	}

	return mediaList;
}

/**
 * Resuelve la URL temporal de Meta Graph API v21.0 para un mediaId cuando hay token configurado.
 */
async function resolveMetaMediaInput(
	mediaId: string | undefined,
	mimeType?: string,
	filename?: string,
	mediaType?: string
): Promise<IncomingWaMediaInput | null> {
	if (!mediaId) return null;
	const token = env.META_WABA_ACCESS_TOKEN || env.WHATSAPP_ACCESS_TOKEN;
	if (!token) return null;

	try {
		const metaRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!metaRes.ok) return null;
		const metaJson = await metaRes.json();
		if (!metaJson?.url) return null;

		return {
			url: String(metaJson.url),
			authHeader: `Bearer ${token}`,
			mimeType: metaJson.mime_type || mimeType,
			filename,
			mediaType
		};
	} catch (err) {
		console.warn('[API WhatsApp Inbound] No se pudo resolver mediaId de Meta:', err);
		return null;
	}
}

/**
 * Normaliza tanto un payload crudo de Meta WhatsApp Cloud API como un payload estructurado por n8n
 */
function parseInboundPayload(body: any): NormalizedInboundMessage[] {
	const results: NormalizedInboundMessage[] = [];
	if (!body || typeof body !== 'object') return results;

	if (Array.isArray(body.entry)) {
		for (const entry of body.entry) {
			const changes = Array.isArray(entry?.changes) ? entry.changes : [];
			for (const change of changes) {
				const value = change?.value;
				const metadata = value?.metadata || {};
				const messages = Array.isArray(value?.messages) ? value.messages : [];

				for (const msg of messages) {
					const fromPhone = String(msg?.from || '').trim();
					const last10 = getLast10Digits(fromPhone);
					if (!last10 || last10.length < 10) continue;

					const { text, messageType, metaMediaId, metaMediaMime, metaMediaFilename } =
						extractLiteralTextFromMetaMessage(msg);
					if (!text) continue;

					const rawTs = Number(msg?.timestamp);
					const timestampMs =
						!isNaN(rawTs) && rawTs > 0
							? rawTs < 10000000000
								? rawTs * 1000
								: rawTs
							: Date.now();

					results.push({
						messageId: String(msg?.id || '').trim(),
						fromPhone,
						last10,
						text,
						timestampMs,
						messageType,
						direction: 'inbound',
						channel: 'waba',
						recipientPhoneId: String(metadata?.phone_number_id || '').trim() || undefined,
						recipientDisplayPhone: String(metadata?.display_phone_number || '').trim() || undefined,
						incomingMedia: [],
						metaMediaId,
						metaMediaMime,
						metaMediaFilename
					});
				}
			}
		}
		return results;
	}

	const list = Array.isArray(body.messages)
		? body.messages
		: Array.isArray(body.items)
			? body.items
			: [body];

	for (const item of list) {
		const fromPhone = String(
			item?.from || item?.fromPhone || item?.phone || item?.telephon || item?.sender || ''
		).trim();
		const last10 = getLast10Digits(fromPhone);
		if (!last10 || last10.length < 10) continue;

		const extracted =
			typeof item?.text === 'string'
				? {
						text: item.text.trim(),
						messageType: String(item?.messageType || item?.type || 'text'),
						metaMediaId: undefined,
						metaMediaMime: undefined,
						metaMediaFilename: undefined
					}
				: extractLiteralTextFromMetaMessage(item);

		if (!extracted.text) continue;

		const rawTs = Number(item?.timestampMs || item?.timestamp || item?.date);
		const timestampMs =
			!isNaN(rawTs) && rawTs > 0
				? rawTs < 10000000000
					? rawTs * 1000
					: rawTs
				: Date.now();

		const direction = item?.direction === 'outbound' ? 'outbound' : 'inbound';

		results.push({
			messageId: String(item?.messageId || item?.id || item?.wamid || '').trim(),
			fromPhone,
			last10,
			text: extracted.text,
			summary: typeof item?.summary === 'string' ? item.summary.trim() || undefined : undefined,
			timestampMs,
			messageType: extracted.messageType,
			direction,
			channel: String(item?.channel || 'waba').trim(),
			recipientPhoneId: String(item?.recipientPhoneId || item?.phone_number_id || '').trim() || undefined,
			recipientDisplayPhone:
				String(item?.recipientDisplayPhone || item?.display_phone_number || '').trim() || undefined,
			incomingMedia: extractIncomingMediaFromItem(item, extracted.messageType),
			metaMediaId: extracted.metaMediaId,
			metaMediaMime: extracted.metaMediaMime,
			metaMediaFilename: extracted.metaMediaFilename
		});
	}

	return results;
}

/**
 * GET /api/whatsapp/inbound
 * Verificación oficial del Webhook de Meta (hub.mode, hub.verify_token, hub.challenge)
 */
export async function GET({ url }) {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	const expectedToken = env.META_WEBHOOK_VERIFY_TOKEN || 'atair_waba_verify_2026';

	if (mode === 'subscribe' && token === expectedToken && challenge) {
		console.log('[API WhatsApp Inbound] Webhook verificado correctamente con Meta.');
		return new Response(challenge, {
			status: 200,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	return json(
		{
			status: 'active',
			endpoint: '/api/whatsapp/inbound',
			description:
				'Receptor de mensajes de WhatsApp (WABA / GOWA / n8n) hacia /contacts/{id}/wa_events, Firebase Storage y resumen compacto en binnacles'
		},
		{ status: 200 }
	);
}

/**
 * POST /api/whatsapp/inbound
 * Busca al contacto con consulta indexada (where telephon IN variants),
 * sube adjuntos a Firebase Storage (si vienen disponibles), registra el evento completo en
 * /contacts/{id}/wa_events y escribe resumen compacto en binnacles.
 */
export async function POST({ request }) {
	try {
		if (!db) {
			throw new Error('Firestore no está inicializado en el servidor.');
		}

		const payload = await request.json();
		const inboundMessages = parseInboundPayload(payload);

		if (inboundMessages.length === 0) {
			return json({
				success: true,
				processed: 0,
				message: 'Evento sin mensajes de cliente entrantes (ej. status update).'
			});
		}

		const targetStorage = prodStorage || storage;
		const savedEntries: any[] = [];
		const ignoredEntries: any[] = [];

		for (const msg of inboundMessages) {
			const variants = buildPhoneVariants(msg.last10);
			const q = query(collection(db, 'contacts'), where('telephon', 'in', variants));
			const snap = await getDocs(q);

			if (snap.empty) {
				ignoredEntries.push({
					fromPhone: msg.fromPhone,
					last10: msg.last10,
					reason: 'Número no registrado en la colección contacts de ATAIR'
				});
				continue;
			}

			const resolvedMetaMedia =
				msg.incomingMedia.length === 0 && msg.metaMediaId
					? await resolveMetaMediaInput(
							msg.metaMediaId,
							msg.metaMediaMime,
							msg.metaMediaFilename,
							msg.messageType
						)
					: null;

			const mediaInputs = resolvedMetaMedia ? [resolvedMetaMedia] : msg.incomingMedia;

			for (const contactDoc of snap.docs) {
				const contactData = contactDoc.data();
				const contactId = contactDoc.id;
				const contactName =
					`${contactData?.name || ''} ${contactData?.lastname || ''}`.trim() || 'Contacto';

				const deterministicId = msg.messageId
					? buildWaEventId(msg.direction, msg.messageId, msg.timestampMs, contactId)
					: undefined;

				const { eventId, binnacleId, attachments } = await saveWaEventAndBinnacle({
					db,
					storageInstance: targetStorage,
					contactId,
					event: {
						id: deterministicId,
						direction: msg.direction,
						channel: msg.channel,
						messageType: msg.messageType,
						messageId: msg.messageId || undefined,
						fromPhone: msg.last10,
						recipientPhoneId: msg.recipientPhoneId,
						recipientDisplayPhone: msg.recipientDisplayPhone,
						text: msg.text,
						summary: msg.summary,
						timestampMs: msg.timestampMs
					},
					incomingMedia: mediaInputs,
					syncBinnacle: true,
					binnacleAction:
						msg.direction === 'outbound' ? 'WhatsApp enviado: ' : 'WhatsApp recibido: '
				});

				try {
					const contactPatch: Record<string, any> = {
						lastContact: msg.timestampMs
					};
					if (msg.direction === 'inbound') {
						contactPatch.lastResponse = msg.timestampMs;
					}
					await updateDoc(doc(db, 'contacts', contactId), contactPatch);
				} catch (updateErr) {
					console.warn(
						`[WhatsApp Inbound] No se pudo actualizar timestamps en ${contactId}:`,
						updateErr
					);
				}

				savedEntries.push({
					eventId,
					binnacleId,
					contactId,
					contactName,
					phone: msg.last10,
					comment: msg.text,
					attachmentsCount: attachments.length,
					mediaUrl: attachments[0]?.url || null,
					date: msg.timestampMs
				});
			}
		}

		return json({
			success: true,
			processed: inboundMessages.length,
			savedCount: savedEntries.length,
			ignoredCount: ignoredEntries.length,
			saved: savedEntries,
			ignored: ignoredEntries
		});
	} catch (error: any) {
		console.error('❌ [API /api/whatsapp/inbound] Error:', error);
		return json(
			{
				success: false,
				error: error?.message || 'Error procesando mensaje entrante de WhatsApp'
			},
			{ status: 500 }
		);
	}
}
