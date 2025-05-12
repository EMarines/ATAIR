import type { ConfiguracionEmpresa } from '$lib/types';

// Para uso en servidor (SSR)
export async function getEmpresaData(): Promise<ConfiguracionEmpresa> {
  try {
    // En el servidor
    if (typeof window === 'undefined') {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const data = readFileSync(join(process.cwd(), 'static/data/empresa.json'), 'utf-8');
      return JSON.parse(data);
    }
    // En el cliente
    else {
      const response = await fetch('/data/empresa.json');
      return await response.json();
    }
  } catch (error) {
    console.error('Error loading empresa data:', error);
    throw new Error('Failed to load company data');
  }
}

// Versión sincrónica para imports (sólo disponible durante la compilación)
import empresaData from '../../../static/data/empresa.json';
export const empresa: ConfiguracionEmpresa = empresaData;