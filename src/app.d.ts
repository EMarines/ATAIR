// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				uid?: string;
				email?: string;
				displayName?: string;
				photoURL?: string;
				emailVerified?: boolean;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	// Global constant for versioning
	const __APP_VERSION__: string;
}

export {};
