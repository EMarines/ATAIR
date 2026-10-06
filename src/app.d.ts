declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				uid: string;
				email: string;
				displayName?: string;
				photoURL?: string;
				role: 'admin' | 'asociado' | 'user';
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	const __APP_VERSION__: string;
}

export {};
