/**
 * Desactivación segura e idempotente (isActive: false) de contactos de Tokko
 * que no tienen propiedad consultada (columna Q y T vacías), ni presupuesto, ni requerimientos (#041).
 *
 * Opcionalmente elimina tareas abiertas de estos contactos en la colección `todos` para
 * limpiar la Agenda inmediatamente.
 *
 * Modos:
 *   node scripts/deactivate-tokko-empty-contacts.mjs            (Dry-Run, 0 escrituras)
 *   node scripts/deactivate-tokko-empty-contacts.mjs --execute  (Ejecuta en Firestore y guarda manifiesto)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';

const prodConfig = {
	apiKey: 'AIzaSyCPSB4ynujCJ7B8TFmJQFEiXSj3LpGzE9A',
	authDomain: 'matchhome-crm-46de4.firebaseapp.com',
	projectId: 'matchhome-crm-46de4'
};

const app = initializeApp(prodConfig, 'tokko-deactivator');
const db = getFirestore(app);

const execute = process.argv.includes('--execute');

function last10(s) {
	const d = String(s || '').replace(/\D/g, '');
	return d.length >= 10 ? d.slice(-10) : '';
}

async function main() {
	console.log(`=== DESACTIVACIÓN DE CONTACTOS TOKKO SIN PROPIEDAD (#041) ===`);
	console.log(`Modo: ${execute ? '🚀 EJECUCIÓN EN VIVO EN FIRESTORE' : '🧪 SIMULACIÓN (DRY-RUN)'}\n`);

	const rawTokko = JSON.parse(
		fs.readFileSync('scripts/tokko_contacts_raw.json', 'utf8').replace(/^\uFEFF/, '')
	);

	// 1. Cargar contactos de Firestore
	console.log('Descargando colección contacts de Firestore...');
	const contactsSnap = await getDocs(collection(db, 'contacts'));
	const firestoreByPhone = new Map();
	contactsSnap.forEach((d) => {
		const data = d.data();
		const p = last10(data.telephon);
		if (p) firestoreByPhone.set(p, { id: d.id, ...data });
	});

	// 2. Identificar contactos a desactivar
	const candidates = [];
	const seenContactIds = new Set();

	for (const t of rawTokko) {
		const colQ = (t['Propiedades destacadas'] || '').trim();
		const colT = (t['Propiedades'] || '').trim();

		// Si no tiene nada ni en Q ni en T
		if (!colQ && !colT) {
			const p = last10(t['Móvil'] || t['Teléfono']);
			if (p && firestoreByPhone.has(p)) {
				const fc = firestoreByPhone.get(p);
				if (seenContactIds.has(fc.id)) continue;
				seenContactIds.add(fc.id);

				const hasPropCont = fc.propCont && fc.propCont.trim() !== '';
				const hasBudget = Number(fc.budget || 0) > 0;
				const hasRange = fc.rangeProp && fc.rangeProp.trim() !== '';

				// Solo si no tiene propCont, ni budget, ni rangeProp y sigue activo
				if (!hasPropCont && !hasBudget && !hasRange && fc.isActive !== false) {
					candidates.push({
						contactId: fc.id,
						fullName: `${fc.name || ''} ${fc.lastname || ''}`.trim() || t['Nombre'] || 'Sin nombre',
						phone: fc.telephon || p,
						createdAt: fc.createdAt || null,
						contactStage: fc.contactStage || 'E1',
						tokkoId: t['ID'] || ''
					});
				}
			}
		}
	}

	console.log(`Contactos detectados para dar de baja: ${candidates.length}`);

	// 3. Identificar tareas abiertas en `todos` de estos contactos
	console.log('Revisando colección todos para limpiar tareas pendientes en Agenda...');
	const todosSnap = await getDocs(collection(db, 'todos'));
	const candidateIdSet = new Set(candidates.map((c) => c.contactId));
	const todosToDelete = [];

	todosSnap.forEach((d) => {
		const data = d.data();
		const cid = String(data.contactId || data.copilotoMeta?.contactId || '').trim();
		if (cid && candidateIdSet.has(cid)) {
			todosToDelete.push({
				todoId: d.id,
				task: data.task || 'Sin título',
				contactId: cid,
				isCompleted: Boolean(data.isCompleted)
			});
		}
	});

	console.log(`Tareas encontradas en Agenda asociadas a estos contactos: ${todosToDelete.length}\n`);

	if (candidates.length === 0) {
		console.log('No hay contactos pendientes de dar de baja. Todo sincronizado.');
		process.exit(0);
	}

	console.log('Primeros 10 contactos a desactivar:');
	candidates.slice(0, 10).forEach((c, idx) => {
		console.log(`  ${idx + 1}. [${c.contactId}] ${c.fullName} (${c.phone}) - Tokko ID: ${c.tokkoId}`);
	});

	if (!execute) {
		console.log(`\n⚠️  DRY-RUN FINALIZADO: Para aplicar los cambios reales en Firestore, ejecuta:`);
		console.log(`   node scripts/deactivate-tokko-empty-contacts.mjs --execute`);
		process.exit(0);
	}

	// 4. Ejecutar batches de actualización
	console.log('\nEjecutando bajas en Firestore...');
	const BATCH_SIZE = 400;

	// Actualizar contacts: isActive = false
	for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
		const chunk = candidates.slice(i, i + BATCH_SIZE);
		const batch = writeBatch(db);
		for (const c of chunk) {
			const ref = doc(db, 'contacts', c.contactId);
			batch.update(ref, {
				isActive: false,
				deactivatedReason: 'Tokko sin propiedad ni requerimientos (#041)',
				deactivatedAt: Date.now()
			});
		}
		await batch.commit();
		console.log(`✓ Desactivados ${chunk.length} contactos en Firestore.`);
	}

	// Eliminar/Cerrar tareas huérfanas en todos
	if (todosToDelete.length > 0) {
		console.log(`Eliminando ${todosToDelete.length} tareas asociadas en todos...`);
		for (let i = 0; i < todosToDelete.length; i += BATCH_SIZE) {
			const chunk = todosToDelete.slice(i, i + BATCH_SIZE);
			const batch = writeBatch(db);
			for (const t of chunk) {
				const ref = doc(db, 'todos', t.todoId);
				batch.delete(ref);
			}
			await batch.commit();
			console.log(`✓ Eliminadas ${chunk.length} tareas de la Agenda.`);
		}
	}

	// 5. Guardar manifiesto de auditoría
	const manifest = {
		executedAt: new Date().toISOString(),
		totalDeactivatedContacts: candidates.length,
		totalDeletedTodos: todosToDelete.length,
		deactivatedContacts: candidates,
		deletedTodos: todosToDelete
	};

	fs.writeFileSync(
		'scripts/tokko_deactivation_manifest.json',
		JSON.stringify(manifest, null, 2),
		'utf8'
	);
	console.log(`\n✅ MANIFIESTO GUARDADO EN: scripts/tokko_deactivation_manifest.json`);
	console.log(`Operación completada exitosamente.`);
	process.exit(0);
}

main().catch((err) => {
	console.error('Error durante la desactivación:', err);
	process.exit(1);
});
