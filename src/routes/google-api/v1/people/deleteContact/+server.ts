import { json } from '@sveltejs/kit';

// Endpoint para manejar la eliminación de contactos en Google
export async function DELETE({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader) {
            return json({ error: 'No se proporcionó token de autorización' }, { status: 401 });
        }
        
        const accessToken = authHeader.replace('Bearer ', '');
        
        // Obtener el resourceName (ID del contacto en Google) de los parámetros de la URL
        const resourceName = url.searchParams.get('resourceName');
        
        if (!resourceName) {
            return json({ error: 'No se proporcionó el ID del contacto' }, { status: 400 });
        }
        
        // URL de la API de Google para eliminar contactos
        const googleApiUrl = `https://people.googleapis.com/v1/${resourceName}:deleteContact`;
        
        // Enviar solicitud a la API de Google
        const response = await fetch(googleApiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: await response.text() };
            }
            
            console.error('Error desde la API de Google:', errorData);
            return json(errorData, { status: response.status });
        }
        
        // La API de Google devuelve un cuerpo vacío para las eliminaciones exitosas
        return json({ success: true });
    } catch (error) {
        console.error('Error en el servidor:', error);
        return json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
