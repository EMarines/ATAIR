import { json } from '@sveltejs/kit';
import { db } from '$lib/firebase';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';

/**
 * Parsea cadenas ISO o de fecha a timestamp numérico y formato HH:MM en zona horaria America/Chihuahua (UTC-6)
 */
function parseDateTimeForChihuahua(isoOrDateStr?: string | null): { timestamp: number; timeString: string } {
	if (!isoOrDateStr) {
		return { timestamp: Date.now(), timeString: '' };
	}

	const str = String(isoOrDateStr).trim();

	// Si es solo fecha YYYY-MM-DD (evento de todo el día)
	if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
		const [y, m, day] = str.split('-').map(Number);
		// Fijar a mediodía local para evitar deslizamientos de fecha por UTC
		const d = new Date(y, m - 1, day, 12, 0, 0);
		return {
			timestamp: d.getTime(),
			timeString: ''
		};
	}

	const d = new Date(str);
	if (isNaN(d.getTime())) {
		return { timestamp: Date.now(), timeString: '' };
	}

	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/Chihuahua',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});

		const parts = formatter.formatToParts(d);
		const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

		const y = parseInt(getPart('year'), 10);
		const m = parseInt(getPart('month'), 10) - 1;
		const day = parseInt(getPart('day'), 10);
		let h = parseInt(getPart('hour'), 10);
		if (h === 24) h = 0;
		const min = parseInt(getPart('minute'), 10);

		const localDate = new Date(y, m, day, h, min, 0, 0);
		const timeString = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

		return {
			timestamp: localDate.getTime(),
			timeString
		};
	} catch (e) {
		return {
			timestamp: d.getTime(),
			timeString: ''
		};
	}
}

/**
 * Formatea notas incorporando el lugar de la cita al inicio si existe
 */
function formatNotesWithLocation(rawNotes?: string | null, rawLocation?: string | null): string {
	const location = (rawLocation || '').trim();
	const notes = (rawNotes || '').trim();

	if (location) {
		const locPrefix = `📍 Lugar: ${location}`;
		// Si las notas ya contienen el prefijo de lugar, evitar duplicarlo
		if (notes.startsWith('📍 Lugar:')) {
			return notes;
		}
		return notes ? `${locPrefix}\n\n${notes}` : locPrefix;
	}

	return notes;
}

