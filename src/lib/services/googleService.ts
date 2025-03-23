import { GOOGLE_CONFIG } from '../config/google';
import { notifications } from '$lib/stores/notificationStore';

// Constantes
const GOOGLE_CLIENT_ID = GOOGLE_CONFIG.clientId;
const GOOGLE_CLIENT_SECRET = GOOGLE_CONFIG.clientSecret;
const REDIRECT_URI = GOOGLE_CONFIG.redirectUri;
const SCOPES = GOOGLE_CONFIG.scopes;

// Verificar si estamos en el navegador
const isBrowser = typeof window !== 'undefined';

// Variable para almacenar el token en memoria
let cachedTokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
    expires_in?: number;
    token_type?: string;
    scope?: string; // Añadido para verificar los scopes concedidos
} | null = null;

// Obtener URL de autorización
export function getAuthUrl() {
    // Registrar la URI de redirección para depuración
    console.log('REDIRECT_URI utilizada:', REDIRECT_URI);
    console.log('GOOGLE_CLIENT_ID utilizado:', GOOGLE_CLIENT_ID);
    
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent', // Siempre solicitar consentimiento para asegurar refresh_token
        include_granted_scopes: 'true', // Incluir permisos ya concedidos
        state: JSON.stringify({
            returnTo: window.location.pathname,
            timestamp: Date.now()
        })
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('URL de autorización completa:', authUrl);
    return authUrl;
}

// Verificar si tenemos todos los permisos necesarios
export function hasRequiredScopes(tokens: any): boolean {
    if (!tokens || !tokens.scope) return false;
    
    const grantedScopes = tokens.scope.split(' ');
    
    // Verificar que todos los scopes requeridos estén concedidos
    return SCOPES.every(scope => grantedScopes.includes(scope));
}

// Obtener tokens con el código de autorización
export async function getTokens(code: string) {
    console.log('Obteniendo tokens con código:', code);
    console.log('Usando REDIRECT_URI:', REDIRECT_URI);
    console.log('Usando GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID);
    
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                code
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Error en respuesta de Google:', errorData);
            throw new Error(`Error al obtener tokens: ${response.status} ${response.statusText} - ${errorData}`);
        }

        const tokens = await response.json();
        console.log('Tokens obtenidos correctamente:', { ...tokens, access_token: '***REDACTED***' });
        
        // Verificar los scopes concedidos
        if (tokens.scope) {
            console.log('Scopes concedidos:', tokens.scope);
            
            // Verificar si tenemos todos los permisos necesarios
            if (!hasRequiredScopes(tokens)) {
                console.warn('No se concedieron todos los permisos necesarios');
                notifications.add({
                    type: 'warning',
                    message: 'No se concedieron todos los permisos necesarios para la sincronización completa con Google Contacts',
                    duration: 8000
                });
            }
        }
        
        // Calcular la fecha de expiración si no viene incluida
        if (!tokens.expiry_date) {
            tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
        }
        
        // Guardar en caché y localStorage
        cachedTokens = tokens;
        if (isBrowser) {
            localStorage.setItem('googleTokens', JSON.stringify(tokens));
        }
        
        return tokens;
    } catch (error) {
        console.error('Error al obtener tokens:', error);
        throw error;
    }
}

// Actualizar token usando refresh_token
export async function refreshToken(refreshToken: string) {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            // Si el refresh token ha sido revocado o es inválido
            if (response.status === 400 || response.status === 401) {
                console.warn('Refresh token revocado o inválido. Se requiere nueva autenticación.');
                // Limpiar tokens almacenados
                if (isBrowser) {
                    localStorage.removeItem('googleTokens');
                    localStorage.removeItem('googleContactsMap');
                }
                cachedTokens = null;
                
                // Notificar al usuario
                notifications.add({
                    type: 'error',
                    message: 'La conexión con Google ha expirado. Por favor, vuelve a autenticarte.',
                    duration: 8000
                });
                
                // Devolver null para indicar que se requiere nueva autenticación
                return null;
            }
            
            const errorData = await response.text();
            throw new Error(`Error al actualizar token: ${response.status} ${response.statusText} - ${errorData}`);
        }

        const newTokens = await response.json();
        
        // Mantener el refresh_token anterior ya que Google no siempre lo devuelve
        if (!newTokens.refresh_token && refreshToken) {
            newTokens.refresh_token = refreshToken;
        }
        
        // Calcular la fecha de expiración
        newTokens.expiry_date = Date.now() + (newTokens.expires_in * 1000);
        
        // Actualizar caché y localStorage
        cachedTokens = newTokens;
        if (isBrowser) {
            localStorage.setItem('googleTokens', JSON.stringify(newTokens));
        }
        
        return newTokens;
    } catch (error) {
        console.error('Error al actualizar token:', error);
        throw error;
    }
}

