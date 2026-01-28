import type { Property as AppProperty } from "$lib/types";
import { syncChanges, type SyncResult } from "./easybroker";

// Función para adaptar el formato de propiedades de la app al formato esperado por easybroker
function adaptProperties(properties: AppProperty[]) {
  return properties.map(prop => ({
    // Usar public_id como id para compatibilidad
    id: prop.public_id || '',
    ...prop
  }));
}

/**
 * Sincroniza propiedades con servicios externos
 */
export async function syncPropertiesWithEasyBroker(properties: AppProperty[]): Promise<SyncResult> {
  // Validar entrada
  if (!Array.isArray(properties)) {
    return {
      success: false,
      error: "Formato de propiedades inválido",
      count: 0
    };
  }

  // Filtrar propiedades válidas que tengan public_id
  const validProperties = properties.filter(p => p && p.public_id);
  
  if (validProperties.length === 0) {
    return {
      success: false,
      error: "No hay propiedades válidas para sincronizar",
      count: 0
    };
  }

  // Convertir propiedades al formato esperado por easybroker
  const adaptedProperties = adaptProperties(validProperties);

  // Llamar a la función de sincronización
  try {
    return await syncChanges(adaptedProperties);
  } catch (error) {
    console.error("Error al sincronizar propiedades:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      count: 0
    };
  }
}
