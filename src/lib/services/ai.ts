import { env } from '$env/dynamic/private';

/**
 * Generates a personalized welcome message or property description using OpenAI.
 * @param contactName Name of the client
 * @param propertyTitle Title of the property they are interested in
 * @param context Additional context (budget, preferences)
 */
export async function generateWelcomeMessage(
    contactName: string,
    propertyTitle: string,
    context: string = ''
): Promise<string> {
    if (!env.OPENAI_API_KEY) {
        console.warn('[AI Service] No OpenAI API Key found. Returning fallback text.');
        return `Hola ${contactName}, aquí tienes la información sobre ${propertyTitle}.`;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // Or 'gpt-4' if available/preferred
                messages: [
                    {
                        role: 'system',
                        content: `Eres un asistente inmobiliario profesional y amable. Tu objetivo es redactar mensajes cortos y efectivos para WhatsApp.
                        - Usa un tono cercano pero respetuoso.
                        - Sé breve (máximo 2 frases).
                        - No uses hashtags.
                        - El objetivo es confirmar el interés en la propiedad y abrir la conversación.`
                    },
                    {
                        role: 'user',
                        content: `Genera un saludo para un cliente llamado "${contactName}" que preguntó por la propiedad "${propertyTitle}". Contexto adicional: ${context}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 100
            })
        });

        if (!response.ok) {
            console.error('[AI Service] OpenAI API error:', response.statusText);
            return `Hola ${contactName}, gracias por tu interés en ${propertyTitle}.`;
        }

        const data = await response.json();
        const generatedText = data.choices[0]?.message?.content?.trim();
        return generatedText || `Hola ${contactName}, aquí tienes la info de ${propertyTitle}.`;

    } catch (error) {
        console.error('[AI Service] Error calling OpenAI:', error);
        return `Hola ${contactName}, gracias por contactarnos sobre ${propertyTitle}.`;
    }
}
