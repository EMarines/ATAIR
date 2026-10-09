// src/routes/api/whatsapp/send/+server.ts
// Endpoint para envío de WhatsApp desde ATAIR App y registro en Bitácora

import { json, type RequestHandler } from '@sveltejs/kit';
import { sendWhatsAppTextMessage } from '$lib/services/whatsapp';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '$lib/firebase/config';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { contactId, to, message, authorName, authorId } = body;

		if (!to || !message || !message.trim()) {
			return json({ success: false, error: 'Número de teléfono y mensaje son obligatorios' }, { status: 400 });
		}

		// 1. Envío por la API de WhatsApp
		const result = await sendWhatsAppTextMessage(to, message.trim());

		if (!result.success) {
			return json({ success: false, error: result.error || 'Fallo al enviar mensaje por WhatsApp' }, { status: 502 });
		}

		// 2. Registro inmediato en Bitácora de Firestore si viene contactId
		let binnacleId: string | null = null;
		if (contactId) {
			try {
				const binnCol = collection(db, 'binnacles');
				const binnDoc = await addDoc(binnCol, {
					contactId,
					tipo: 'whatsapp',
					direction: 'outbound',
					sender: 'associate',
					descripcion: message.trim(),
					comment: message.trim(),
					messageText: message.trim(),
					author: authorName || (locals as any)?.user?.email || 'Asociada Match Home',
					author_id: authorId || (locals as any)?.user?.uid || '',
					fecha: Date.now(),
					date: Date.now(),
					status: result.mode === 'simulation' ? 'simulated' : 'sent',
					whatsappMessageId: result.messageId || null
				});
				binnacleId = binnDoc.id;
			} catch (dbErr) {
				console.warn('[API WhatsApp Send] No se pudo escribir en binnacles en servidor:', dbErr);
			}
		}

		return json({
			success: true,
			mode: result.mode,
			messageId: result.messageId,
			binnacleId
		});
	} catch (err: any) {
		console.error('[API WhatsApp Send Exception]:', err);
		return json({ success: false, error: err.message || 'Error interno del servidor' }, { status: 500 });
	}
};
