import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/firebase';
import { collection, getDocs, doc, setDoc, addDoc, updateDoc, query, where } from 'firebase/firestore';

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

/**
 * Genera un ID determinístico seguro para Firestore a partir de contactId y messageId (wamid)
 * Evita duplicados si Meta o n8n reintentan el webhook.
 */
function buildDeterministicBinnacleId(contactId: string, messageId: string): string {
	const cleanMsgId = messageId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-48);
	return `wain_${contactId}_${cleanMsgId}`;
}

export interface NormalizedInboundMessage {
	messageId: string;
	fromPhone: string;
	last10: string;
	text: string;
	timestampMs: number;
	messageType: string;
	recipientPhoneId?: string;
	recipientDisplayPhone?: string;
}

/**
 * Extrae el texto literal de cualquier tipo de mensaje entrante de WhatsApp Cloud API
 * (texto libre, respuesta a botón de plantilla, botón interactivo, imagen con leyenda, audio, ubicación, etc.)
 */
function extractLiteralTextFromMetaMessage(msg: any): { text: string; messageType: string } {
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
			messageType: 'image'
		};
	}

	if (type === 'document') {
		const filename = String(msg?.document?.filename || '').trim();
		const caption = String(msg?.document?.caption || '').trim();
		const detail = [filename, caption].filter(Boolean).join(' — ');
		return {
			text: detail ? `[Documento recibido]: ${detail}` : '[Documento recibido por WhatsApp]',
			messageType: 'document'
		};
	}

	if (type === 'audio' || type === 'voice') {
		const transcript = String(msg?.transcript || msg?.audio?.transcript || '').trim();
		return {
			text: transcript ? `[Audio transcrito]: ${transcript}` : '[Nota de voz recibida por WhatsApp]',
			messageType: 'audio'
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
 * Normaliza tanto un payload crudo de Meta WhatsApp Cloud API como un payload ya estructurado por n8n
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

					const { text, messageType } = extractLiteralTextFromMetaMessage(msg);
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
						recipientPhoneId: String(metadata?.phone_number_id || '').trim() || undefined,
						recipientDisplayPhone: String(metadata?.display_phone_number || '').trim() || undefined
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

		const { text, messageType } =
			typeof item?.text === 'string'
				? { text: item.text.trim(), messageType: String(item?.messageType || item?.type || 'text') }
				: extractLiteralTextFromMetaMessage(item);

		if (!text) continue;

		const rawTs = Number(item?.timestampMs || item?.timestamp || item?.date);
		const timestampMs =
			!isNaN(rawTs) && rawTs > 0
				? rawTs < 10000000000
					? rawTs * 1000
					: rawTs
				: Date.now();

		results.push({
			messageId: String(item?.messageId || item?.id || item?.wamid || '').trim(),
			fromPhone,
			last10,
			text,
			timestampMs,
			messageType,
			recipientPhoneId: String(item?.recipientPhoneId || item?.phone_number_id || '').trim() || undefined,
			recipientDisplayPhone:
				String(item?.recipientDisplayPhone || item?.display_phone_number || '').trim() || undefined
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
			description: 'Receptor de respuestas entrantes de WhatsApp (WABA / n8n) hacia Firestore binnacles'
		},
		{ status: 200 }
	);
}

/**
 * POST /api/whatsapp/inbound
 * Busca al contacto con consulta indexada (where telephon IN variants) sin descargar toda la colección
 * y registra la respuesta literal en 'binnacles' (to: contact.id).
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

			for (const contactDoc of snap.docs) {
				const contactData = contactDoc.data();
				const contactId = contactDoc.id;
				const contactName =
					`${contactData?.name || ''} ${contactData?.lastname || ''}`.trim() || 'Contacto';

				const binnacleDocData: Record<string, any> = {
					to: contactId,
					date: msg.timestampMs,
					action: 'WhatsApp recibido: ',
					comment: msg.text,
					direction: 'inbound',
					channel: 'waba',
					messageType: msg.messageType,
					fromPhone: msg.last10
				};

				if (msg.messageId) {
					binnacleDocData.messageId = msg.messageId;
				}
				if (msg.recipientPhoneId) {
					binnacleDocData.recipientPhoneId = msg.recipientPhoneId;
				}
				if (msg.recipientDisplayPhone) {
					binnacleDocData.recipientDisplayPhone = msg.recipientDisplayPhone;
				}

				let binnacleId = '';
				if (msg.messageId) {
					binnacleId = buildDeterministicBinnacleId(contactId, msg.messageId);
					await setDoc(doc(db, 'binnacles', binnacleId), binnacleDocData, { merge: true });
				} else {
					const createdRef = await addDoc(collection(db, 'binnacles'), binnacleDocData);
					binnacleId = createdRef.id;
				}

				try {
					await updateDoc(doc(db, 'contacts', contactId), {
						lastResponse: msg.timestampMs,
						lastContact: msg.timestampMs
					});
				} catch (updateErr) {
					console.warn(`[WhatsApp Inbound] No se pudo actualizar lastResponse en ${contactId}:`, updateErr);
				}

				savedEntries.push({
					binnacleId,
					contactId,
					contactName,
					phone: msg.last10,
					comment: msg.text,
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
