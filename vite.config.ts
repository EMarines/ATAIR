

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';

/** @type {import('vite').UserConfig} */
const config = defineConfig({
  cacheDir: './.vite_cache',
  plugins: [sveltekit()],
  build: {
    target: 'esnext', // Cambia el target a 'esnext' para soportar top-level await
  },
  server: {
    fs: {
      // Permitir servir archivos desde fuera del directorio raíz
      allow: [
        // Añadir la ruta a tu archivo empresa.json
        resolve('static/data')
      ]
    }
  }
});

export default config;