// Obtener tokens válidos (refresca automáticamente si es necesario)
export async function getValidTokens() {
    // Intentar obtener tokens de la caché o localStorage
    if (!cachedTokens && isBrowser) {
        const storedTokens = localStorage.getItem('googleTokens');
        if (storedTokens) {
            cachedTokens = JSON.parse(storedTokens);
        }
    }
    
    // Si no hay tokens, se requiere autenticación
    if (!cachedTokens) {
        return null;
    }
    
    // Verificar si el token ha expirado (con 5 minutos de margen)
    const now = Date.now();
    const isExpired = cachedTokens.expiry_date <= now + 5 * 60 * 1000;
    
    // Si el token ha expirado y tenemos refresh_token, intentar actualizarlo
    if (isExpired && cachedTokens.refresh_token) {
        try {
            const newTokens = await refreshToken(cachedTokens.refresh_token);
            return newTokens;
        } catch (error) {
            console.error('Error al refrescar token:', error);
            // Si falla la actualización, limpiar tokens y requerir nueva autenticación
            if (isBrowser) {
                localStorage.removeItem('googleTokens');
                localStorage.removeItem('googleContactsMap');
            }
            cachedTokens = null;
            return null;
        }
    }
    
    // Si el token es válido, devolverlo
    return cachedTokens;
}

