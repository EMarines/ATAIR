import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	compilerOptions: {
		// Asegurarse de que no hay opciones incompatibles con Svelte 4
	},

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			// Opciones específicas para el adaptador de Vercel
			runtime: 'nodejs18.x',
			edge: false,
			split: false
		}),
		alias: {
			$components: 'src/lib/components',
			$functions: 'src/lib/functions'
		}
	}
};

export default config;
