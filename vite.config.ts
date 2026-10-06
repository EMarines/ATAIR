import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		target: 'esnext'
	},
	server: {
		port: 5175,
		strictPort: false,
		fs: {
			allow: ['..']
		}
	},
	define: {
		__APP_VERSION__: JSON.stringify((() => {
			const date = new Date();
			const year = date.getFullYear().toString().slice(-2);
			const month = date.getMonth() + 1;
			const day = date.getDate();
			const time = date.getHours().toString().padStart(2, '0') + date.getMinutes().toString().padStart(2, '0');
			return `ATAIR-CRM-V(${year}.${month}.${day}.${time})`;
		})())
	}
});
