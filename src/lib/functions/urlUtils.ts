/**
 * Genera la URL pública de propuesta para matchhome.vercel.app.
 * Si se incluye un contactId, anexa el parámetro `?c={contactId}` para personalización.
 */
export function getProposalUrl(propertyPublicId?: string | null, contactId?: string | null): string {
    if (!propertyPublicId) return '';
    const baseUrl = `https://matchhome.vercel.app/propuesta/${propertyPublicId}`;
    if (contactId && contactId.trim() !== '') {
        return `${baseUrl}?c=${encodeURIComponent(contactId.trim())}`;
    }
    return baseUrl;
}

/**
 * Asegura que una URL de propuesta existente contenga el parámetro `?c={contactId}`.
 */
export function ensureContactInProposalUrl(url?: string | null, contactId?: string | null): string {
    if (!url) return '';
    if (!contactId || contactId.trim() === '') return url;
    
    // Si la URL ya contiene ?c= o &c=, la devolvemos tal cual
    if (url.includes('?c=') || url.includes('&c=')) {
        return url;
    }
    
    // Concatenar ?c= o &c= si es un enlace de propuesta
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}c=${encodeURIComponent(contactId.trim())}`;
}
