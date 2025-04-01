// import { json } from '@sveltejs/kit';
// // import { GOOGLE_CONFIG } from '$lib/config/google';

// // Endpoint para manejar la creación de contactos en Google
// export async function POST({ request, url }) {
//     try {
//         const path = url.pathname;
//         const authHeader = request.headers.get('Authorization');
        
//         if (!authHeader) {
//             return json({ error: 'No se proporcionó token de autorización' }, { status: 401 });
//         }
        
//         const accessToken = authHeader.replace('Bearer ', '');
//         const contactData = await request.json();
        
//         // Determinar la URL de la API de Google según el path
//         let googleApiUrl = '';
        
//         if (path.endsWith('people:createContact')) {
//             googleApiUrl = 'https://people.googleapis.com/v1/people:createContact';
//         } else {
//             return json({ error: 'Endpoint no soportado' }, { status: 400 });
//         }
        
//         // Enviar solicitud a la API de Google
//         const response = await fetch(googleApiUrl, {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`,
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify(contactData)
//         });
        
//         const data = await response.json();
        
//         if (!response.ok) {
//             console.error('Error desde la API de Google:', data);
//             return json(data, { status: response.status });
//         }
        
//         return json(data);
//     } catch (error) {
//         console.error('Error en el servidor:', error);
//         return json({ error: 'Error interno del servidor' }, { status: 500 });
//     }
// }
