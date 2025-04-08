import { syncChanges, type SyncResult } from "$lib/functions/easybroker";
import type { Property as AppProperty } from "$lib/types";

// Definir un tipo que coincida con lo que espera easybroker
// interface EasyBrokerProperty {
//   id: string;
//   [key: string]: unknown;
// }

/**
 * Adapta las propiedades al formato que espera easybroker
 * @param properties Propiedades de la aplicación
 * @returns Propiedades en formato compatible con easybroker
 */
function adaptPropertiesToEasyBrokerFormat(properties: AppProperty[]) {
  return properties.map(prop => ({
    id: prop.public_id || '', // Usar public_id como id
    ...prop
  }));
}

/**
 * Servicio para sincronizar propiedades con sistemas externos
 * @param properties Array de propiedades a sincronizar
 * @returns Resultado de la sincronización
 */
export async function syncPropertiesWithEasyBroker(properties: AppProperty[]): Promise<SyncResult> {
  if (!Array.isArray(properties) || properties.length === 0) {
    console.warn("No hay propiedades válidas para sincronizar");
    return {
      success: false,
      error: "No hay propiedades para sincronizar",
      count: 0
    };
  }

  try {
    // Filtrar propiedades con ID válido
    const validAppProperties = properties.filter(p => p && p.public_id);
    
    if (validAppProperties.length === 0) {
      console.warn("Ninguna propiedad tiene ID válido");
      return {
        success: false,
        error: "No se encontraron propiedades con ID válido",
        count: 0
      };
    }

    // Adaptar al formato que espera easybroker
    const adaptedProperties= adaptPropertiesToEasyBrokerFormat(validAppProperties);

    console.log(`Iniciando sincronización de ${adaptedProperties.length} propiedades`);
    return await syncChanges(adaptedProperties);
  } catch (error) {
    console.error("Error en servicio de sincronización:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      count: 0
    };
  }
}
