export interface ContactUrlOptions {
    id?: string;
    name?: string;
    lastname?: string;
    telephon?: string;
    phone?: string;
    isNew?: boolean;
}

/**
 * Genera la URL pública de propuesta para matchhome.vercel.app.
 * - Contacto EXISTENTE (no nuevo, con ID en base de datos): Envía únicamente `?c={id}` para proteger la privacidad del cliente.
 * - Contacto NUEVO (alta de contacto): Envía `?c={Nombre+Apellido}&cliente={Nombre+Apellido}&tel={Telefono}` de forma inmediata sin esperar a Firestore.
 */
export function getProposalUrl(
    propertyPublicId?: string | null,
    contactOrIdentifier?: string | ContactUrlOptions | null,
    phone?: string | null
): string {
    if (!propertyPublicId) return '';
    const baseUrl = `https://matchhome.vercel.app/propuesta/${propertyPublicId}`;
    const params = new URLSearchParams();

    if (typeof contactOrIdentifier === 'string') {
        const clean = contactOrIdentifier.trim();
        if (clean) {
            params.set('c', clean);
        }
        if (phone) {
            const cleanTel = String(phone).replace(/\D/g, '');
            if (cleanTel) params.set('tel', cleanTel);
        }
    } else if (typeof contactOrIdentifier === 'object' && contactOrIdentifier !== null) {
        const c = contactOrIdentifier;
        const isNewContact = Boolean(c.isNew || !c.id || c.id.trim() === '');

        if (!isNewContact && c.id && c.id.trim() !== '') {
            // 🛡️ CONTACTO EXISTENTE: Solo enviamos el ID para no exponer datos personales en el link
            params.set('c', c.id.trim());
        } else {
            // ⚡ CONTACTO NUEVO: No tiene ID previo en base de datos, enviamos nombre, apellido y teléfono
            const fullName = `${c.name || ''} ${c.lastname || ''}`.trim() || c.name || '';
            const rawTel = phone || c.telephon || c.phone || '';
            const cleanTel = rawTel ? String(rawTel).replace(/\D/g, '') : '';

            if (fullName) {
                params.set('c', fullName);
                params.set('cliente', fullName);
            }
            if (cleanTel) {
                params.set('tel', cleanTel);
            }
        }
    }

    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
}

/**
 * Asegura que una URL de propuesta contenga el identificador adecuado sin exponer datos de contactos existentes.
 */
export function ensureContactInProposalUrl(
    url?: string | null,
    contactOrIdentifier?: string | ContactUrlOptions | null,
    phone?: string | null
): string {
    if (!url) return '';

    try {
        const parsedUrl = new URL(url);
        // Si la URL ya tiene el parámetro ?c=, la respetamos
        if (parsedUrl.searchParams.has('c')) {
            return url;
        }
    } catch {
        if (url.includes('?c=') || url.includes('&c=')) {
            return url;
        }
    }

    // Si no tiene parámetro, generamos usando la lógica estándar
    const match = url.match(/\/propuesta\/([^/?#]+)/);
    if (match && match[1]) {
        return getProposalUrl(match[1], contactOrIdentifier, phone);
    }

    return url;
}
