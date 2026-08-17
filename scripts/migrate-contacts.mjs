/**
 * ============================================================
 * SCRIPT DE MIGRACIÓN DE CONTACTOS Y BITÁCORAS
 * ============================================================
 * 
 * Migra datos desde:
 *   match-home-7d1f9 (DB Donante)
 * hacia:
 *   matchhome-crm-46de4 (DB Destino)
 * 
 * ⚠️ Este script se ejecuta UNA SOLA VEZ.
 * ⚠️ Las reglas de Firestore deben estar abiertas temporalmente.
 * ============================================================
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ─── Cargar variables del .env ──────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');

function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : '';
}

// ─── Configuración ─────────────────────────────────────────

const sourceConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID')
};

const targetConfig = {
    apiKey: getEnv('VITE_PROPERTIES_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_PROPERTIES_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_PROPERTIES_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_PROPERTIES_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_PROPERTIES_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_PROPERTIES_FIREBASE_APP_ID')
};

const COLLECTIONS_TO_MIGRATE = ['contacts', 'binnacles'];
const BATCH_SIZE = 400;

// ─── Utilidades ─────────────────────────────────────────────

function fmt(n) { return n.toLocaleString('es-MX'); }
function sep(c = '─', l = 60) { console.log(c.repeat(l)); }
function hdr(t) { sep('═'); console.log(`  ${t}`); sep('═'); }

// ─── Inicializar ────────────────────────────────────────────

console.log('\n');
hdr('🔥 MIGRACIÓN DE DATOS FIREBASE');
console.log(`  Origen:  ${sourceConfig.projectId}`);
console.log(`  Destino: ${targetConfig.projectId}`);
console.log(`  Colecciones: ${COLLECTIONS_TO_MIGRATE.join(', ')}`);
sep();

if (!sourceConfig.apiKey || !targetConfig.apiKey) {
    console.error('\n❌ Error: Faltan API keys en .env');
    process.exit(1);
}

const sourceApp = initializeApp(sourceConfig, 'source-migration');
const targetApp = initializeApp(targetConfig, 'target-migration');
const sourceDb = getFirestore(sourceApp);
const targetDb = getFirestore(targetApp);

console.log('\n🔌 Conexiones establecidas (sin auth - reglas abiertas)');

// ─── Migración ──────────────────────────────────────────────

async function main() {
    const startTime = Date.now();
    const results = {};

    for (const col of COLLECTIONS_TO_MIGRATE) {
        sep();
        console.log(`\n🗂️  MIGRANDO: ${col.toUpperCase()}`);
        sep('·');

        // Leer origen
        console.log(`\n📖 Leyendo "${col}" del origen...`);
        const snapshot = await getDocs(collection(sourceDb, col));
        const documents = [];
        snapshot.forEach(d => {
            if (d.exists()) documents.push({ id: d.id, data: d.data() });
        });
        console.log(`   📊 ${fmt(documents.length)} documentos encontrados`);

        if (documents.length === 0) {
            results[col] = { source: 0, written: 0, errors: 0 };
            continue;
        }

        // Escribir destino en batches
        console.log(`\n📝 Escribiendo en destino...`);
        let written = 0, errors = 0;
        const errList = [];

        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const chunk = documents.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(targetDb);

            for (const d of chunk) {
                try {
                    batch.set(doc(targetDb, col, d.id), d.data);
                } catch (e) {
                    errors++;
                    errList.push({ id: d.id, err: e.message });
                }
            }

            try {
                await batch.commit();
                written += chunk.length;
                const pct = Math.round((written / documents.length) * 100);
                process.stdout.write(`\r   ⏳ ${fmt(written)}/${fmt(documents.length)} (${pct}%)`);
            } catch (e) {
                console.error(`\n   ❌ Error batch: ${e.message}`);
                errors += chunk.length;
            }
        }
        console.log('');

        // Verificar
        const verify = await getDocs(collection(targetDb, col));

        results[col] = {
            source: documents.length,
            written,
            errors,
            finalCount: verify.size,
            errList
        };

        console.log(`\n   ✅ "${col}" migrada: ${fmt(documents.length)} → ${fmt(verify.size)}`);
    }

    // Resumen
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n');
    hdr('📊 RESUMEN DE MIGRACIÓN');

    for (const [c, r] of Object.entries(results)) {
        const ok = r.errors === 0 ? '✅' : '⚠️';
        console.log(`  ${ok} ${c}: ${fmt(r.source)} leídos → ${fmt(r.finalCount || r.written)} en destino`);
        if (r.errors > 0) {
            console.log(`     ❌ Errores: ${r.errors}`);
            r.errList?.forEach(e => console.log(`       - "${e.id}": ${e.err}`));
        }
    }

    console.log(`\n  ⏱️  Tiempo: ${elapsed}s`);
    sep('═');
    console.log(`\n  🎉 ¡Migración completada!`);
    console.log(`  📌 Verifica: https://console.firebase.google.com/project/${targetConfig.projectId}/firestore`);
    console.log(`\n  ⚠️  RECUERDA: Restaura las reglas de Firestore en ambos proyectos:\n      allow read, write: if request.auth != null;\n`);

    process.exit(0);
}

main().catch(e => {
    console.error('\n💥 Error fatal:', e);
    process.exit(1);
});
