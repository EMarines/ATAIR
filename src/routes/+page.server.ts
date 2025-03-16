import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  // Si estamos en la ruta raíz, redirigir a la página principal
  if (url.pathname === '/') {
    return {}; // Devolver datos vacíos, la página +page.svelte se encargará de mostrar el contenido
  }
  
  // Para cualquier otra ruta que no exista, dejamos que SvelteKit maneje el 404
  return {};
};
