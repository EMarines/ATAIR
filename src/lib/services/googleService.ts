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
} | null = null;

// Obtener URL de autorización
export function getAuthUrl() {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Obtener tokens con el código de autorización
export async function getTokens(code: string) {
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
        throw new Error('Error al obtener tokens');
    }

    const tokens = await response.json();
    
    // Calcular la fecha de expiración si no viene incluida
    if (!tokens.expiry_date) {
        tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
    }
    
    // Guardar en caché
    cachedTokens = tokens;
    
    return tokens;
}

// Actualizar token usando refresh_token
export async function refreshToken() {
    if (!isBrowser) return null;
    
    try {
        // Obtener tokens almacenados
        const tokensStr = localStorage.getItem('googleTokens');
        if (!tokensStr) return null;
        
        const tokens = JSON.parse(tokensStr);
        if (!tokens.refresh_token) return null;
        
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token
            })
        });

        if (!response.ok) {
            console.error('Error al refrescar token:', await response.text());
            return null;
        }

        const newTokens = await response.json();
        
        // Mantener el refresh_token ya que Google no lo devuelve en cada refresh
        newTokens.refresh_token = tokens.refresh_token;
        
        // Calcular la fecha de expiración
        newTokens.expiry_date = Date.now() + (newTokens.expires_in * 1000);
        
        // Guardar en localStorage y en caché
        localStorage.setItem('googleTokens', JSON.stringify(newTokens));
        cachedTokens = newTokens;
        
        console.log('Token refrescado exitosamente');
        return newTokens;
    } catch (error) {
        console.error('Error al refrescar token:', error);
        return null;
    }
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
            refreshToken();
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
                const newTokens = await refreshToken();
                if (newTokens) {
                    return newTokens.access_token;
                }
            }
            return cachedTokens.access_token;
        }
        
        const tokensStr = localStorage.getItem('googleTokens');
        if (!tokensStr) {
            console.log('No hay tokens almacenados en localStorage');
            notifications.warning('No hay conexión con Google Contacts. Conéctate para sincronizar contactos.');
            return null;
        }
        
        const tokens = JSON.parse(tokensStr);
        
        // Guardar en caché
        cachedTokens = tokens;
        
        // Si está a punto de expirar, refrescarlo
        if (tokens.expiry_date < Date.now() + (5 * 60 * 1000)) {
            console.log('Token a punto de expirar, refrescando...');
            const newTokens = await refreshToken();
            if (newTokens) {
                return newTokens.access_token;
            }
        }
        
        return tokens.access_token;
    } catch (error) {
        console.error('Error al obtener access token:', error);
        notifications.error(`Error al obtener token de acceso: ${error instanceof Error ? error.message : String(error)}`);
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
                throw new Error(`Error al crear contacto: ${response.status} ${errorText}`);
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
        const token = accessToken || getAccessToken();
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
                const newTokens = await refreshToken();
                
                if (newTokens) {
                    // Reintentar con el nuevo token
                    return deleteGoogleContact(resourceName, newTokens.access_token);
                } else {
                    // Si no se pudo refrescar, redirigir a autenticación
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                }
                return;
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
        const token = accessToken || getAccessToken();
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
                const newTokens = await refreshToken();
                
                if (newTokens) {
                    // Reintentar con el nuevo token
                    return updateGoogleContact(resourceName, contactData, newTokens.access_token);
                } else {
                    // Si no se pudo refrescar, redirigir a autenticación
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                }
                return;
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
                const newTokens = await refreshToken();
                
                if (newTokens) {
                    // Reintentar con el nuevo token
                    return updateGoogleContact(resourceName, contactData, newTokens.access_token);
                } else {
                    // Si no se pudo refrescar, redirigir a autenticación
                    localStorage.removeItem('googleTokens');
                    window.location.href = getAuthUrl();
                }
                return;
            }
            
            throw new Error('Error al actualizar contacto en Google');
        }

        return response.json();
    } catch (error) {
        console.error('Error al actualizar contacto en Google:', error);
        throw error;
    }
}
