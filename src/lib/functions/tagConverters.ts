export function tagToUbicacion(input: string | string[]) {
    const direcciones = [
        'norte', 'noreste', 'noroeste', 'oeste', 'este',
        'centronorte', 'centrosur', 'sureste', 'suroeste'
    ];

    // Convertir el input a un array de palabras
    const palabras = Array.isArray(input)
        ? input.map(palabra => palabra.toLowerCase().trim())
        : input.toLowerCase().trim().split(/\s+/);

    // Buscar la primera coincidencia en direcciones
    for (const palabra of palabras) {
        if (direcciones.includes(palabra)) {
            return palabra;
        }
    }

    return null;
}

export function tagToFeatures(arr: string[]) {
    const tags = [
        'Fracc. Privado', 'Frente a Parque', 'Una Planta', 'Recamara en P.B.',
        'Patio Amplio', 'Lista para Habitarse', 'Nueva', 'Alberca'    
    ];

    const resultados: string[] = [];

    for (const item of arr) {
        if (item) {
            const valor = item.toLowerCase().trim();
            for (const tag of tags) {
                if (valor === tag && !resultados.includes(tag)) {
                    resultados.push(tag);
                }
            }
        }
    }

    // Devolver todas las coincidencias encontradas
    return resultados.length > 0 ? resultados : null;
}
