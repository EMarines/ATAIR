import { json } from '@sveltejs/kit';

// Endpoint para manejar la actualización de contactos en Google
export async function PATCH({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader) {
            return json({ error: 'No se proporcionó token de autorización' }, { status: 401 });
        }
        
        const accessToken = authHeader.replace('Bearer ', '');
        const contactData = await request.json();
        
        // Obtener el resourceName (ID del contacto en Google) de los parámetros de la URL
        const resourceName = url.searchParams.get('resourceName');
        
        if (!resourceName) {
            return json({ error: 'No se proporcionó el ID del contacto' }, { status: 400 });
        }
        
        // Primero, obtener el contacto actual para conseguir su etag
        const getContactUrl = `https://people.googleapis.com/v1/${resourceName}?personFields=names,emailAddresses,phoneNumbers,organizations,biographies,metadata`;
        
        const getResponse = await fetch(getContactUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!getResponse.ok) {
            const errorData = await getResponse.json();
            console.error('Error al obtener contacto de Google:', errorData);
            return json(errorData, { status: getResponse.status });
        }
        
        const contactInfo = await getResponse.json();
        const etag = contactInfo.etag;
        
        if (!etag) {
            return json({ error: 'No se pudo obtener el etag del contacto' }, { status: 500 });
        }
        
        // Incluir el etag en los datos del contacto
        const updatedContactData = {
            ...contactData,
            etag: etag
        };
        
        // Construir la URL para actualizar el contacto
        const googleApiUrl = `https://people.googleapis.com/v1/${resourceName}:updateContact`;
        
        // Construir los parámetros de consulta
        const queryParams = new URLSearchParams({
            updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations,biographies'
        });
        
        // Enviar solicitud a la API de Google
        const response = await fetch(`${googleApiUrl}?${queryParams.toString()}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedContactData)
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
