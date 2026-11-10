import { writable, get } from 'svelte/store';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '$lib/firebase_toggle';
import type { Contact, Property, Binnacle } from '$lib/types';
import { isStage3Or4ForBroadcast } from '$lib/functions/contactBadge';
import { notifications } from '$lib/stores/notificationStore';

export interface BroadcastQueueItem {
	key: string; // `${propertyPublicId}::${contactId}`
	property: Property;
	contact: Contact;
}

export interface BroadcastFailure {
	contactId: string;
	contactName: string;
	phone: string;
	propertyId: string;
	error: string;
}

export interface WhatsappBroadcastState {
	isRunning: boolean;
	total: number;
	processed: number;
	sent: number;
	failed: number;
	currentContactName: string;
	currentPropertyId: string;
	queuedKeys: string[];
	sentKeys: string[];
	failedItems: BroadcastFailure[];
}

const RATE_LIMIT_DELAY_MS = 2200;

const initialState: WhatsappBroadcastState = {
	isRunning: false,
	total: 0,
	processed: 0,
	sent: 0,
	failed: 0,
	currentContactName: '',
	currentPropertyId: '',
	queuedKeys: [],
	sentKeys: [],
	failedItems: []
};

const internalStore = writable<WhatsappBroadcastState>({ ...initialState });

const pendingQueue: BroadcastQueueItem[] = [];
let workerPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue(): Promise<void> {
	while (pendingQueue.length > 0) {
		const item = pendingQueue.shift();
		if (!item) continue;

		const { property, contact, key } = item;
		const fullName = `${contact.name || ''} ${contact.lastname || ''}`.trim() || 'Contacto';

		internalStore.update((s) => ({
			...s,
			isRunning: true,
			currentContactName: fullName,
			currentPropertyId: property.public_id || ''
		}));

		// Doble verificación de seguridad: SOLO Etapa 3 y Etapa 4
		if (!isStage3Or4ForBroadcast(contact)) {
			internalStore.update((s) => ({
				...s,
				processed: s.processed + 1,
				failed: s.failed + 1,
				queuedKeys: s.queuedKeys.filter((k) => k !== key),
				failedItems: [
					...s.failedItems,
					{
						contactId: contact.id || '',
						contactName: fullName,
						phone: contact.telephon || '',
						propertyId: property.public_id || '',
						error: 'Omitido: el contacto no pertenece a Etapa 3 ni Etapa 4.'
					}
				]
			}));
			continue;
		}

		try {
			const response = await fetch('/api/whatsapp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contact,
					property,
					mode: 'broadcast'
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result?.error || `HTTP ${response.status}`);
			}

			// Registrar en bitácora (Firestore) para mover automáticamente de Por_Enviar a Ya_Se_Envió
			if (property.public_id && contact.id) {
				const newBinnacle: Binnacle = {
					date: Date.now(),
					comment: property.public_id.trim(),
					to: contact.id.trim(),
					action: 'Propiedad enviada: '
				};
				await addDoc(collection(db, 'binnacles'), newBinnacle);
			}

			internalStore.update((s) => ({
				...s,
				processed: s.processed + 1,
				sent: s.sent + 1,
				queuedKeys: s.queuedKeys.filter((k) => k !== key),
				sentKeys: [...s.sentKeys, key]
			}));
		} catch (err: any) {
			const errMsg = err?.message || 'Error desconocido en API de WhatsApp';
			console.error(`[WABA Broadcast] Error enviando a ${fullName}:`, errMsg);

			internalStore.update((s) => ({
				...s,
				processed: s.processed + 1,
				failed: s.failed + 1,
				queuedKeys: s.queuedKeys.filter((k) => k !== key),
				failedItems: [
					...s.failedItems,
					{
						contactId: contact.id || '',
						contactName: fullName,
						phone: contact.telephon || '',
						propertyId: property.public_id || '',
						error: errMsg
					}
				]
			}));
		}

		// Pausa de seguridad entre envíos si quedan elementos en cola
		if (pendingQueue.length > 0) {
			await sleep(RATE_LIMIT_DELAY_MS);
		}
	}

	const finalState = get(internalStore);
	internalStore.update((s) => ({
		...s,
		isRunning: false,
		currentContactName: ''
	}));

	if (finalState.failed === 0 && finalState.sent > 0) {
		notifications.success(
			`✅ Envío masivo completado: ${finalState.sent} ${finalState.sent === 1 ? 'contacto recibió' : 'contactos recibieron'} la propiedad por WhatsApp API.`,
			7000
		);
	} else if (finalState.failed > 0) {
		notifications.warning(
			`⚠️ Envío finalizado: ${finalState.sent} entregados, ${finalState.failed} con incidencia. Revisa el monitor inferior.`,
			10000
		);
	}

	workerPromise = null;
}

export function enqueuePropertyBroadcast(property: Property, contacts: Contact[]): number {
	if (!property || !property.public_id || !Array.isArray(contacts) || contacts.length === 0) {
		return 0;
	}

	const eligible = contacts.filter(isStage3Or4ForBroadcast);
	const skippedCount = contacts.length - eligible.length;

	if (eligible.length === 0) {
		notifications.warning(
			'Ninguno de los contactos seleccionados cumple con el filtro obligatorio de Etapa 3 o Etapa 4.',
			6000
		);
		return 0;
	}

	const currentState = get(internalStore);
	const existingKeys = new Set([...currentState.queuedKeys, ...currentState.sentKeys]);

	// Si el worker estaba inactivo, limpiar contadores previos para iniciar lote limpio
	if (!currentState.isRunning) {
		internalStore.set({
			...initialState,
			sentKeys: currentState.sentKeys
		});
	}

	let addedCount = 0;
	const newKeys: string[] = [];

	for (const contact of eligible) {
		if (!contact.id) continue;
		const key = `${property.public_id.trim()}::${contact.id.trim()}`;
		if (existingKeys.has(key)) continue;

		existingKeys.add(key);
		newKeys.push(key);
		pendingQueue.push({ key, property, contact });
		addedCount++;
	}

	if (addedCount === 0) {
		notifications.info('Los contactos seleccionados ya están en cola o ya fueron enviados.', 4500);
		return 0;
	}

	internalStore.update((s) => ({
		...s,
		isRunning: true,
		total: s.total + addedCount,
		queuedKeys: [...s.queuedKeys, ...newKeys],
		currentPropertyId: property.public_id.trim()
	}));

	const extraNote =
		skippedCount > 0 ? ` (${skippedCount} omitidos por no ser Etapa 3/4)` : '';
	notifications.info(
		`🚀 Enviando en segundo plano a ${addedCount} ${addedCount === 1 ? 'contacto' : 'contactos'} (Etapas 3 y 4)${extraNote}. Puedes seguir usando ATAIR.`,
		6000
	);

	if (!workerPromise) {
		workerPromise = processQueue();
	}

	return addedCount;
}

export function dismissBroadcastReport(): void {
	const s = get(internalStore);
	if (s.isRunning) return;
	internalStore.update((curr) => ({
		...initialState,
		sentKeys: curr.sentKeys
	}));
}

export const whatsappBroadcastStore = {
	subscribe: internalStore.subscribe,
	enqueue: enqueuePropertyBroadcast,
	dismiss: dismissBroadcastReport
};
