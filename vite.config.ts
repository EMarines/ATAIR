

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
    port: 5173,
    strictPort: true,
    fs: {
      // Permitir servir archivos desde fuera del directorio raíz
      allow: [
        // Añadir la ruta a tu archivo empresa.json
        resolve('static/data')
      ]
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify((() => {
      const date = new Date();
      // Year: Last 2 digits (e.g. 2026 -> 26)
      const year = date.getFullYear().toString().slice(-2);
      // Month: 1-12
      const month = date.getMonth() + 1;
      // Day: 1-31
      const day = date.getDate();
      // Time: HHMM
      const time = date.getHours().toString().padStart(2, '0') + date.getMinutes().toString().padStart(2, '0');
      
      return `V(${year}.${month}.${day}.${time})`;
    })())
  }
});

export default config;