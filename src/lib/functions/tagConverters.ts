

export function tagToUbicacion(input: string | string[]) {
    const ubicaciones = [
        'norte', 'noreste', 'noroeste', 'oeste', 'este',
        'centronorte', 'centrosur', 'sureste', 'suroeste'
    ];

    // Convertir el input a un array de zonas
    const zonas = Array.isArray(input)
        ? input.map(zona => zona.toLowerCase().trim())
        : input.toLowerCase().trim().split(/\s+/);

    // Buscar la primera coincidencia en ubicaciones
    for (const zona of zonas) {
        if (ubicaciones.includes(zona)) {
            console.log(zona);
            return zona;
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
