// src/lib/types/auth.ts
// Tipos de Autenticación, Roles y Perfiles para ATAIR CRM

export type UserRole = 'admin' | 'asociado' | 'user';

export interface UserProfile {
	uid: string;
	email: string;
	name?: string;
	lastname?: string;
	displayName?: string;
	photoURL?: string;
	role: UserRole;
	city_id?: string; // Chihuahua ('cuu'), Delicias ('del'), etc.
	phone?: string;
	isActive: boolean;
	commissionRate?: number; // Ej. 42.5% o 45%
	createdAt?: any;
	lastLogin?: any;
	updatedAt?: any;
}

export interface AuthState {
	user: any | null;
	profile: UserProfile | null;
	loading: boolean;
	initialized: boolean;
	isAdmin: boolean;
	isAsociado: boolean;
}
