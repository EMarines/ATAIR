import { json } from '@sveltejs/kit';
import { GOOGLE_CONFIG } from '$lib/config/google';

// Endpoint para manejar la creación de contactos en Google
export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader) {
            return json({ error: 'No se proporcionó token de autorización' }, { status: 401 });
        }
        
        const accessToken = authHeader.replace('Bearer ', '');
        const contactData = await request.json();
        
        // URL de la API de Google para crear contactos
        const googleApiUrl = 'https://people.googleapis.com/v1/people:createContact';
        
        // Enviar solicitud a la API de Google
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(contactData)
        });
        
        // Intentar obtener la respuesta como JSON primero
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // Si no es JSON, obtener como texto
            const text = await response.text();
            return json({ error: text }, { status: response.status });
        }
        
        if (!response.ok) {
            console.error('Error desde la API de Google:', data);
            return json(data, { status: response.status });
        }
        
        return json(data);
    } catch (error) {
        console.error('Error en el servidor:', error);
        return json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
