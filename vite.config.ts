import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Configuración global para Vite
	build: {
		// Asegurarse de que no hay configuraciones que puedan causar problemas
		sourcemap: true
	}
});