export async function POST({ request }) {
	try {
		const payload = await request.json();
		const { type, items, task, tasks, event, events, action } = payload;

		if (!db) {
			return json({ success: false, error: 'Firestore no está inicializado' }, { status: 500 });
		}

		console.log('📥 [API /api/sync/google-inbound] Evento recibido desde Google / n8n:', type || action || 'SYNC');

		let createdCount = 0;
		let updatedCount = 0;
		let deletedCount = 0;
		let ignoredCount = 0;

		const todosRef = collection(db, 'todos');

		// Separar o detectar listas de Tareas y Eventos de Calendario
		const incomingEventsList: any[] = [];
		const incomingTasksList: any[] = [];

		if (events && Array.isArray(events)) {
			incomingEventsList.push(...events);
		}
		if (event && typeof event === 'object') {
			incomingEventsList.push(event);
		}

		if (tasks && Array.isArray(tasks)) {
			incomingTasksList.push(...tasks);
		}
		if (task && typeof task === 'object') {
			incomingTasksList.push(task);
		}

		if (items && Array.isArray(items)) {
			for (const it of items) {
				// Detectar si el item es de Calendario o de Tasks
				const isCalendarItem =
					type === 'CALENDAR_SYNC' ||
					type === 'EVENT_SYNC' ||
					Boolean(it.googleEventId) ||
					Boolean(it.start && (it.summary || it.location || it.end));

				if (isCalendarItem) {
					incomingEventsList.push(it);
				} else {
					incomingTasksList.push(it);
				}
			}
		}

		// Si el payload es un evento directo en la raíz
		if (type === 'CALENDAR_SYNC' && !incomingEventsList.length && (payload.summary || payload.start || payload.id)) {
			incomingEventsList.push(payload);
		}

		// Si el payload es una tarea directa en la raíz
		if (type === 'TASK_SYNC' && !incomingTasksList.length && (payload.title || payload.googleTaskId || payload.id)) {
			incomingTasksList.push(payload);
		}

		// ============================================================
		// 1. PROCESAR EVENTOS DE GOOGLE CALENDAR -> AGENDA ATAIR
		// ============================================================
		const activeCalendarEventIds = new Set<string>();
		const explicitlyDeletedEventIds = new Set<string>();

		for (const ev of incomingEventsList) {
			const evId = ev.googleEventId || ev.id;
			if (!evId) continue;
			if (ev.deleted === true || ev.status === 'cancelled' || action === 'DELETE' || action === 'CALENDAR_DELETE') {
				explicitlyDeletedEventIds.add(evId);
			} else {
				activeCalendarEventIds.add(evId);
			}
		}

		// Reconciliación de eliminaciones si es un lote completo de Calendar
		if (type === 'CALENDAR_SYNC' && incomingEventsList.length > 0) {
			const now = Date.now();
			const windowMin = now - 7 * 24 * 60 * 60 * 1000;
			const windowMax = now + 60 * 24 * 60 * 60 * 1000;

			const qExistingCal = query(todosRef, where('source', '==', 'google_calendar'));
			const calSnapshot = await getDocs(qExistingCal);

			for (const docSnap of calSnapshot.docs) {
				const d = docSnap.data();
				const evId = d.googleEventId;
				if (!evId) continue;

				const title = (d.task || '').trim().toLowerCase();
				const isSpecialContactDay =
					title.startsWith('día especial de') ||
					title.startsWith('dia especial de') ||
					title.startsWith('cumpleaños de') ||
					title.startsWith('cumpleanos de') ||
					title.includes('feliz cumpleaños') ||
					title.includes('feliz cumpleanos');

				const isInWindow = Number(d.endTask) >= windowMin && Number(d.endTask) <= windowMax;
				if (isSpecialContactDay || explicitlyDeletedEventIds.has(evId) || (isInWindow && !activeCalendarEventIds.has(evId))) {
					await deleteDoc(doc(db, 'todos', docSnap.id));
					deletedCount++;
					console.log(`🗑️ [Calendar Inbound] Cita purgada por reconciliación/filtro: ${docSnap.id} (Event ID: ${evId})`);
				}
			}
		}

		for (const ev of incomingEventsList) {
			const googleEventId = ev.googleEventId || ev.id;
			if (!googleEventId) {
				ignoredCount++;
				continue;
			}

			const summary = (ev.summary || ev.title || ev.task || 'Cita de Calendario').trim();
			const lowerSummary = summary.toLowerCase();
			if (
				lowerSummary.startsWith('día especial de') ||
				lowerSummary.startsWith('dia especial de') ||
				lowerSummary.startsWith('cumpleaños de') ||
				lowerSummary.startsWith('cumpleanos de') ||
				lowerSummary.includes('feliz cumpleaños') ||
				lowerSummary.includes('feliz cumpleanos')
			) {
				ignoredCount++;
				continue;
			}

			const isDeleted =
				ev.deleted === true ||
				ev.status === 'cancelled' ||
				action === 'DELETE' ||
				action === 'CALENDAR_DELETE';

			// Buscar si ya existe un todo con este googleEventId
			const q = query(todosRef, where('googleEventId', '==', googleEventId));
			const snapshot = await getDocs(q);

			if (isDeleted) {
				if (!snapshot.empty) {
					for (const docSnap of snapshot.docs) {
						await deleteDoc(doc(db, 'todos', docSnap.id));
						deletedCount++;
						console.log(`🗑️ [Calendar Inbound] Cita eliminada en CRM: ${docSnap.id} (Google Event ID: ${googleEventId})`);
					}
				}
				continue;
			}

			const rawLocation = ev.location || ev.lugar || '';
			const rawDescription = ev.description || ev.notes || '';
			const finalNotes = formatNotesWithLocation(rawDescription, rawLocation);

			// Extraer fecha y hora de inicio
			const rawStart = ev.start?.dateTime || ev.start?.date || ev.start || ev.dueDate || ev.due;
			const parsed = parseDateTimeForChihuahua(rawStart);

			const isCompleted = ev.isCompleted === true || ev.status === 'completed';

			if (!snapshot.empty) {
				// Actualizar cita existente
				for (const docSnap of snapshot.docs) {
					const docRef = doc(db, 'todos', docSnap.id);
					const updateData: Record<string, any> = {
						task: summary,
						notes: finalNotes,
						endTask: parsed.timestamp,
						timeString: parsed.timeString || '',
						isCompleted,
						updatedAt: Date.now()
					};

					await updateDoc(docRef, updateData);
					updatedCount++;
					console.log(`✏️ [Calendar Inbound] Cita actualizada en CRM: ${docSnap.id} (Google Event ID: ${googleEventId})`, updateData);
				}
			} else {
				// Insertar nueva cita proveniente de Google Calendar
				const newCalendarTodo = {
					task: summary,
					notes: finalNotes,
					endTask: parsed.timestamp,
					timeString: parsed.timeString || '',
					isCompleted,
					createdAt: ev.createdAt ? Number(ev.createdAt) : Date.now(),
					googleEventId,
					type: 'Google Calendar',
					source: 'google_calendar',
					updatedAt: Date.now()
				};

				const newDocRef = await addDoc(todosRef, newCalendarTodo);
				createdCount++;
				console.log(`✨ [Calendar Inbound] Nueva cita creada en CRM: ${newDocRef.id} (Google Event ID: ${googleEventId})`, newCalendarTodo);
			}
		}

		// ============================================================
		// 2. PROCESAR TAREAS DE GOOGLE TASKS -> AGENDA ATAIR
		// ============================================================
		const activeGoogleTaskIds = new Set<string>();
		const explicitlyDeletedGoogleTaskIds = new Set<string>();

		for (const t of incomingTasksList) {
			const gId = t.googleTaskId || t.id;
			if (!gId) continue;
			if (t.deleted === true || action === 'DELETE' || action === 'TASK_DELETE') {
				explicitlyDeletedGoogleTaskIds.add(gId);
			} else {
				activeGoogleTaskIds.add(gId);
			}
		}

		// Reconciliación de eliminaciones si es un lote completo de Google Tasks
		if (type === 'TASK_SYNC' && incomingTasksList.length > 0) {
			const qExistingTasks = query(todosRef, where('source', '==', 'google_tasks'));
			const tasksSnapshot = await getDocs(qExistingTasks);

			for (const docSnap of tasksSnapshot.docs) {
				const d = docSnap.data();
				const gId = d.googleTaskId;
				if (!gId) continue;

				if (explicitlyDeletedGoogleTaskIds.has(gId) || !activeGoogleTaskIds.has(gId)) {
					await deleteDoc(doc(db, 'todos', docSnap.id));
					deletedCount++;
					console.log(`🗑️ [Tasks Inbound] Tarea purgada por reconciliación: ${docSnap.id} (Google ID: ${gId})`);
				}
			}
		}

		for (const t of incomingTasksList) {
			const googleTaskId = t.googleTaskId || t.id;
			if (!googleTaskId) {
				ignoredCount++;
				continue;
			}

			const isDeleted =
				t.deleted === true ||
				action === 'DELETE' ||
				action === 'TASK_DELETE';

			// Buscar en Firestore si existe un todo con este googleTaskId
			const q = query(todosRef, where('googleTaskId', '==', googleTaskId));
			const snapshot = await getDocs(q);

			if (isDeleted) {
				if (!snapshot.empty) {
					for (const docSnap of snapshot.docs) {
						await deleteDoc(doc(db, 'todos', docSnap.id));
						deletedCount++;
						console.log(`🗑️ [Tasks Inbound] Tarea eliminada en CRM: ${docSnap.id} (Google ID: ${googleTaskId})`);
					}
				}
				continue;
			}

			const title = (t.title || t.task || '').trim();
			if (!title) {
				ignoredCount++;
				continue;
			}

			const notes = t.notes || '';
			const isCompleted = t.status === 'completed' || Boolean(t.completed) || t.isCompleted === true;

			// Fecha de vencimiento
			let parsedDue = { timestamp: Date.now(), timeString: '' };
			const rawDue = t.due || t.dueDate || t.endTask;
			if (rawDue) {
				parsedDue = parseDateTimeForChihuahua(rawDue);
			}

			if (!snapshot.empty) {
				// Actualización de tarea existente
				for (const docSnap of snapshot.docs) {
					const docRef = doc(db, 'todos', docSnap.id);
					const updateData: Record<string, any> = {
						task: title,
						notes,
						isCompleted,
						updatedAt: Date.now()
					};

					if (rawDue) {
						updateData.endTask = parsedDue.timestamp;
						if (parsedDue.timeString) {
							updateData.timeString = parsedDue.timeString;
						}
					}

					await updateDoc(docRef, updateData);
					updatedCount++;
					console.log(`✏️ [Tasks Inbound] Tarea actualizada en CRM: ${docSnap.id} (Google ID: ${googleTaskId})`, updateData);
				}
			} else {
				// Solo crear si no está marcada como completada (evita revivir tareas viejas purgadas)
				if (isCompleted) {
					ignoredCount++;
					continue;
				}

				// Insertar nueva tarea creada directamente en Google Tasks
				const newTaskTodo = {
					task: title,
					notes,
					endTask: parsedDue.timestamp,
					timeString: parsedDue.timeString || '',
					isCompleted: false,
					createdAt: t.createdAt ? Number(t.createdAt) : Date.now(),
					googleTaskId,
					type: 'Google Tasks',
					source: 'google_tasks',
					updatedAt: Date.now()
				};

				const newDocRef = await addDoc(todosRef, newTaskTodo);
				createdCount++;
				console.log(`✨ [Tasks Inbound] Nueva tarea creada en CRM: ${newDocRef.id} (Google ID: ${googleTaskId})`, newTaskTodo);
			}
		}

		return json({
			success: true,
			createdCount,
			updatedCount,
			deletedCount,
			ignoredCount,
			timestamp: new Date().toISOString()
		});
	} catch (error: any) {
		console.error('❌ [API /api/sync/google-inbound] Error procesando sincronización:', error);
		return json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
	}
}
