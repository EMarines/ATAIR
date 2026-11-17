/**
 * Enriquecimiento idempotente de propiedad de contacto desde Tokko a Firestore (`contacts` y `binnacles`).
 * Relaciona las casas de Tokko con su clave oficial EasyBroker (`EB-...`).
 *
 * Modos de ejecución:
 *   node scripts/enrich-tokko-properties.mjs                (Dry-Run por defecto, 0 escrituras)
 *   node scripts/enrich-tokko-properties.mjs --execute     (Aplica cambios en Firestore y genera log manifiesto)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Mapeo forense documental Tokko -> EasyBroker / Firestore
const TOKKO_TO_EB_MAP = {
	MHO7965478: {
		ebId: 'EB-WD1256',
		title: 'Casa en Venta en Las Granjas de un Piso. Excelente Ubicación'
	},
	MHO7904460: {
		ebId: 'EB-KK0679',
		title: 'Casa en Venta en San Felipe con 4 recámaras (Álvarez de Arcilla # 1306)'
	},
	MHO7900379: {
		ebId: 'EB-RR8135',
		title: 'Lomas Universidad I Casa Nueva Recámara en Planta Baja (Bahía de Acapulco)'
	},
	MHO7998801: {
		ebId: 'EB-QZ9723',
		title: 'Departamento en Venta en Urban Loft, Colonia Linns'
	},
	MIS7975998: {
		ebId: 'EB-IE0631',
		title: 'Nave Industrial / Terreno en Parque Industrial Intermex'
	}
};

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

function last10(s) {
	const d = String(s || '').replace(/\D/g, '');
	return d.length >= 10 ? d.slice(-10) : '';
}

function parseTokkoDate(dateStr) {
	if (!dateStr) return null;
	const parts = dateStr.trim().split(/[-/]/);
	if (parts.length === 3) {
		const day = parseInt(parts[0], 10);
		const month = parseInt(parts[1], 10) - 1;
		const year = parseInt(parts[2], 10);
		const d = new Date(year, month, day, 12, 0, 0);
		if (!isNaN(d.getTime())) return d.getTime();
	}
	return null;
}

function resolveEasyBrokerMatch(tokkoPropString) {
	if (!tokkoPropString) return null;
	for (const [tokkoCode, ebData] of Object.entries(TOKKO_TO_EB_MAP)) {
		if (tokkoPropString.includes(tokkoCode)) {
			return { tokkoCode, ...ebData };
		}
	}
	// Fallback por texto
	const norm = tokkoPropString.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	if (norm.includes('granjas')) return { tokkoCode: 'granjas', ...TOKKO_TO_EB_MAP.MHO7965478 };
	if (norm.includes('arcilla')) return { tokkoCode: 'arcilla', ...TOKKO_TO_EB_MAP.MHO7904460 };
	if (norm.includes('universidad')) return { tokkoCode: 'universidad', ...TOKKO_TO_EB_MAP.MHO7900379 };
	if (norm.includes('linss')) return { tokkoCode: 'linss', ...TOKKO_TO_EB_MAP.MHO7998801 };
	if (norm.includes('intermex')) return { tokkoCode: 'intermex', ...TOKKO_TO_EB_MAP.MIS7975998 };
	return null;
}

async function main() {
	const execute = hasFlag('--execute');
	const { activeEnv, config } = loadFirebaseConfig();
	const app = initializeApp(config, 'enrich-tokko-props');
	const db = getFirestore(app);

	console.log(`Firebase conectado -> proyecto: ${config.projectId} (env=${activeEnv}, mode=${execute ? 'EXECUTE' : 'DRY_RUN'})`);

	const rawTokkoPath = join(__dirname, 'tokko_contacts_raw.json');
	const rawTokko = JSON.parse(readFileSync(rawTokkoPath, 'utf8').replace(/^\uFEFF/, ''));

	// 1. Cargar contactos de Firestore
	const snapContacts = await getDocs(collection(db, 'contacts'));
	const firestoreByPhone = new Map();
	const firestoreByEmail = new Map();
	const firestoreByName = new Map();

	snapContacts.forEach((d) => {
		const data = d.data();
		const p = last10(data.telephon);
		if (p) firestoreByPhone.set(p, { id: d.id, ...data });
		const em = (data.email || '').trim().toLowerCase();
		if (em) firestoreByEmail.set(em, { id: d.id, ...data });
		const fn = `${data.name || ''} ${data.lastname || ''}`.trim().toLowerCase();
		if (fn) firestoreByName.set(fn, { id: d.id, ...data });
	});

	// 2. Analizar coincidencias y filtrado
	const toEnrich = [];
	const alreadyHasProp = [];
	const noPropInTokko = [];
	const notFoundInFirestore = [];
	const processedContactIds = new Set();

	for (const t of rawTokko) {
		const p = last10(t['Móvil'] || t['Teléfono']);
		const email = (t['Correo electrónico'] || '').trim().toLowerCase();
		const name = (t['Nombre'] || '').trim();
		const tokkoProp = (t['Propiedades destacadas'] || t['Propiedades'] || '').trim();
		const tokkoCreatedAt = t['Fecha de creación'] || '';

		let fc = null;
		let matchBy = '';

		if (p && firestoreByPhone.has(p)) {
			fc = firestoreByPhone.get(p);
			matchBy = `teléfono (${p})`;
		} else if (email && firestoreByEmail.has(email)) {
			fc = firestoreByEmail.get(email);
			matchBy = `correo (${email})`;
		} else if (name && firestoreByName.has(name.toLowerCase())) {
			fc = firestoreByName.get(name.toLowerCase());
			matchBy = `nombre (${name})`;
		}

		if (!fc) {
			notFoundInFirestore.push({ name, phone: p, email, tokkoProp });
			continue;
		}

		if (processedContactIds.has(fc.id)) continue;
		processedContactIds.add(fc.id);

		if (!tokkoProp) {
			noPropInTokko.push({ id: fc.id, name: `${fc.name || ''} ${fc.lastname || ''}`.trim(), phone: fc.telephon });
			continue;
		}

		const currentProp = (fc.propCont || '').trim();
		if (currentProp !== '') {
			alreadyHasProp.push({
				id: fc.id,
				name: `${fc.name || ''} ${fc.lastname || ''}`.trim(),
				phone: fc.telephon,
				currentProp,
				tokkoProp
			});
			continue;
		}

		const origTimestamp = parseTokkoDate(tokkoCreatedAt) || fc.createdAt || Date.now();
		const ebMatch = resolveEasyBrokerMatch(tokkoProp);

		const propContToSet = ebMatch ? ebMatch.ebId : tokkoProp;
		const binnacleAction = ebMatch ? `Propiedad consultada: ${ebMatch.ebId}` : `Propiedad consultada (Tokko): ${tokkoProp}`;
		const binnacleComment = ebMatch
			? `Propiedad de interés inicial: ${ebMatch.ebId} - ${ebMatch.title}. Origen histórico Tokko: "${tokkoProp}" (${tokkoCreatedAt || '2026'}).`
			: `Propiedad de interés inicial importada de Tokko Broker: "${tokkoProp}" (${tokkoCreatedAt || '2026'}).`;

		toEnrich.push({
			contactId: fc.id,
			name: `${fc.name || ''} ${fc.lastname || ''}`.trim() || name,
			phone: fc.telephon || p,
			matchBy,
			stage: fc.contactStage || 'Etapa 1',
			tokkoRawProp: tokkoProp,
			hasEbMatch: !!ebMatch,
			ebId: ebMatch?.ebId || null,
			ebTitle: ebMatch?.title || null,
			propContToSet,
			binnacleAction,
			binnacleComment,
			tokkoCreatedAt,
			binnacleTimestamp: origTimestamp
		});
	}

	const withEb = toEnrich.filter((c) => c.hasEbMatch);
	const withoutEb = toEnrich.filter((c) => !c.hasEbMatch);

	console.log('\n================ RESUMEN DE CRUCE ================');
	console.log(`Total registros en archivo Tokko:        ${rawTokko.length}`);
	console.log(`Contactos coincidentes en Firestore:    ${processedContactIds.size}`);
	console.log(`Contactos que YA tenían propCont:       ${alreadyHasProp.length} (se respetan, no se tocan)`);
	console.log(`Contactos de Tokko sin propiedad:        ${noPropInTokko.length}`);
	console.log(`Contactos candidatos a ENRIQUECER:      ${toEnrich.length}`);
	console.log('---------------------------------------------------');
	console.log(`-> Con clave EasyBroker vinculada (EB-...):   ${withEb.length} (55%)`);
	console.log(`-> Con datos originales Tokko (sin clave EB): ${withoutEb.length} (45%)`);
	console.log('===================================================\n');

	// Guardar JSON de simulación detallada
	const dryRunReportPath = join(__dirname, 'tokko_enrichment_dry_run.json');
	writeFileSync(
		dryRunReportPath,
		JSON.stringify(
			{
				mode: execute ? 'EXECUTE' : 'DRY_RUN',
				timestamp: new Date().toISOString(),
				counts: {
					totalTokko: rawTokko.length,
					matched: processedContactIds.size,
					toEnrich: toEnrich.length,
					withEb: withEb.length,
					withoutEb: withoutEb.length,
					alreadyHadProp: alreadyHasProp.length,
					noPropInTokko: noPropInTokko.length
				},
				candidates: toEnrich
			},
			null,
			2
		),
		'utf-8'
	);

	console.log(`Reporte actualizado en: ${dryRunReportPath}`);

	console.log('\n--- LISTA DETALLADA DE LOS 40 CONTACTOS ---');
	toEnrich.forEach((c, idx) => {
		const num = String(idx + 1).padStart(2, '0');
		const badge = c.hasEbMatch ? `[EB -> ${c.ebId}]` : '[Tokko Orig]';
		console.log(
			`[${num}] ${c.name.padEnd(26)} | Tel: ${(c.phone || '').padEnd(12)} | ${badge.padEnd(16)} | propCont: ${c.propContToSet}`
		);
	});
	console.log('-------------------------------------------\n');

	if (!execute) {
		console.log('>> MODO DRY-RUN COMPLETADO: 0 escrituras realizadas en Firestore.');
		console.log('>> Para aplicar estos cambios en vivo, ejecuta con la bandera --execute.');
		return;
	}

	// 3. Ejecutar escrituras si flag --execute
	console.log(`>> EJECUTANDO ESCRITURA EN FIRESTORE PARA ${toEnrich.length} CONTACTOS...`);
	const batch = writeBatch(db);
	const now = Date.now();
	const createdBinnacleIds = [];
	const updatedContactIds = [];

	for (const item of toEnrich) {
		// Actualizar contacts
		const contactRef = doc(db, 'contacts', item.contactId);
		batch.update(contactRef, {
			propCont: item.propContToSet,
			updatedAt: now
		});
		updatedContactIds.push({
			contactId: item.contactId,
			name: item.name,
			phone: item.phone,
			propCont: item.propContToSet,
			hasEbMatch: item.hasEbMatch
		});

		// Insertar registro en binnacles
		const binnacleRef = doc(collection(db, 'binnacles'));
		batch.set(binnacleRef, {
			to: item.contactId,
			action: item.binnacleAction,
			comment: item.binnacleComment,
			date: item.binnacleTimestamp,
			type: 'Nota',
			user: 'Sistema Tokko-EB'
		});
		createdBinnacleIds.push(binnacleRef.id);
	}

	await batch.commit();

	const manifestPath = join(__dirname, 'tokko_enrichment_manifest.json');
	writeFileSync(
		manifestPath,
		JSON.stringify(
			{
				executedAt: new Date().toISOString(),
				environment: activeEnv,
				totalContactsEnriched: toEnrich.length,
				withEbCount: withEb.length,
				withoutEbCount: withoutEb.length,
				updatedContacts: updatedContactIds,
				createdBinnacleIds
			},
			null,
			2
		),
		'utf-8'
	);

	console.log(`✓ ÉXITO: Se enriquecieron ${toEnrich.length} contactos y se crearon ${toEnrich.length} notas en binnacles.`);
	console.log(`✓ Manifiesto de ejecución guardado en: ${manifestPath}`);
}

main().catch((err) => {
	console.error('Error durante enriquecimiento:', err);
	process.exit(1);
});
