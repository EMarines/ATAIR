import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
const getEnv = (k) => (envText.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim() || '';
const config = {
  apiKey: getEnv('VITE_FIREBASE_PROD_API_KEY') || getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_PROD_AUTH_DOMAIN') || getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROD_PROJECT_ID') || getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_PROD_STORAGE_BUCKET') || getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_PROD_MESSAGING_SENDER_ID') || getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_PROD_APP_ID') || getEnv('VITE_FIREBASE_APP_ID')
};

const app = initializeApp(config, 'check-matches');
const db = getFirestore(app);

const rawTokko = JSON.parse(fs.readFileSync('scripts/tokko_contacts_raw.json', 'utf8').replace(/^\uFEFF/, ''));

function last10(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

const snap = await getDocs(collection(db, 'contacts'));
const firestoreByPhone = new Map();
const firestoreByEmail = new Map();
const firestoreByName = new Map();

snap.forEach(d => {
  const data = d.data();
  const p = last10(data.telephon);
  if (p) firestoreByPhone.set(p, { id: d.id, ...data });
  const email = (data.email || '').trim().toLowerCase();
  if (email) firestoreByEmail.set(email, { id: d.id, ...data });
  const fullName = `${data.name || ''} ${data.lastname || ''}`.trim().toLowerCase();
  if (fullName) firestoreByName.set(fullName, { id: d.id, ...data });
});

let matchedPhone = 0;
let matchedEmail = 0;
let matchedName = 0;
let canEnrich = 0;
let alreadyHasPropCont = 0;
const enrichmentCandidates = [];
const processedDocIds = new Set();

for (const t of rawTokko) {
  const p = last10(t['Móvil'] || t['Teléfono']);
  const email = (t['Correo electrónico'] || '').trim().toLowerCase();
  const name = (t['Nombre'] || '').trim().toLowerCase();
  const tokkoProp = (t['Propiedades destacadas'] || t['Propiedades'] || '').trim();

  let fc = null;
  let matchType = '';
  if (p && firestoreByPhone.has(p)) {
    fc = firestoreByPhone.get(p);
    matchType = 'phone';
    matchedPhone++;
  } else if (email && firestoreByEmail.has(email)) {
    fc = firestoreByEmail.get(email);
    matchType = 'email';
    matchedEmail++;
  } else if (name && firestoreByName.has(name)) {
    fc = firestoreByName.get(name);
    matchType = 'name';
    matchedName++;
  }

  if (fc && tokkoProp) {
    if (processedDocIds.has(fc.id)) continue;
    processedDocIds.add(fc.id);

    if (!fc.propCont || fc.propCont.trim() === '') {
      canEnrich++;
      enrichmentCandidates.push({
        contactId: fc.id,
        name: `${fc.name || ''} ${fc.lastname || ''}`.trim() || t['Nombre'],
        phone: fc.telephon || p,
        matchType,
        tokkoDestacada: t['Propiedades destacadas'] || '',
        tokkoPropiedades: t['Propiedades'] || '',
        suggestedPropCont: t['Propiedades destacadas'] || t['Propiedades']
      });
    } else {
      alreadyHasPropCont++;
    }
  }
}

console.log(JSON.stringify({
  totalTokkoRows: rawTokko.length,
  matchedPhone,
  matchedEmail,
  matchedName,
  totalUniqueMatchedContactsWithProp: processedDocIds.size,
  canEnrichEmptyPropCont: canEnrich,
  alreadyHasPropContInFirestore: alreadyHasPropCont
}, null, 2));

console.log('Sample enrichment candidates (first 10):', JSON.stringify(enrichmentCandidates.slice(0, 10), null, 2));
process.exit(0);