// Revocar tokens y limpiar almacenamiento
export async function revokeTokens() {
    if (!cachedTokens) {
        if (isBrowser) {
            const storedTokens = localStorage.getItem('googleTokens');
            if (storedTokens) {
                cachedTokens = JSON.parse(storedTokens);
            }
        }
    }
    
    if (cachedTokens && cachedTokens.access_token) {
        try {
            // Revocar el access_token
            await fetch(`https://oauth2.googleapis.com/revoke?token=${cachedTokens.access_token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            console.log('Token revocado correctamente');
        } catch (error) {
            console.error('Error al revocar token:', error);
        }
    }
    
    // Limpiar tokens almacenados
    if (isBrowser) {
        localStorage.removeItem('googleTokens');
        localStorage.removeItem('googleContactsMap');
    }
    cachedTokens = null;
    
    notifications.add({
        type: 'success',
        message: 'Se ha desconectado correctamente de Google Contacts',
        duration: 5000
    });
    
    return true;
}

// Obtener contactos usando el token de acceso
export async function getContacts(accessToken: string) {
    const response = await fetch(
        '/google-api/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers',
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );

    if (!response.ok) {
        throw new Error('Error al obtener contactos');
    }

    const data = await response.json();
    return data.connections || [];
}

// Verificar si tenemos un token válido
export function tieneTokenValido() {
    if (!isBrowser) return false;
    
    try {
        // Primero verificar si tenemos tokens en caché
        if (cachedTokens && cachedTokens.expiry_date > Date.now()) {
            return true;
        }
        
        const tokensStr = localStorage.getItem('googleTokens');
        if (!tokensStr) return false;
        
        const tokens = JSON.parse(tokensStr);
        
        // Guardar en caché para futuras verificaciones
        cachedTokens = tokens;
        
        // Verificar si el token ha expirado (con 5 minutos de margen)
        const isValid = tokens.expiry_date > Date.now() - (5 * 60 * 1000);
        
        // Si está a punto de expirar pero tenemos refresh_token, intentar refrescarlo
        if (!isValid && tokens.refresh_token) {
            console.log('Token expirado, intentando refrescar...');
            // No esperamos aquí para no bloquear, pero iniciamos el proceso
            refreshToken(tokens.refresh_token);
            // Devolvemos true para evitar redirecciones innecesarias mientras se refresca
            return true;
        }
        
        return isValid;
    } catch (error) {
        console.error('Error al verificar token:', error);
        return false;
    }
}

// Obtener el token de acceso actual
// Esta función es asíncrona y maneja automáticamente el refresco del token si está a punto de expirar
export async function getAccessToken() {
    if (!isBrowser) return null;
    
    try {
        // Verificar si tenemos tokens en caché
        if (cachedTokens && cachedTokens.access_token) {
            // Si está a punto de expirar, refrescarlo
            if (cachedTokens.expiry_date < Date.now() + (5 * 60 * 1000)) {
                console.log('Token a punto de expirar, refrescando...');
                if (cachedTokens.refresh_token) {
                    const newTokens = await refreshToken(cachedTokens.refresh_token);
                    if (newTokens) {
                        return newTokens.access_token;
                    } else {
                        // Si no se pudo refrescar, intentar obtener de localStorage
                        console.log('No se pudo refrescar el token, intentando obtener de localStorage');
                    }
                } else {
                    console.error('No hay refresh_token en cachedTokens');
                    cachedTokens = null; // Invalidar caché
                }
            } else {
                return cachedTokens.access_token;
            }
        }
        
        // Intentar obtener tokens de localStorage
        const tokensStr = localStorage.getItem('googleTokens');
        if (!tokensStr) {
            console.log('No hay tokens almacenados en localStorage');
            notifications.add({
                type: 'info',
                message: 'Es necesario conectarse a Google Contacts para sincronizar contactos',
                duration: 5000
            });
            return null;
        }
        
        try {
            const tokens = JSON.parse(tokensStr);
            
            // Validar que el token tiene la estructura esperada
            if (!tokens || !tokens.access_token || !tokens.expiry_date) {
                console.error('Tokens almacenados inválidos, eliminando...');
                localStorage.removeItem('googleTokens');
                notifications.add({
                    type: 'error',
                    message: 'La conexión con Google Contacts es inválida. Por favor, conéctate nuevamente. Los tokens almacenados no tienen la estructura esperada.',
                    duration: 5000
                });
                return null;
            }
            
            // Guardar en caché
            cachedTokens = tokens;
            
            // Si está a punto de expirar, refrescarlo
            if (tokens.expiry_date < Date.now() + (5 * 60 * 1000)) {
                console.log('Token a punto de expirar, refrescando...');
                if (tokens.refresh_token) {
                    const newTokens = await refreshToken(tokens.refresh_token);
                    if (newTokens) {
                        return newTokens.access_token;
                    } else {
                        console.error('No se pudo refrescar el token');
                        // Si el token está expirado y no se pudo refrescar, notificar al usuario
                        if (tokens.expiry_date < Date.now()) {
                            notifications.add({
                                type: 'error',
                                message: 'Tu sesión con Google Contacts ha expirado. Por favor, conéctate nuevamente.',
                                duration: 5000
                            });
                            localStorage.removeItem('googleTokens');
                            cachedTokens = null;
                            return null;
                        }
                    }
                } else {
                    console.error('No hay refresh_token en tokens de localStorage');
                    localStorage.removeItem('googleTokens');
                    cachedTokens = null;
                    notifications.add({
                        type: 'error',
                        message: 'La conexión con Google Contacts es inválida (falta refresh token). Por favor, conéctate nuevamente.',
                        duration: 5000
                    });
                    return null;
                }
            }
            
            return tokens.access_token;
        } catch (parseError) {
            console.error('Error al parsear tokens de localStorage:', parseError);
            localStorage.removeItem('googleTokens');
            cachedTokens = null;
            notifications.add({
                type: 'error',
                message: 'La conexión con Google Contacts está corrupta. Por favor, conéctate nuevamente.',
                duration: 5000
            });
            return null;
        }
    } catch (error) {
        console.error('Error al obtener token de acceso:', error);
        
        // Verificar si el error está relacionado con la app no verificada
        if (error instanceof Error && 
            (error.message.includes('unverified') || 
             error.message.includes('verificada') || 
             error.message.includes('policy'))) {
            
            notifications.add({
                type: 'warning',
                message: 'Error de verificación de Google. Consulta la página de ayuda para instrucciones sobre cómo proceder.',
                duration: 8000
            });
            
            // Sugerir ir a la página de ayuda
            setTimeout(() => {
                if (confirm('¿Deseas ver instrucciones sobre cómo manejar la advertencia de "App no verificada"?')) {
                    window.location.href = '/oauth/help';
                }
            }, 1000);
        } else {
            notifications.add({
                type: 'error',
                message: `Error al obtener token de acceso: ${error instanceof Error ? error.message : String(error)}`,
                duration: 5000
            });
        }
        
        cachedTokens = null;
        return null;
    }
}

// Obtener token de acceso válido
export async function getAccessTokenRefreshed() {
    if (!isBrowser) return null;
    
    try {
        // Intentar obtener de la caché primero
        if (cachedTokens) {
            // Si está a punto de expirar, refrescarlo
            if (cachedTokens.expiry_date < Date.now() + (5 * 60 * 1000)) {
                console.log('Token a punto de expirar, refrescando...');
                if (cachedTokens.refresh_token) {
                    const newTokens = await refreshToken(cachedTokens.refresh_token);
                    if (newTokens) {
                        return newTokens.access_token;
                    }
                }
            } else {
                return cachedTokens.access_token;
            }
        }
        
        // Si no está en caché, intentar obtenerlo de localStorage
        const tokensStr = localStorage.getItem('googleTokens');
        if (!tokensStr) return null;
        
        const tokens = JSON.parse(tokensStr);
        
        // Actualizar caché
        cachedTokens = tokens;
        
        // Si está a punto de expirar, refrescarlo
        if (tokens.expiry_date < Date.now() + (5 * 60 * 1000)) {
            console.log('Token a punto de expirar, refrescando...');
            if (tokens.refresh_token) {
                const newTokens = await refreshToken(tokens.refresh_token);
                if (newTokens) {
                    return newTokens.access_token;
                }
            }
        }
        
        return tokens.access_token;
    } catch (error) {
        console.error('Error al obtener access token:', error);
        return null;
    }
}

// Transformar datos para Google
function transformarParaGoogle(contactData: any, isUpdate = false) {
    // Concatenar notes con prpCont
    const notasCompletas = contactData.prpCont ? 
        `${contactData.notes || ''}\n${contactData.prpCont}`.trim() : 
        contactData.notes || '';

    const googleData: any = {
        names: [
            {
                givenName: contactData.name,
                familyName: contactData.lastname
            }
        ],
        emailAddresses: contactData.email ? [
            {
                value: contactData.email
            }
        ] : [],
        phoneNumbers: contactData.telephon ? [
            {
                value: contactData.telephon
            }
        ] : [],
        organizations: [
            {
                title: contactData.typeContact // Usar typeContact como cargo
            }
        ],
        biographies: notasCompletas ? [
            {
                value: notasCompletas
            }
        ] : []
    };

    // Si es una actualización, no incluimos campos vacíos
    if (isUpdate) {
        if (!contactData.email) delete googleData.emailAddresses;
        if (!contactData.telephon) delete googleData.phoneNumbers;
        if (!notasCompletas) delete googleData.biographies;
        if (!contactData.typeContact) delete googleData.organizations;
    }

    return googleData;
}

// Sincronizar contacto
export async function syncContact(contactData: any, accessToken: string) {
    if (!accessToken) {
        console.error('No hay token de acceso para sincronizar con Google');
        notifications.error('No hay token de acceso para sincronizar con Google Contacts');
        return null;
    }

    try {
        console.log('Iniciando búsqueda de contacto existente en Google...');
        // Primero buscar si el contacto ya existe en Google
        const existingContact = await buscarContacto(contactData, accessToken);
        
        if (existingContact) {
            console.log('Contacto encontrado en Google, actualizando...', existingContact.resourceName);
            // Si existe, actualizar
            const result = await updateGoogleContact(existingContact.resourceName, contactData, accessToken);
            
            // Guardar la relación entre el ID local y el resourceName de Google
            if (isBrowser && contactData.id) {
                try {
                    const mapStr = localStorage.getItem('googleContactsMap') || '{}';
                    const map = JSON.parse(mapStr);
                    map[contactData.id] = existingContact.resourceName;
                    localStorage.setItem('googleContactsMap', JSON.stringify(map));
                    console.log('Mapa de contactos actualizado para contacto existente');
                } catch (e) {
                    console.error('Error al guardar mapa de contactos:', e);
                }
            }
            
            notifications.success('Contacto actualizado en Google Contacts');
            return result;
        } else {
            console.log('Contacto no encontrado en Google, creando nuevo...');
            // Si no existe, crear nuevo
            const googleData = transformarParaGoogle(contactData);
            
            // Hacer la solicitud a la API
            const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(googleData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error al crear contacto en Google:', response.status, errorText);
                notifications.error(`Error al crear contacto en Google: ${response.status} ${errorText}`);
                throw new Error(`Error al crear contacto: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Contacto creado en Google:', result.resourceName);
            
            // Guardar la relación entre el ID local y el resourceName de Google
            if (isBrowser && contactData.id && result.resourceName) {
                try {
                    const mapStr = localStorage.getItem('googleContactsMap') || '{}';
                    const map = JSON.parse(mapStr);
                    map[contactData.id] = result.resourceName;
                    localStorage.setItem('googleContactsMap', JSON.stringify(map));
                    console.log('Mapa de contactos actualizado para nuevo contacto');
                } catch (e) {
                    console.error('Error al guardar mapa de contactos:', e);
                }
            }
            
            notifications.success('Contacto creado en Google Contacts');
            return result;
        }
    } catch (error) {
        console.error('Error en syncContact:', error);
        notifications.error(`Error al sincronizar contacto con Google: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

// Buscar contacto por email o teléfono
export async function buscarContacto(contactData: any, accessToken: string) {
    try {
        // Obtener la lista de contactos
        const response = await fetch(
            'https://people.googleapis.com/v1/people/me/connections' +
            '?personFields=metadata,names,emailAddresses,phoneNumbers' +
            '&pageSize=1000',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error en la respuesta de Google:', errorText);
            notifications.error(`Error al obtener contactos de Google: ${response.status} ${errorText}`);
            throw new Error('Error al obtener contactos de Google');
        }

        const data = await response.json();
        const connections = data.connections || [];

        console.log('Buscando contacto con:', {
            email: contactData.email,
            telefono: contactData.telephon
        });

        // Buscar el contacto que coincida con el email o teléfono
        const contactoEncontrado = connections.find((contact: any) => {
            const emails = contact.emailAddresses || [];
            const phones = contact.phoneNumbers || [];
            
            const encontrado = emails.some((email: any) => email.value === contactData.email) ||
                             phones.some((phone: any) => phone.value === contactData.telephon);
            
            if (encontrado) {
                console.log('Contacto encontrado:', contact);
            }
            
            return encontrado;
        });

        return contactoEncontrado || null;
    } catch (error) {
        console.error('Error al buscar contacto:', error);
        notifications.error(`Error al buscar contacto en Google: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

// Eliminar contacto de Google
export async function eliminarContacto(contactData: any, accessToken: string) {
    try {
        // Primero buscamos el contacto en Google
        const contactoGoogle = await buscarContacto(contactData, accessToken);
        
        if (!contactoGoogle) {
            console.log('Contacto no encontrado en Google Contacts');
            return;
        }

        // Obtener el ID del contacto desde metadata
        const resourceId = contactoGoogle.resourceName;
        if (!resourceId) {
            throw new Error('No se pudo obtener el ID del contacto');
        }

        console.log('Intentando eliminar contacto con resourceName:', resourceId);

        // Eliminar el contacto usando su resourceName completo
        const response = await fetch(`https://people.googleapis.com/v1/${resourceId}:deleteContact`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error en la respuesta de eliminación:', errorText);
            
            // Si el error es de autorización, intentar reconectar
            if (response.status === 401) {
                console.log('Token expirado o inválido, redirigiendo a autenticación');
                localStorage.removeItem('googleTokens');
                window.location.href = getAuthUrl();
                return;
            }
            
            throw new Error('Error al eliminar contacto de Google');
        }

        console.log('Contacto eliminado exitosamente de Google');
        return true;
    } catch (error) {
        console.error('Error al eliminar contacto de Google:', error);
        throw error;
    }
}

// Eliminar contacto de Google
export async function deleteGoogleContact(resourceName: string, accessToken: string) {
    try {
        if (!isBrowser) return;
        
        // Obtener token válido
        const token = accessToken || getAccessTokenRefreshed();
        if (!token) {
            console.log('No hay token válido, redirigiendo a autenticación');
            window.location.href = getAuthUrl();
            return;
        }

        const response = await fetch(`https://people.googleapis.com/v1/${resourceName}:deleteContact`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error en la respuesta de Google:', errorText);
            
            // Si el error es de autorización, intentar refrescar el token
            if (response.status === 401) {
                console.log('Token expirado o inválido, intentando refrescar...');
                const tokensStr = localStorage.getItem('googleTokens');
                if (!tokensStr) {
                    console.error('No hay tokens almacenados para refrescar');
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                    return null;
                }
                
                try {
                    const tokens = JSON.parse(tokensStr);
                    const newTokens = await refreshToken(tokens.refresh_token);
                    
                    if (newTokens) {
                        // Reintentar con el nuevo token
                        return deleteGoogleContact(resourceName, newTokens.access_token);
                    } else {
                        // Si no se pudo refrescar, redirigir a autenticación
                        localStorage.removeItem('googleTokens');
                        window.location.href = getAuthUrl();
                        return null;
                    }
                } catch (error) {
                    console.error('Error al refrescar token:', error);
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                    return null;
                }
            }
            
            throw new Error('Error al eliminar contacto de Google');
        }

        return { success: true };
    } catch (error) {
        console.error('Error al eliminar contacto de Google:', error);
        throw error;
    }
}

// Actualizar contacto en Google
export async function updateGoogleContact(resourceName: string, contactData: any, accessToken: string) {
    try {
        if (!isBrowser) return;
        
        // Obtener token válido
        const token = accessToken || getAccessTokenRefreshed();
        if (!token) {
            console.log('No hay token válido, redirigiendo a autenticación');
            window.location.href = getAuthUrl();
            return;
        }

        // Primero obtenemos el contacto actual para conseguir su etag
        const getContactUrl = `https://people.googleapis.com/v1/${resourceName}?personFields=names,emailAddresses,phoneNumbers,organizations,biographies,metadata`;
        
        const getResponse = await fetch(getContactUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!getResponse.ok) {
            const errorText = await getResponse.text();
            console.error('Error al obtener contacto de Google:', errorText);
            
            // Si el error es de autorización, intentar refrescar el token
            if (getResponse.status === 401) {
                console.log('Token expirado o inválido, intentando refrescar...');
                const tokensStr = localStorage.getItem('googleTokens');
                if (!tokensStr) {
                    console.error('No hay tokens almacenados para refrescar');
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                    return null;
                }
                
                try {
                    const tokens = JSON.parse(tokensStr);
                    const newTokens = await refreshToken(tokens.refresh_token);
                    
                    if (newTokens) {
                        // Reintentar con el nuevo token
                        return updateGoogleContact(resourceName, contactData, newTokens.access_token);
                    } else {
                        // Si no se pudo refrescar, redirigir a autenticación
                        localStorage.removeItem('googleTokens');
                        window.location.href = getAuthUrl();
                        return null;
                    }
                } catch (error) {
                    console.error('Error al refrescar token:', error);
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                    return null;
                }
            }
            
            throw new Error('Error al obtener información del contacto en Google');
        }
        
        const contactInfo = await getResponse.json();
        const etag = contactInfo.etag;
        
        if (!etag) {
            throw new Error('No se pudo obtener el etag del contacto');
        }

        // Transformar los datos para Google (modo actualización)
        const googleData = transformarParaGoogle(contactData, true);
        
        // Añadir el etag
        googleData.etag = etag;

        const response = await fetch(`https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers,organizations,biographies`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error en la respuesta de Google:', errorText);
            
            // Si el error es de autorización, intentar refrescar el token
            if (response.status === 401) {
                console.log('Token expirado o inválido, intentando refrescar...');
                const tokensStr = localStorage.getItem('googleTokens');
                if (!tokensStr) {
                    console.error('No hay tokens almacenados para refrescar');
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                    return null;
                }
                
                try {
                    const tokens = JSON.parse(tokensStr);
                    const newTokens = await refreshToken(tokens.refresh_token);
                    
                    if (newTokens) {
                        // Reintentar con el nuevo token
                        return updateGoogleContact(resourceName, contactData, newTokens.access_token);
                    } else {
                        // Si no se pudo refrescar, redirigir a autenticación
                        localStorage.removeItem('googleTokens');
                        window.location.href = getAuthUrl();
                        return null;
                    }
                } catch (error) {
                    console.error('Error al refrescar token:', error);
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                    return null;
                }
            }
            
            throw new Error('Error al actualizar contacto en Google');
        }

        return response.json();
    } catch (error) {
        console.error('Error al actualizar contacto en Google:', error);
        throw error;
    }
}

// Verificar si el usuario está autenticado con Google
export async function isGoogleAuthenticated() {
    if (!isBrowser) return false;
    
    try {
        const tokensStr = localStorage.getItem('googleTokens');
        if (!tokensStr) return false;
        
        const tokens = JSON.parse(tokensStr);
        
        // Verificar si el token es válido
        const isValid = tokens.expiry_date > Date.now();
        
        // Si el token no es válido pero tenemos refresh_token, intentar refrescarlo
        if (!isValid && tokens.refresh_token) {
            console.log('Token expirado, intentando refrescar...');
            // No esperamos aquí para no bloquear, pero iniciamos el proceso
            const newTokens = await refreshToken(tokens.refresh_token);
            if (newTokens) {
                return true;
            }
        }
        
        return isValid;
    } catch (error) {
        console.error('Error al verificar autenticación de Google:', error);
        return false;
    }
}
