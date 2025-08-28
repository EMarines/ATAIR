// Configuración de persistencia de sesión
import { browser } from '$app/environment';

/**
 * Configuración de persistencia de sesión
 */
export const SESSION_CONFIG = {
  // Tiempo de vida de la sesión (en milisegundos)
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 horas
  
  // Clave para localStorage
  SESSION_KEY: 'firebase_session_persist',
  
  // Auto-renovación de token
  AUTO_RENEW_TOKEN: false, // Deshabilitado para evitar loops
};

/**
 * Verifica si la persistencia de sesión está habilitada
 */
export function isSessionPersistenceEnabled(): boolean {
  if (!browser) return false;
  
  try {
    const setting = localStorage.getItem(SESSION_CONFIG.SESSION_KEY);
    return setting !== 'false'; // Por defecto habilitada
  } catch (error) {
    console.warn('No se puede acceder a localStorage:', error);
    return true; // Por defecto habilitada si no se puede verificar
  }
}

/**
 * Habilita la persistencia de sesión
 */
export function enableSessionPersistence(): void {
  if (!browser) return;
  
  try {
    localStorage.setItem(SESSION_CONFIG.SESSION_KEY, 'true');
    console.log('✅ Persistencia de sesión habilitada');
  } catch (error) {
    console.error('Error habilitando persistencia de sesión:', error);
  }
}

/**
 * Deshabilita la persistencia de sesión
 */
export function disableSessionPersistence(): void {
  if (!browser) return;
  
  try {
    localStorage.setItem(SESSION_CONFIG.SESSION_KEY, 'false');
    console.log('⚠️ Persistencia de sesión deshabilitada');
  } catch (error) {
    console.error('Error deshabilitando persistencia de sesión:', error);
  }
}

/**
 * Limpia todos los datos de sesión
 */
export function clearSessionData(): void {
  if (!browser) return;
  
  try {
    localStorage.removeItem(SESSION_CONFIG.SESSION_KEY);
    console.log('🧹 Datos de sesión limpiados');
  } catch (error) {
    console.error('Error limpiando datos de sesión:', error);
  }
}
