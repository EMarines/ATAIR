// import { sveltekit } from '@sveltejs/kit/vite';
// import { defineConfig } from 'vite';

// export default defineConfig({
// 	plugins: [sveltekit()],
// 	// Configuración global para Vite
// 	build: {
// 		// Asegurarse de que no hay configuraciones que puedan causar problemas
// 		sourcemap: true
// 	}
// });

import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  build: {
    target: 'esnext', // Cambia el target a 'esnext' para soportar top-level await
  },
};

export default config;