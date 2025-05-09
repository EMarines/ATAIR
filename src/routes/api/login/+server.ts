import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    // Obtener los datos de la solicitud
    const { email, password } = await request.json();
    
    // Aquí normalmente verificarías las credenciales contra una base de datos
    // Este es un ejemplo simple para demostración
    
    // Simulación de verificación (¡REEMPLAZAR CON TU LÓGICA REAL!)
    if (email === 'admin@example.com' && password === 'password123') {
        // Usuario autenticado correctamente
        const user = {
            id: 'user-123',
            name: 'Administrador',
            email: 'admin@example.com',
            role: 'admin'
        };
        
        return json({
            success: true,
            user
        });
    }
    
    // Error de autenticación
    return json({
        success: false,
        message: 'Correo electrónico o contraseña incorrectos'
    }, { status: 401 });
};
