export const CANONICAL_UBICACIONES = [
    'norte', 'noreste', 'noroeste', 'oeste', 'este',
    'centronorte', 'centrosur', 'sureste', 'suroeste', 'sur'
];

export function tagToUbicacion(input: any): string | null {
    if (!input) return null;

    // Si es un objeto complejo (ej. objeto Property)
    if (typeof input === 'object' && !Array.isArray(input)) {
        if (input.ubicacion && typeof input.ubicacion === 'string') {
            const z = tagToUbicacion(input.ubicacion);
            if (z) return z;
        }
        if (input.zona && typeof input.zona === 'string') {
            const z = tagToUbicacion(input.zona);
            if (z) return z;
        }
        if (Array.isArray(input.locaProperty) && input.locaProperty.length > 0) {
            const z = tagToUbicacion(input.locaProperty);
            if (z) return z;
        }
        if (Array.isArray(input.tags) && input.tags.length > 0) {
            const z = tagToUbicacion(input.tags);
            if (z) return z;
        }
        if (typeof input.location === 'string') {
            const z = tagToUbicacion(input.location);
            if (z) return z;
        }
        return null;
    }

    // Si es un array
    if (Array.isArray(input)) {
        for (const item of input) {
            const z = tagToUbicacion(item);
            if (z) return z;
        }
        return null;
    }

    // Si es un string
    if (typeof input === 'string') {
        const clean = input.toLowerCase().trim();
        const norm = clean.replace(/[\s\-_]+/g, '');
        if (CANONICAL_UBICACIONES.includes(norm)) {
            return norm;
        }
        for (const u of CANONICAL_UBICACIONES) {
            if (norm.includes(u)) {
                return u;
            }
        }
    }

    return null;
}

export function formatZona(zonaOrProp: any): string {
    const rawZona = tagToUbicacion(zonaOrProp);
    if (!rawZona) return '';

    const map: Record<string, string> = {
        'centronorte': 'Centronorte',
        'centrosur': 'Centrosur',
        'norte': 'Norte',
        'sur': 'Sur',
        'noreste': 'Noreste',
        'noroeste': 'Noroeste',
        'este': 'Este',
        'oeste': 'Oeste',
        'sureste': 'Sureste',
        'suroeste': 'Suroeste'
    };
    return map[rawZona.toLowerCase()] || (rawZona.charAt(0).toUpperCase() + rawZona.slice(1));
}

export function tagToFeatures(arr: string[] | null | undefined): string[] {
    if (!Array.isArray(arr)) return [];

    return arr.filter(item => {
        if (!item || typeof item !== 'string') return false;
        const norm = item.toLowerCase().trim().replace(/[\s\-_]+/g, '');
        return !CANONICAL_UBICACIONES.includes(norm);
    });
}

