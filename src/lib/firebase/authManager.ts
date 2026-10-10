// src/lib/firebase/authManager.ts
// Gestor de Autenticación Central con Soporte Multi-Admin y Rol Asociado

import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	sendPasswordResetEmail,
	type User
} from 'firebase/auth';
import {
	doc,
	setDoc,
	onSnapshot,
	serverTimestamp,
	type Unsubscribe
} from 'firebase/firestore';
import { auth, db } from './config';
import type { UserProfile, UserRole } from '$lib/types/auth';

// Correos fundadores con privilegio inicial de admin (Bootstrap)
const BOOTSTRAP_ADMIN_EMAILS = [
	'marines.enrique@gmail.com',
	'matchhomebr@gmail.com',
	'matchhome@hotmail.com'
];

function getCachedItem<T>(key: string): T | null {
	if (!browser) return null;
	try {
		const val = localStorage.getItem(key);
		return val ? JSON.parse(val) : null;
	} catch {
		return null;
	}
}

const initialCachedUser = getCachedItem<any>('atair_user');
const initialCachedProfile = getCachedItem<UserProfile>('atair_profile');

// Stores Reactivos
export const userStore = writable<User | null>(initialCachedUser);
export const userProfile = writable<UserProfile | null>(initialCachedProfile);
export const authLoading = writable<boolean>(!initialCachedUser && !initialCachedProfile);
export const authInitialized = writable<boolean>(false);

// Stores Derivados de Roles
export const isAdmin = derived(
	userProfile,
	($profile) => $profile?.role === 'admin' && $profile?.isActive !== false
);

export const isAsociado = derived(
	userProfile,
	($profile) => $profile?.role === 'asociado' && $profile?.isActive !== false
);

export const currentRole = derived(
	userProfile,
	($profile) => ($profile?.role as UserRole) || 'user'
);

let profileUnsubscribe: Unsubscribe | null = null;
let listenerAttached = false;

/**
 * Notifica al servidor SvelteKit sobre el estado de sesión para cookies seguras
 */
async function syncSessionWithServer(token: string | null, profile: UserProfile | null) {
	if (!browser) return;
	try {
		await fetch('/api/auth/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				token: token || null,
				role: profile?.role || null,
				uid: profile?.uid || null,
				email: profile?.email || null
			})
		});
	} catch (err) {
		console.warn('[AuthManager] Error sincronizando sesión con servidor:', err);
	}
}

/**
 * Escucha cambios en tiempo real en el perfil de Firestore del usuario
 */
function attachProfileListener(user: User) {
	if (profileUnsubscribe) {
		profileUnsubscribe();
		profileUnsubscribe = null;
	}

	const userDocRef = doc(db, 'users', user.uid);

	profileUnsubscribe = onSnapshot(
		userDocRef,
		async (snapshot) => {
			if (snapshot.exists()) {
				const data = snapshot.data() as UserProfile;
				const fullProfile: UserProfile = {
					...data,
					uid: user.uid,
					email: user.email || data.email,
					role: data.role || (BOOTSTRAP_ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'user'),
					isActive: data.isActive !== undefined ? data.isActive : true
				};

				userProfile.set(fullProfile);
				if (browser) {
					localStorage.setItem('atair_profile', JSON.stringify(fullProfile));
				}

				const token = await user.getIdToken();
				syncSessionWithServer(token, fullProfile);
			} else {
				// Crear perfil inicial si no existe
				const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(user.email || '');
				const initialRole: UserRole = isBootstrapAdmin ? 'admin' : 'user';

				const newProfile: UserProfile = {
					uid: user.uid,
					email: user.email || '',
					displayName: user.displayName || user.email?.split('@')[0] || '',
					role: initialRole,
					isActive: true,
					city_id: 'cuu',
					createdAt: serverTimestamp(),
					lastLogin: serverTimestamp()
				};

				await setDoc(userDocRef, newProfile, { merge: true });
				userProfile.set(newProfile);
				if (browser) {
					localStorage.setItem('atair_profile', JSON.stringify(newProfile));
				}

				const token = await user.getIdToken();
				syncSessionWithServer(token, newProfile);
			}
			authLoading.set(false);
			authInitialized.set(true);
		},
		(error) => {
			console.error('[AuthManager] Error en listener de perfil:', error);
			authLoading.set(false);
			authInitialized.set(true);
		}
	);
}

/**
 * Inicialización principal del listener de Firebase Auth
 */
