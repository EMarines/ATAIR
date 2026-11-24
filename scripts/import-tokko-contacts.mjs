/**
 * Importación idempotente de contactos Tokko filtrados a Firestore (`contacts`).
 *
 * Modos de ejecución:
 *   node scripts/import-tokko-contacts.mjs --input <json>                 (Dry-Run por defecto, 0 escrituras)
 *   node scripts/import-tokko-contacts.mjs --input <json> --execute       (Escribe lote en Firestore y genera manifiesto)
 *   node scripts/import-tokko-contacts.mjs --rollback <manifest.json>     (Revierte documentos creados por un manifiesto)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const BATCH_SIZE = 400;

function getArg(flag, fallback = '') {
	const idx = process.argv.indexOf(flag);
	if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
	return process.argv[idx + 1];
}

function hasFlag(flag) {
	return process.argv.includes(flag);
}

function loadFirebaseConfig() {
	const envText = readFileSync(join(PROJECT_ROOT, '.env'), 'utf-8');
	const getEnv = (key) => {
		const m = envText.match(new RegExp(`^${key}=(.*)$`, 'm'));
		return m ? m[1].trim() : '';
	};
	const activeEnv = getEnv('VITE_FIREBASE_ENV') || 'prod';
	const prefix = activeEnv === 'dev' ? 'VITE_FIREBASE_DEV_' : 'VITE_FIREBASE_PROD_';
	const config = {
		apiKey: getEnv(`${prefix}API_KEY`) || getEnv('VITE_FIREBASE_API_KEY'),
		authDomain: getEnv(`${prefix}AUTH_DOMAIN`) || getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
		projectId: getEnv(`${prefix}PROJECT_ID`) || getEnv('VITE_FIREBASE_PROJECT_ID'),
		storageBucket: getEnv(`${prefix}STORAGE_BUCKET`) || getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
		messagingSenderId: getEnv(`${prefix}MESSAGING_SENDER_ID`) || getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
		appId: getEnv(`${prefix}APP_ID`) || getEnv('VITE_FIREBASE_APP_ID')
	};
	if (!config.apiKey || !config.projectId) {
		throw new Error(`Faltan credenciales Firebase para entorno '${activeEnv}' en .env`);
	}
	return { activeEnv, config };
}

function last10Digits(raw) {
	const digits = String(raw || '').replace(/\D/g, '');
	return digits.length >= 10 ? digits.slice(-10) : '';
}

function validateContactSchema(c) {
	if (!c.id || typeof c.id !== 'string') return 'id inválido';
	if (last10Digits(c.telephon).length !== 10) return 'telephon < 10 dígitos';
	if (c.contactStage !== 'Etapa 1') return `contactStage inesperado (${c.contactStage})`;
	if (c.isActive !== true) return 'isActive debe ser true';
	if (!Number.isFinite(c.createdAt) || c.createdAt <= 0) return 'createdAt inválido';
	return null;
}

async function runRollback(db, manifestPath) {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
	const ids = Array.isArray(manifest.writtenIds) ? manifest.writtenIds : [];
	if (ids.length === 0) {
		console.log('El manifiesto no contiene writtenIds para revertir.');
		return;
	}
	for (let i = 0; i < ids.length; i += BATCH_SIZE) {
		const chunk = ids.slice(i, i + BATCH_SIZE);
		const batch = writeBatch(db);
		for (const id of chunk) {
			batch.delete(doc(db, 'contacts', id));
		}
		await batch.commit();
	}
	console.log(`Rollback completado: eliminados ${ids.length} documentos listados en ${manifestPath}`);
}

async function main() {
	const execute = hasFlag('--execute');
	const rollbackPath = getArg('--rollback');
	const inputPath = getArg('--input');
	const manifestPath = getArg(
		'--manifest',
		join(dirname(inputPath || __dirname), 'tokko_import_manifest.json')
	);

	const { activeEnv, config } = loadFirebaseConfig();
	const app = initializeApp(config, 'tokko-contacts-importer');
	const db = getFirestore(app);

	console.log(`Firebase conectado -> proyecto: ${config.projectId} (env=${activeEnv})`);

	if (rollbackPath) {
		await runRollback(db, rollbackPath);
		process.exit(0);
	}

	if (!inputPath) {
		throw new Error('Debes indicar --input <ruta_json> o --rollback <ruta_manifiesto>.');
	}

	const payload = JSON.parse(readFileSync(inputPath, 'utf-8'));
	const candidates = Array.isArray(payload) ? payload : payload.contacts || [];

	// Lectura en vivo para garantizar idempotencia estricta por teléfono de 10 dígitos
	const snap = await getDocs(collection(db, 'contacts'));
	const beforeCount = snap.size;
	const existingPhones = new Set();
	for (const d of snap.docs) {
		const p10 = last10Digits(d.data()?.telephon);
		if (p10) existingPhones.add(p10);
	}

	const toWrite = [];
	const skippedExisting = [];
	const invalidRows = [];
	const seenBatchPhones = new Set();

	for (const c of candidates) {
		const schemaErr = validateContactSchema(c);
		if (schemaErr) {
			invalidRows.push({ name: `${c.name} ${c.lastname}`.trim(), reason: schemaErr });
			continue;
		}
		const p10 = last10Digits(c.telephon);
		if (existingPhones.has(p10) || seenBatchPhones.has(p10)) {
			skippedExisting.push({ name: `${c.name} ${c.lastname}`.trim(), telephon: p10 });
			continue;
		}
		seenBatchPhones.add(p10);
		toWrite.push(c);
	}

	const byType = toWrite.reduce((acc, c) => {
		acc[c.typeContact || '(empty)'] = (acc[c.typeContact || '(empty)'] || 0) + 1;
		return acc;
	}, {});

	console.log(
		JSON.stringify(
			{
				mode: execute ? 'EXECUTE' : 'DRY_RUN',
				beforeCount,
				candidatesTotal: candidates.length,
				toWriteCount: toWrite.length,
				skippedExistingCount: skippedExisting.length,
				invalidCount: invalidRows.length,
				byType
			},
			null,
			2
		)
	);

	if (invalidRows.length > 0) {
		console.error('Registros inválidos detectados, abortando:', invalidRows);
		process.exit(1);
	}

	if (!execute) {
		console.log('Dry-Run finalizado sin escrituras.');
		process.exit(0);
	}

	if (toWrite.length === 0) {
		console.log('Nada nuevo por escribir (todos los teléfonos ya existen en Firestore).');
		process.exit(0);
	}

	const writtenIds = [];
	for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
		const chunk = toWrite.slice(i, i + BATCH_SIZE);
		const batch = writeBatch(db);
		for (const item of chunk) {
			batch.set(doc(db, 'contacts', item.id), item);
			writtenIds.push(item.id);
		}
		await batch.commit();
	}

	// Verificación posterior a la escritura
	const postSnap = await getDocs(collection(db, 'contacts'));
	const afterCount = postSnap.size;
	const postById = new Map(postSnap.docs.map((d) => [d.id, d.data()]));
	const missingWritten = writtenIds.filter((id) => !postById.has(id));

	const manifest = {
		executedAt: new Date().toISOString(),
		projectId: config.projectId,
		env: activeEnv,
		beforeCount,
		writtenCount: writtenIds.length,
		afterCount,
		missingWrittenCount: missingWritten.length,
		skippedExisting,
		writtenIds,
		sampleWritten: writtenIds.slice(0, 3).map((id) => ({ id, ...postById.get(id) }))
	};
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

	console.log(
		JSON.stringify(
			{
				status: missingWritten.length === 0 ? 'VERIFIED_OK' : 'MISSING_DOCS',
				beforeCount,
				writtenCount: writtenIds.length,
				afterCount,
				expectedAfterCount: beforeCount + writtenIds.length,
				missingWrittenCount: missingWritten.length,
				manifestPath
			},
			null,
			2
		)
	);

	if (missingWritten.length > 0 || afterCount !== beforeCount + writtenIds.length) {
		process.exit(1);
	}
	process.exit(0);
}

main().catch((err) => {
	console.error('Error en importación Tokko:', err);
	process.exit(1);
});
