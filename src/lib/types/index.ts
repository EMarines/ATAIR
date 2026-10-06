// src/lib/types/index.ts
// Tipos unificados y canónicos para ATAIR CRM

export * from './auth';

export interface Contact {
	id: string;
	name: string;
	lastname?: string;
	fullName?: string;
	telephon: string;
	phoneRaw?: string;
	phoneFormatted?: string;
	email?: string;
	typeContact?: 'Comprador' | 'Arrendatario' | 'Agente' | 'Constructor' | string;
	contactStage?: number | string; // 1 (E1), 2 (E2), 3 (E3), 4 (E4), 5 (E5) | A1, A2
	source?: 'lona_llamada' | 'web' | 'referido' | 'redes' | string;
	lonaCode?: string;
	propertyInterestId?: string;
	propertyTitle?: string;
	presupuestoMax?: number | string;
	budgetTope?: string;
	budget?: number;
	comContact?: string;
	notes?: string;
	associate_id?: string;
	associate_name?: string;
	city_id?: string; // 'cuu', 'del'
	procedencia?: string; // 'S1', 'S2', 'S3', 'MH'
	isActive?: boolean;
	createdAt?: any;
	updatedAt?: any;
	[key: string]: any;
}

export interface Binnacle {
	id?: string;
	contactId: string;
	tipo?: 'llamada' | 'whatsapp' | 'visita' | 'nota' | 'sistema' | string;
	descripcion?: string;
	comment?: string;
	fecha?: any;
	date?: number;
	asesor?: string;
	author?: string;
	action?: string;
	[key: string]: any;
}

export interface Property {
	id?: string;
	public_id?: string;
	title?: string;
	titulo?: string;
	property_type?: string;
	tipoPropiedad?: string;
	price?: number;
	precio?: number;
	colonia?: string;
	location?: any;
	operation_type?: string;
	tipoOperacion?: string;
	bedrooms?: number;
	bathrooms?: number;
	title_image_thumb?: string;
	public_url?: string;
	[key: string]: any;
}

export interface ContactBadgeInfo {
	isAgent: boolean;
	shape: 'circle' | 'square';
	text: string;
	color: string;
	tooltip: string;
}

export interface Todo {
	id: string;
	task: string;
	endTask: number; // Timestamp Unix en ms de la fecha acordada
	timeString?: string; // HH:MM legible si tiene hora específica
	timeTask?: string; // Formato de entrada
	notes?: string;
	isCompleted: boolean;
	createdAt: number;
	type?: 'Llamada' | 'Visita' | 'Cita' | 'Trámite' | 'Google Tasks' | 'Google Calendar' | string;
	user?: string;
	associate_id?: string;
	associate_name?: string;
	contactId?: string;
	contactName?: string;
	googleTaskId?: string;
	googleEventId?: string;
	source?: 'google_tasks' | 'google_calendar' | 'crm' | string;
	[key: string]: any;
}
