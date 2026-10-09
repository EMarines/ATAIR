// src/lib/services/whatsapp.ts
// Servicio Oficial de WhatsApp Cloud API para ATAIR CRM

import { env } from '$env/dynamic/private';

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface SendWhatsAppResult {
	success: boolean;
	messageId?: string;
	mode: 'live' | 'simulation';
	data?: any;
	error?: string;
}

/**
 * Envía un mensaje de texto plano o conversacional directo a WhatsApp.
 */
export async function sendWhatsAppTextMessage(to: string, message: string): Promise<SendWhatsAppResult> {
	const phoneId = env.META_PHONE_ID;
	const accessToken = env.META_ACCESS_TOKEN;

	const cleanTo = to.replace(/\D/g, '');
	const formattedPhone = cleanTo.startsWith('52') ? cleanTo : `52${cleanTo}`;

	// Modo Simulación Segura si no hay credenciales activas en local
	if (!phoneId || !accessToken) {
		console.log(`[WhatsApp Service - MODO SIMULACIÓN] Mensaje a +${formattedPhone}: "${message}"`);
		return {
			success: true,
			messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			mode: 'simulation',
			data: { to: formattedPhone, message, note: 'Simulado exitosamente sin credenciales de Meta en entorno actual' }
		};
	}

	const url = `${BASE_URL}/${phoneId}/messages`;
	const body = {
		messaging_product: 'whatsapp',
		recipient_type: 'individual',
		to: formattedPhone,
		type: 'text',
		text: {
			preview_url: true,
			body: message
		}
	};

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('[WhatsApp Service Live Error]:', errorData);
			return {
				success: false,
				mode: 'live',
				error: errorData.error?.message || response.statusText
			};
		}

		const data = await response.json();
		return {
			success: true,
			messageId: data.messages?.[0]?.id,
			mode: 'live',
			data
		};
	} catch (err: any) {
		console.error('[WhatsApp Service Exception]:', err);
		return {
			success: false,
			mode: 'live',
			error: err.message || 'Error de red al conectar con Meta Cloud API'
		};
	}
}
