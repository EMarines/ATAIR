import { db } from '$lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

/**
 * Parsea cadenas ISO o de fecha a timestamp numérico y formato HH:MM en zona horaria America/Chihuahua (UTC-6)
 */
function parseDateTimeForChihuahua(isoOrDateStr?: string | null): { timestamp: number; timeString: string } {
	if (!isoOrDateStr) {
		return { timestamp: Date.now(), timeString: '' };
	}

	const str = String(isoOrDateStr).trim();

	// Si es solo fecha YYYY-MM-DD o formato Google Tasks YYYY-MM-DDT00:00:00.000Z (cero UTC)
	const pureDateMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z?)?$/);
	if (pureDateMatch) {
		const [y, m, day] = pureDateMatch[1].split('-').map(Number);
		// Fijar a mediodía local para evitar deslizamientos de fecha por UTC y husos horarios
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
		if (notes.startsWith('📍 Lugar:')) {
			return notes;
		}
		return notes ? `${locPrefix}\n\n${notes}` : locPrefix;
	}

	return notes;
}

/**
 * Función central de procesamiento de sincronización entrante (Calendar + Tasks)
 * Optimizada para Serverless con lectura única en memoria y operaciones por lotes (WriteBatch).
 * Completa en <400ms para evitar el timeout de 10s de Vercel.
 */
