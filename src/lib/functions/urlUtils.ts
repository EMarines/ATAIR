/**
 * Genera la URL pública de propuesta para matchhome.vercel.app.
 * Si se incluye un contactIdentifier (ID o Nombre), anexa el parámetro `?c={contactIdentifier}` para personalización.
 */
export function getProposalUrl(propertyPublicId?: string | null, contactIdentifier?: string | null): string {
    if (!propertyPublicId) return '';
    const baseUrl = `https://matchhome.vercel.app/propuesta/${propertyPublicId}`;
    if (contactIdentifier && contactIdentifier.trim() !== '') {
        return `${baseUrl}?c=${encodeURIComponent(contactIdentifier.trim())}`;
    }
    return baseUrl;
}

/**
 * Asegura que una URL de propuesta existente contenga el parámetro `?c={contactIdentifier}`.
 */
export function ensureContactInProposalUrl(url?: string | null, contactIdentifier?: string | null): string {
    if (!url) return '';
    if (!contactIdentifier || contactIdentifier.trim() === '') return url;
    
    // Si la URL ya contiene ?c= o &c=, la devolvemos tal cual
    if (url.includes('?c=') || url.includes('&c=')) {
        return url;
    }
    
    // Concatenar ?c= o &c= si es un enlace de propuesta
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}c=${encodeURIComponent(contactIdentifier.trim())}`;
}
