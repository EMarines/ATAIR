// c:\Users\Propietario\OneDrive\AB GrupoUrbania\OneDrive\Escritorio\Web Projects\ATAIR\src\lib\functions\tagConverters.ts

export function tagToUbicacion(input: string | string[]) {
    // ... (sin cambios, ya devuelve lowercase o null)
    const ubicaciones = [
        'norte', 'noreste', 'noroeste', 'oeste', 'este',
        'centronorte', 'centrosur', 'sureste', 'suroeste'
    ];

    if (!input) return null; // Añadir chequeo por si input es null/undefined

    const zonas = Array.isArray(input)
        ? input.map(zona => zona?.toLowerCase().trim() ?? '') // Usar optional chaining y nullish coalescing
        : typeof input === 'string' ? input.toLowerCase().trim().split(/\s+/) : []; // Asegurar que es string

    for (const zona of zonas) {
        if (zona && ubicaciones.includes(zona)) { // Chequear que zona no sea empty string
            return zona;
        }
    }

    return null;
}

export function tagToFeatures(arr: string[] | null | undefined): string[] { // Devolver siempre array (puede ser vacío)
    const predefinedTags = [ // Renombrar para claridad y poner en minúsculas para comparación directa
        'fracc. privado', 'frente a parque', 'una planta', 'recamara en p.b.',
        'patio amplio', 'lista para habitarse', 'nueva', 'alberca'
    ];

    const resultados: string[] = [];

    if (!Array.isArray(arr)) { // Si la entrada no es un array, devolver vacío
        return resultados;
    }

    for (const item of arr) {
        if (item) { // Asegurarse que el item existe
            const valorNormalizado = item.toLowerCase().trim();
            // Comprobar si el valor normalizado existe en nuestra lista de tags predefinidos (ya en minúsculas)
            if (predefinedTags.includes(valorNormalizado) && !resultados.includes(valorNormalizado)) {
                // Guardamos la versión normalizada (minúsculas)
                resultados.push(valorNormalizado);
            }
        }
    }
    // Eliminar el console.log dentro del bucle
    // console.log(tag); // <--- ELIMINAR ESTO

    // Devolver siempre un array (vacío si no hay coincidencias)
    return resultados;
}
