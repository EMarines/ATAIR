import { writeBatch, doc, getDoc } from "firebase/firestore";
import { db, auth } from "$lib/firebase_toggle";

// Mantenemos la definición existente de Property
interface Property {
  id: string;
  [key: string]: string | number | boolean | null | undefined | object;
}

// Definimos la estructura del resultado
export interface SyncResult {
  success: boolean;
  error?: string;
  count?: number;
}

/**
 * Sincroniza un conjunto de propiedades con Firestore
 */
export async function syncChanges(properties: Property[]): Promise<SyncResult> {
  try {
    // Verificar autenticación
    if (!auth.currentUser) {
      console.error("No hay usuario autenticado para sincronizar cambios");
      return { success: false, error: "No hay usuario autenticado" };
    }
    
    // Verificar propiedades
    if (!Array.isArray(properties) || properties.length === 0) {
      console.warn("No hay propiedades para sincronizar");
      return { success: false, error: "No hay propiedades para sincronizar" };
    }

    // Procesar en lotes pequeños
    const BATCH_SIZE = 100;
    let processedCount = 0;
    
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      const batch = properties.slice(i, i + BATCH_SIZE);
      try {
        await processBatch(batch);
        processedCount += batch.length;
        console.log(`Lote de propiedades ${i}-${i + batch.length} procesado correctamente`);
      } catch (batchError) {
        console.error(`Error procesando lote ${i}-${i + batch.length}:`, batchError);
      }
    }
    
    return { 
      success: processedCount > 0, 
      count: processedCount,
      error: processedCount < properties.length ? 
        `Procesados ${processedCount} de ${properties.length} elementos` : undefined
    };
  } catch (error) {
    console.error("Error al sincronizar cambios:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Procesa un lote de propiedades en un único batch de Firestore
 */
async function processBatch(properties: Property[]): Promise<void> {
  const batch = writeBatch(db);
  
  for (const property of properties) {
    if (!property.id) {
      console.warn("Propiedad sin ID, saltando:", property);
      continue;
    }
    
    try {
      const propertyRef = doc(db, "properties", property.id);
      const docSnap = await getDoc(propertyRef);
      
      const cleanedData = removeUndefinedFields(property);
      
      if (docSnap.exists()) {
        batch.update(propertyRef, cleanedData);
      } else {
        batch.set(propertyRef, cleanedData);
      }
    } catch (docError) {
      console.warn(`Error preparando documento ${property.id}:`, docError);
    }
  }
  
  return executeWithRetry(() => batch.commit());
}

/**
 * Elimina campos undefined o null de un objeto
 */
function removeUndefinedFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Ejecuta una operación con reintentos y backoff exponencial
 */
async function executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Intento ${attempt + 1}/${maxRetries} falló:`, error);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}