import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { planCopilotoCandidates } from '../src/lib/functions/copilotoPlanner.ts';
import { normalizeRawContactForAudit } from '../src/lib/functions/contactAudit.ts';
import { normalizeProperty } from '../src/lib/functions/normalizeProperty.ts';

const prodConfig = {
  apiKey: 'AIzaSyCPSB4ynujCJ7B8TFmJQFEiXSj3LpGzE9A',
  authDomain: 'matchhome-crm-46de4.firebaseapp.com',
  projectId: 'matchhome-crm-46de4'
};
const app = getApps().length > 0 ? getApps()[0] : initializeApp(prodConfig, 'live-check');
const db = getFirestore(app);

async function check() {
  console.log('Descargando datos en vivo de Firestore...');
  const [cSnap, pSnap, bSnap, tSnap] = await Promise.all([
    getDocs(collection(db, 'contacts')),
    getDocs(collection(db, 'properties')),
    getDocs(collection(db, 'binnacles')),
    getDocs(collection(db, 'todos'))
  ]);

  const contacts = cSnap.docs.map(d => normalizeRawContactForAudit(d.id, d.data() as any));
  const properties = pSnap.docs.map(d => normalizeProperty(d.data(), d.id));
  const binnacles = bSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const todos = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  console.log(`Contactos: ${contacts.length}, Propiedades: ${properties.length}, Bitacoras: ${binnacles.length}, Todos: ${todos.length}`);

  const plan = planCopilotoCandidates(contacts, properties, binnacles, todos, {
    e1Quota: 5,
    e2Quota: 5,
    e4Quota: 5,
    e3Quota: 5,
    maxTotalCandidates: 20,
    gracePeriodHours: 20
  });
  console.log('\n--- PLAN RESULT COUNTS ---');
  console.log(JSON.stringify(plan.counts, null, 2));

  const stageBreakdown: Record<string, number> = {};
  plan.candidates.forEach(c => {
    stageBreakdown[c.stage] = (stageBreakdown[c.stage] || 0) + 1;
  });
  console.log('\nStage breakdown of candidates returned:');
  console.log(JSON.stringify(stageBreakdown, null, 2));

  const nowMs = Date.now();
  console.log('\n--- VERIFICANDO CANDIDATOS CON ACTIVIDAD RECIENTE (<24h) ---');
  let recentCandidatesCount = 0;
  for (const c of plan.candidates) {
    // Check if contact has lastContact < 24h
    const contactObj = contacts.find(x => x.id === c.contactId);
    const lastContact = Number((contactObj as any)?.lastContact || 0);
    const lastResponse = Number((contactObj as any)?.lastResponse || 0);
    const lastTouch = Math.max(lastContact, lastResponse);
    const hoursSinceTouch = lastTouch > 0 ? (nowMs - lastTouch) / 3600_000 : 9999;

    // Check recent binnacles
    const contactBinnacles = binnacles.filter(b => String(b.to || '').trim() === c.contactId);
    let mostRecentBinnacleDate = 0;
    for (const b of contactBinnacles) {
      const d = Number(b.date || 0);
      if (d > mostRecentBinnacleDate) mostRecentBinnacleDate = d;
    }
    const hoursSinceBinnacle = mostRecentBinnacleDate > 0 ? (nowMs - mostRecentBinnacleDate) / 3600_000 : 9999;

    const minHours = Math.min(hoursSinceTouch, hoursSinceBinnacle);
    if (minHours < 24) {
      recentCandidatesCount++;
      console.log(`ALERTA: Candidato en plan tocado hace ${minHours.toFixed(1)}h: [${c.stage}] ${c.fullName} (ID: ${c.contactId}, step: ${c.e1Step})`);
    }
  }
  console.log(`Total candidatos en plan con actividad <24h: ${recentCandidatesCount}`);

  console.log('\nPrimeros 20 candidatos (orden en que se crean las tareas):');
  plan.candidates.slice(0, 20).forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.stage}] ${c.fullName} - ${c.isE1Over10Days ? `>10d (${c.e1Step})` : 'fresh'}`);
  });

  process.exit(0);
}
check().catch(console.error);
