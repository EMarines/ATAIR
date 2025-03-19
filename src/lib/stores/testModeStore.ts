import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Nombre de la clave en localStorage
const STORAGE_KEY = 'testMode';

// Función para obtener el valor inicial del localStorage
function getInitialValue(): boolean {
  if (!browser) return false;
  
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : false;
  } catch (error) {
    console.error('Error al leer testMode de localStorage:', error);
    return false;
  }
}

// Crear el store con el valor inicial
export const testMode = writable<boolean>(getInitialValue());

// Función para guardar el valor en localStorage
function saveToLocalStorage(value: boolean): void {
  if (!browser) return;
  
  try {
    console.log('Guardando testMode en localStorage:', value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Error al guardar testMode en localStorage:', error);
  }
}

// Suscribirse a cambios para guardar en localStorage
if (browser) {
  testMode.subscribe(value => {
    saveToLocalStorage(value);
  });
}

// Función para cambiar el modo de prueba
export function toggleTestMode(): Promise<void> {
  return new Promise((resolve) => {
    testMode.update(currentValue => {
      const newValue = !currentValue;
      console.log(`Cambiando testMode de ${currentValue} a ${newValue}`);
      return newValue;
    });
    
    // Dar tiempo para que el store se actualice
    setTimeout(resolve, 100);
  });
}

// Función para establecer el modo de prueba directamente
export function setTestMode(value: boolean): Promise<void> {
  return new Promise((resolve) => {
    console.log(`Estableciendo testMode a ${value}`);
    testMode.set(value);
    
    // Dar tiempo para que el store se actualice
    setTimeout(resolve, 100);
  });
}

// Función para obtener el valor actual del modo de prueba
export function getTestMode(): boolean {
  if (browser) {
    return getInitialValue();
  }
  return false;
}
