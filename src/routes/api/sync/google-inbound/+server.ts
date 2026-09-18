import { json } from '@sveltejs/kit';
import { db } from '$lib/firebase';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';

export async function POST({ request }) {
	try {
		const payload = await request.json();
		const { type, items, task } = payload;

		if (!db) {
			return json({ success: false, error: 'Firestore no está inicializado' }, { status: 500 });
		}

		console.log('📥 [API /api/sync/google-inbound] Evento recibido desde Google / n8n:', type);

		let updatedCount = 0;
		let deletedCount = 0;
		let ignoredCount = 0;

		// 1. Sincronización de Tareas (Lote o Individual)
		if (type === 'TASK_SYNC' || type === 'TASK_UPDATE' || task || (items && items.length > 0)) {
			const tasksList = items || (task ? [task] : []);
			const todosRef = collection(db, 'todos');

			for (const item of tasksList) {
				const googleTaskId = item.googleTaskId || item.id;
				if (!googleTaskId) {
					ignoredCount++;
					continue;
				}

				// Buscar en Firestore si existe un todo con este googleTaskId
				const q = query(todosRef, where('googleTaskId', '==', googleTaskId));
				const snapshot = await getDocs(q);

				if (snapshot.empty) {
					// Es una tarea personal/externa creada en Google -> IGNORAR
					ignoredCount++;
					continue;
				}

				for (const todoDoc of snapshot.docs) {
					const docRef = doc(db, 'todos', todoDoc.id);

					// Si la tarea fue eliminada en Google
					if (item.deleted === true) {
						await deleteDoc(docRef);
						deletedCount++;
						console.log(`🗑️ [Google Tasks Sync] Tarea eliminada en CRM: ${todoDoc.id} (Google ID: ${googleTaskId})`);
						continue;
					}

					// Actualización de campos
					const updateData: Record<string, any> = {};

					if (item.title !== undefined && item.title !== null) {
						updateData.task = item.title;
					}

					if (item.notes !== undefined && item.notes !== null) {
						updateData.notes = item.notes;
					}

					if (item.status !== undefined) {
						updateData.isCompleted = item.status === 'completed';
					} else if (item.completed !== undefined) {
						updateData.isCompleted = Boolean(item.completed);
					}

					if (item.due || item.dueDate) {
						const dueParsed = new Date(item.due || item.dueDate);
						if (!isNaN(dueParsed.getTime())) {
							updateData.endTask = dueParsed.getTime();
						}
					}

					if (Object.keys(updateData).length > 0) {
						updateData.updatedAt = Date.now();
						await updateDoc(docRef, updateData);
						updatedCount++;
						console.log(`✏️ [Google Tasks Sync] Tarea actualizada en CRM: ${todoDoc.id} (Google ID: ${googleTaskId})`, updateData);
					}
				}
			}
		}

		return json({
			success: true,
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
