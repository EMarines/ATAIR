import { json } from '@sveltejs/kit';
import { sendTemplateMessage } from '$lib/services/whatsapp';
// import { generateWelcomeMessage } from '$lib/services/ai'; // Optional: Use if we want to generate variable content
import { env } from '$env/dynamic/private';

const TEMPLATE_NAME = env.TEMPLATE_NAME;

export async function POST({ request }) {
    try {
        const { contact, property } = await request.json();

        if (!contact || !contact.telephon) {
            return json({ success: false, error: 'Missing contact information' }, { status: 400 });
        }

        // 1. Prepare Data
        const to = contact.telephon; // Ensure this is formatted (cleanNumber logic might be needed here or in service)
        const name = contact.name || 'Cliente';
        // Fallback to a default template if env var is missing (e.g., for testing)
        const template = TEMPLATE_NAME || 'hello_world'; 
        
        let components = [];

        // 2. Map variables based on the Template
        // Assumption: "hello_world" has NO parameters.
        // Assumption: A custom "welcome_property" template might have {{1}}=Name, {{2}}=PropertyLink
        
        if (template !== 'hello_world') {
            const propertyLink = property ? `https://tuedificio.com/propiedad/${property.public_id}` : 'https://tuedificio.com';
            
            components = [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: name },
                        { type: 'text', text: property?.title || 'la propiedad' },
                        { type: 'text', text: propertyLink }
                    ]
                }
            ];
        }

        // 3. Send Message
        const result = await sendTemplateMessage(to, template, 'es_MX', components);

        return json({ success: true, data: result });

    } catch (error) {
        console.error('[API WhatsApp] Error:', error);
        return json({ success: false, error: error.message }, { status: 500 });
    }
}