export async function initializeAuthManager() {
	if (!browser || listenerAttached) return;
	listenerAttached = true;

	// Fallback de seguridad: si Firebase Auth tarda más de 2.5s, liberar el bloqueo de pantalla
	setTimeout(() => {
		if (get(authLoading)) {
			authLoading.set(false);
			authInitialized.set(true);
		}
	}, 2500);

	onAuthStateChanged(auth, async (user) => {
		if (user) {
			userStore.set(user);
			if (browser) {
				localStorage.setItem('atair_user', JSON.stringify({
					uid: user.uid,
					email: user.email,
					displayName: user.displayName
				}));
			}
			attachProfileListener(user);
		} else {
			// Si hay una sesión dev activa en localStorage, conservarla sin borrar
			const cachedProfile = getCachedItem<UserProfile>('atair_profile');
			if (cachedProfile && cachedProfile.uid?.startsWith('dev-')) {
				const fakeUser: any = {
					uid: cachedProfile.uid,
					email: cachedProfile.email,
					displayName: cachedProfile.displayName || cachedProfile.name,
					getIdToken: async () => 'dev-token-' + cachedProfile.role
				};
				userProfile.set(cachedProfile);
				userStore.set(fakeUser);
				await syncSessionWithServer('dev-token-' + cachedProfile.role, cachedProfile);
				authLoading.set(false);
				authInitialized.set(true);
				return;
			}

			if (profileUnsubscribe) {
				profileUnsubscribe();
				profileUnsubscribe = null;
			}
			userStore.set(null);
			userProfile.set(null);
			if (browser) {
				localStorage.removeItem('atair_user');
				localStorage.removeItem('atair_profile');
			}
			await syncSessionWithServer(null, null);
			authLoading.set(false);
			authInitialized.set(true);
		}
	});
}

/**
 * Iniciar sesión rápida de desarrollo (Admin o Asociado) sin contraseña
 */
export async function setDevRole(role: 'admin' | 'asociado' = 'admin') {
	const profile: UserProfile = {
		uid: role === 'admin' ? 'dev-admin-enrique' : 'dev-asociada-claudia',
		email: role === 'admin' ? 'marines.enrique@gmail.com' : 'claudia.asociada@matchhome.net',
		name: role === 'admin' ? 'Enrique Marines' : 'Claudia Asociada',
		displayName: role === 'admin' ? 'Enrique Marines' : 'Claudia Asociada',
		role: role,
		isActive: true,
		city_id: 'cuu'
	};

	const fakeUser: any = {
		uid: profile.uid,
		email: profile.email,
		displayName: profile.displayName,
		getIdToken: async () => 'dev-token-' + role
	};

	userStore.set(fakeUser);
	userProfile.set(profile);
	authLoading.set(false);
	authInitialized.set(true);

	if (browser) {
		localStorage.setItem('atair_user', JSON.stringify({ uid: profile.uid, email: profile.email, displayName: profile.displayName }));
		localStorage.setItem('atair_profile', JSON.stringify(profile));
	}

	await syncSessionWithServer('dev-token-' + role, profile);
	return profile;
}

/**
 * Iniciar sesión con email y contraseña
 */
export async function loginWithEmailPassword(emailVal: string, passwordVal: string) {
	try {
		authLoading.set(true);
		const userCredential = await signInWithEmailAndPassword(auth, emailVal.trim(), passwordVal);
		const user = userCredential.user;

		// Actualizar lastLogin de forma no bloqueante
		const userDocRef = doc(db, 'users', user.uid);
		setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true }).catch(console.warn);

		return { success: true, user };
	} catch (error: any) {
		authLoading.set(false);
		return { success: false, code: error.code, message: error.message };
	}
}

/**
 * Registro de nuevo usuario (Asociado o Administrador)
 */
export async function registerWithEmailPassword(
	emailVal: string,
	passwordVal: string,
	options: { role?: UserRole; name?: string; phone?: string; city_id?: string } = {}
) {
	try {
		authLoading.set(true);
		const userCredential = await createUserWithEmailAndPassword(auth, emailVal.trim(), passwordVal);
		const user = userCredential.user;

		const roleToAssign: UserRole = options.role || (BOOTSTRAP_ADMIN_EMAILS.includes(emailVal.trim()) ? 'admin' : 'asociado');

		const profileData: UserProfile = {
			uid: user.uid,
			email: user.email || emailVal.trim(),
			name: options.name || '',
			displayName: options.name || user.email?.split('@')[0] || '',
			phone: options.phone || '',
			role: roleToAssign,
			city_id: options.city_id || 'cuu',
			isActive: true,
			createdAt: serverTimestamp(),
			lastLogin: serverTimestamp()
		};

		const userDocRef = doc(db, 'users', user.uid);
		await setDoc(userDocRef, profileData);

		return { success: true, user, profile: profileData };
	} catch (error: any) {
		authLoading.set(false);
		return { success: false, code: error.code, message: error.message };
	}
}

/**
 * Cerrar sesión
 */
export async function logoutUser() {
	try {
		if (profileUnsubscribe) {
			profileUnsubscribe();
			profileUnsubscribe = null;
		}
		await signOut(auth);
		userStore.set(null);
		userProfile.set(null);
		if (browser) {
			localStorage.removeItem('atair_user');
			localStorage.removeItem('atair_profile');
		}
		await syncSessionWithServer(null, null);
		return { success: true };
	} catch (error: any) {
		return { success: false, message: error.message };
	}
}

/**
 * Recuperar contraseña
 */
export async function sendPasswordReset(emailVal: string) {
	try {
		await sendPasswordResetEmail(auth, emailVal.trim());
		return { success: true };
	} catch (error: any) {
		return { success: false, code: error.code, message: error.message };
	}
}
