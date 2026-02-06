import { env } from '$env/dynamic/private';

const META_PHONE_ID = env.META_PHONE_ID;
const META_ACCESS_TOKEN = env.META_ACCESS_TOKEN;

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Sends a WhatsApp Template message using the Meta Cloud API.
 * @param to recipient phone number (with country code)
 * @param templateName name of the template in Meta Business Manager
 * @param languageCode language code (e.g., 'es_MX', 'en_US')
 * @param components array of template components (body parameters, header, etc.)
 */
export async function sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'es_MX',
    components: any[] = []
) {
    if (!META_PHONE_ID || !META_ACCESS_TOKEN) {
        throw new Error('Missing Meta Cloud API credentials (META_PHONE_ID or META_ACCESS_TOKEN)');
    }

    const url = `${BASE_URL}/${META_PHONE_ID}/messages`;

    const body = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: languageCode
            },
            components: components
        }
    };

    console.log(`[WhatsApp Service] Sending template '${templateName}' to ${to}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('[WhatsApp Service] Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`WhatsApp API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('[WhatsApp Service] Success:', data);
    return data;
}

/**
 * Sends a helper text message (Warning: Only works if the 24h conversation window is open)
 * To initiate a conversation, you MUST use sendTemplateMessage.
 */
export async function sendTextMessage(to: string, text: string) {
     if (!META_PHONE_ID || !META_ACCESS_TOKEN) {
        throw new Error('Missing Meta Cloud API credentials');
    }

    const url = `${BASE_URL}/${META_PHONE_ID}/messages`;

    const body = {
        messaging_product: 'whatsapp',
        recipient_type: "individual",
        to: to,
        type: 'text',
        text: {
            preview_url: false,
            body: text
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

     if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API Error: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
}
