import { browser } from '$app/environment';
// El cargador universal ahora solo devuelve un objeto vacío.

export const load = async () => {
    // El cargador universal ahora solo devuelve un objeto vacío.
    // Toda la lógica de autenticación y carga de datos se ha centralizado
    // en +layout.svelte y authManager.ts para evitar conflictos de persistencia
    // y duplicidad de listeners durante la hidratación.
    
    return {
        // Mantenemos las claves para evitar errores si algún componente hijo las espera,
        // pero los datos reales vendrán de los stores suscritos en el cliente.
        contacts: [],
        binnacles: [],
        properties: [],
        todos: []
    };
};