export async function processInboundGoogleSync(payload: any) {
	if (!db) {
		throw new Error('Firestore no está inicializado');
	}

	const { type, items, task, tasks, event, events, action } = payload;
	console.log('📥 [Inbound Google Sync] Procesando lote:', type || action || 'SYNC');

	let createdCount = 0;
	let updatedCount = 0;
	let deletedCount = 0;
	let ignoredCount = 0;

	const todosRef = collection(db, 'todos');

	// 1. Separar listas de Tareas y Eventos
	const incomingEventsList: any[] = [];
	const incomingTasksList: any[] = [];

	if (events && Array.isArray(events)) incomingEventsList.push(...events);
	if (event && typeof event === 'object') incomingEventsList.push(event);

	if (tasks && Array.isArray(tasks)) incomingTasksList.push(...tasks);
	if (task && typeof task === 'object') incomingTasksList.push(task);

	if (items && Array.isArray(items)) {
		for (const it of items) {
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

	if (type === 'CALENDAR_SYNC' && !incomingEventsList.length && (payload.summary || payload.start || payload.id)) {
		incomingEventsList.push(payload);
	}
	if (type === 'TASK_SYNC' && !incomingTasksList.length && (payload.title || payload.googleTaskId || payload.id)) {
		incomingTasksList.push(payload);
	}

	// 2. Pre-cargar TODOS los documentos existentes en una SOLA consulta rápida
	const existingSnapshot = await getDocs(todosRef);
	const tasksByGoogleId = new Map<string, { id: string; data: any }>();
	const eventsByGoogleId = new Map<string, { id: string; data: any }>();
	const allExistingTasks: { id: string; data: any }[] = [];
	const allExistingEvents: { id: string; data: any }[] = [];

	for (const docSnap of existingSnapshot.docs) {
		const data = docSnap.data();
		const item = { id: docSnap.id, data };
		if (data.googleTaskId) {
			tasksByGoogleId.set(data.googleTaskId, item);
		}
		if (data.source === 'google_tasks' || data.type === 'Google Tasks' || Boolean(data.googleTaskId)) {
			allExistingTasks.push(item);
		}
		if (data.googleEventId) {
			eventsByGoogleId.set(data.googleEventId, item);
		}
		if (data.source === 'google_calendar' || data.type === 'Google Calendar' || Boolean(data.googleEventId)) {
			allExistingEvents.push(item);
		}
	}

	// Gestor de batch para escrituras
	let currentBatch = writeBatch(db);
	let batchOpsCount = 0;

	async function addBatchOp(opFn: (b: ReturnType<typeof writeBatch>) => void) {
		opFn(currentBatch);
		batchOpsCount++;
		if (batchOpsCount >= 400) {
			await currentBatch.commit();
			currentBatch = writeBatch(db!);
			batchOpsCount = 0;
		}
	}

	// ============================================================
	// A. PROCESAR EVENTOS DE GOOGLE CALENDAR
	// ============================================================
	if (incomingEventsList.length > 0) {
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

		// Reconciliación de eliminaciones de Calendar
		if (type === 'CALENDAR_SYNC' && incomingEventsList.length > 0) {
			const now = Date.now();
			const windowMin = now - 7 * 24 * 60 * 60 * 1000;
			const windowMax = now + 60 * 24 * 60 * 60 * 1000;

			for (const existing of allExistingEvents) {
				const evId = existing.data.googleEventId;
				if (!evId) continue;

				const title = (existing.data.task || '').trim().toLowerCase();
				const isSpecialContactDay =
					title.startsWith('día especial de') ||
					title.startsWith('dia especial de') ||
					title.startsWith('cumpleaños de') ||
					title.startsWith('cumpleanos de') ||
					title.includes('feliz cumpleaños') ||
					title.includes('feliz cumpleanos');

				const endTaskNum = Number(existing.data.endTask);
				const isInWindow = endTaskNum >= windowMin && endTaskNum <= windowMax;

				if (isSpecialContactDay || explicitlyDeletedEventIds.has(evId) || (isInWindow && !activeCalendarEventIds.has(evId))) {
					await addBatchOp((b) => b.delete(doc(db!, 'todos', existing.id)));
					deletedCount++;
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

			const existing = eventsByGoogleId.get(googleEventId);

			if (isDeleted) {
				if (existing) {
					await addBatchOp((b) => b.delete(doc(db!, 'todos', existing.id)));
					eventsByGoogleId.delete(googleEventId);
					deletedCount++;
				}
				continue;
			}

			const rawLocation = ev.location || ev.lugar || '';
			const rawDescription = ev.description || ev.notes || '';
			const finalNotes = formatNotesWithLocation(rawDescription, rawLocation);

			const rawStart = ev.start?.dateTime || ev.start?.date || ev.start || ev.dueDate || ev.due;
			const parsed = parseDateTimeForChihuahua(rawStart);
			const isCompleted = ev.isCompleted === true || ev.status === 'completed';

			if (existing) {
				const prev = existing.data;
				if (
					prev.task !== summary ||
					prev.notes !== finalNotes ||
					prev.endTask !== parsed.timestamp ||
					prev.timeString !== parsed.timeString ||
					prev.isCompleted !== isCompleted
				) {
					const updateData: Record<string, any> = {
						task: summary,
						notes: finalNotes,
						endTask: parsed.timestamp,
						timeString: parsed.timeString || '',
						isCompleted,
						updatedAt: Date.now()
					};
					await addBatchOp((b) => b.update(doc(db!, 'todos', existing.id), updateData));
					updatedCount++;
				}
			} else {
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
				const newDocRef = doc(todosRef);
				await addBatchOp((b) => b.set(newDocRef, newCalendarTodo));
				eventsByGoogleId.set(googleEventId, { id: newDocRef.id, data: newCalendarTodo });
				createdCount++;
			}
		}
	}

	// ============================================================
	// B. PROCESAR TAREAS DE GOOGLE TASKS
	// ============================================================
	if (incomingTasksList.length > 0) {
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

		// Reconciliación de eliminaciones de Tasks
		if (type === 'TASK_SYNC' && incomingTasksList.length > 0) {
			for (const existing of allExistingTasks) {
				const gId = existing.data.googleTaskId;
				if (!gId) continue;

				if (explicitlyDeletedGoogleTaskIds.has(gId) || !activeGoogleTaskIds.has(gId)) {
					await addBatchOp((b) => b.delete(doc(db!, 'todos', existing.id)));
					tasksByGoogleId.delete(gId);
					deletedCount++;
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

			const existing = tasksByGoogleId.get(googleTaskId);

			if (isDeleted) {
				if (existing) {
					await addBatchOp((b) => b.delete(doc(db!, 'todos', existing.id)));
					tasksByGoogleId.delete(googleTaskId);
					deletedCount++;
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

			let parsedDue = { timestamp: Date.now(), timeString: '' };
			const rawDue = t.due || t.dueDate || t.endTask;
			if (rawDue) {
				parsedDue = parseDateTimeForChihuahua(rawDue);
			}

			if (existing) {
				const prev = existing.data;
				const shouldUpdateEndTask = Boolean(rawDue) && prev.endTask !== parsedDue.timestamp;
				const shouldUpdateTimeString = Boolean(rawDue) && Boolean(parsedDue.timeString) && prev.timeString !== parsedDue.timeString;

				if (
					prev.task !== title ||
					prev.notes !== notes ||
					prev.isCompleted !== isCompleted ||
					shouldUpdateEndTask ||
					shouldUpdateTimeString
				) {
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
					await addBatchOp((b) => b.update(doc(db!, 'todos', existing.id), updateData));
					updatedCount++;
				}
			} else {
				// Evitar importar tareas históricas completadas de años pasados
				if (isCompleted) {
					ignoredCount++;
					continue;
				}

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

				const newDocRef = doc(todosRef);
				await addBatchOp((b) => b.set(newDocRef, newTaskTodo));
				tasksByGoogleId.set(googleTaskId, { id: newDocRef.id, data: newTaskTodo });
				createdCount++;
			}
		}
	}

	// Confirmar cambios pendientes del batch
	if (batchOpsCount > 0) {
		await currentBatch.commit();
	}

	console.log(`✅ [Inbound Sync Completo] Creadas: ${createdCount}, Actualizadas: ${updatedCount}, Borradas: ${deletedCount}, Ignoradas: ${ignoredCount}`);

	return {
		success: true,
		createdCount,
		updatedCount,
		deletedCount,
		ignoredCount,
		timestamp: new Date().toISOString()
	};
}
