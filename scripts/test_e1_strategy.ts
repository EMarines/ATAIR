import assert from 'node:assert/strict';
import {
	findPropertiesInPriceRangeForContact,
	hasRecentPropertySend
} from '../src/lib/functions/propertyMatching.js';
import { planCopilotoCandidates } from '../src/lib/functions/copilotoPlanner.js';
import { buildFallbackCopilotoCard, summarizeContactBinnacles } from '../src/lib/functions/copilotoAnalyzer.js';
import type { Binnacle, Contact, Property, Todo } from '../src/lib/types.js';

console.log('--- TEST SUITE: ATAIR COPILOTO E1 STRATEGY (>10 DÍAS) ---');

const nowMs = 1794918673948; // Baseline timestamp
const elevenDaysAgo = nowMs - 11 * 86_400_000;
const fiveDaysAgo = nowMs - 5 * 86_400_000;
const twentyFourHoursAgo = nowMs - 24 * 3600_000;
const seventyTwoHoursAgo = nowMs - 72 * 3600_000;

// Propiedad de referencia
const refProperty: Property = {
	id: 'prop-ref-1',
	public_id: 'EB-WD1256',
	title: 'Casa en Venta en Las Granjas',
	price: 2_250_000,
	property_type: 'Casa',
	property_status: 'available',
	operation_type: 'sale',
	location: 'Las Granjas, Chihuahua'
} as any;

// Propiedades candidatas en catálogo
const catalogProperties: Property[] = [
	refProperty,
	{
		id: 'prop-match-1',
		public_id: 'EB-SS1832',
		title: 'Casa de Campo en Jacales',
		price: 2_350_000, // +4.4% (dentro de ±25%)
		property_type: 'Casa',
		property_status: 'available',
		operation_type: 'sale',
		location: 'Jacales, Chihuahua'
	} as any,
	{
		id: 'prop-match-2',
		public_id: 'S1-MT7970',
		title: 'Casa en Venta en Col. Junta de los Ríos',
		price: 2_200_000, // -2.2% (dentro de ±25%)
		property_type: 'Casa',
		property_status: 'available',
		operation_type: 'sale',
		location: 'Junta de los Ríos, Chihuahua'
	} as any,
	{
		id: 'prop-out-of-range',
		public_id: 'EB-KK0679',
		title: 'Casa en San Felipe',
		price: 4_950_000, // +120% (fuera de rango)
		property_type: 'Casa',
		property_status: 'available',
		operation_type: 'sale',
		location: 'San Felipe, Chihuahua'
	} as any,
	{
		id: 'prop-lot',
		public_id: 'MH-LOT1',
		title: 'Terreno en Las Granjas',
		price: 2_100_000, // Dentro de rango pero es Terreno
		property_type: 'Terreno',
		property_status: 'available',
		operation_type: 'sale',
		location: 'Las Granjas, Chihuahua'
	} as any,
	{
		id: 'prop-inactive',
		public_id: 'EB-SOLD1',
		title: 'Casa Vendida',
		price: 2_250_000,
		property_type: 'Casa',
		property_status: 'sold',
		operation_type: 'sale',
		location: 'Las Granjas, Chihuahua'
	} as any
];

// 1. TEST findPropertiesInPriceRangeForContact
console.log('[Test 1] Validando findPropertiesInPriceRangeForContact...');
const contactAlejandro: Contact = {
	id: 'cont-ale-1',
	name: 'Alejandro',
	lastname: 'González',
	telephon: '6141234567',
	propCont: 'EB-WD1256',
	typeContact: 'comprador',
	contactStage: 'E1',
	createdAt: elevenDaysAgo
} as any;

const matchedOptions = findPropertiesInPriceRangeForContact(contactAlejandro, catalogProperties, {
	tolerance: 0.25,
	excludeAlreadySent: true,
	maxResults: 3
});

assert.strictEqual(matchedOptions.length, 2, 'Debe encontrar 2 casas en rango de precio');
assert.ok(
	!matchedOptions.some((p) => p.public_id === 'EB-WD1256'),
	'NO debe incluir la propiedad de referencia EB-WD1256'
);
assert.ok(
	!matchedOptions.some((p) => p.public_id === 'EB-KK0679'),
	'NO debe incluir propiedades fuera de rango (>25%)'
);
assert.ok(
	!matchedOptions.some((p) => p.property_type === 'Terreno'),
	'NO debe incluir terrenos cuando el cliente busca casa'
);
assert.ok(
	!matchedOptions.some((p) => p.property_status === 'sold'),
	'NO debe incluir propiedades vendidas'
);
console.log('✓ findPropertiesInPriceRangeForContact pasó todas las aserciones.');

// 2. TEST hasRecentPropertySend
console.log('\n[Test 2] Validando hasRecentPropertySend...');
const binnRecentSend: Binnacle[] = [
	{
		id: 'binn-1',
		to: 'cont-ale-1',
		action: 'Propiedad enviada: ',
		comment: 'EB-SS1832',
		date: twentyFourHoursAgo
	} as any
];
const binnOldSend: Binnacle[] = [
	{
		id: 'binn-2',
		to: 'cont-ale-1',
		action: 'Propiedad enviada: ',
		comment: 'EB-SS1832',
		date: seventyTwoHoursAgo
	} as any
];
assert.strictEqual(
	hasRecentPropertySend('cont-ale-1', binnRecentSend, 48 * 3600_000, nowMs),
	true,
	'Debe detectar envío reciente (<48h)'
);
assert.strictEqual(
	hasRecentPropertySend('cont-ale-1', binnOldSend, 48 * 3600_000, nowMs),
	false,
	'Envío de hace 72h NO debe contarse como reciente'
);
assert.strictEqual(
	hasRecentPropertySend('other-cont', binnRecentSend, 48 * 3600_000, nowMs),
	false,
	'Bitácora de otro contacto no afecta'
);
console.log('✓ hasRecentPropertySend pasó todas las aserciones.');

// 3. TEST planCopilotoCandidates
console.log('\n[Test 3] Validando planCopilotoCandidates para leads E1...');

// Caso A: Lead E1 reciente (<10 días)
const contactFreshE1: Contact = {
	id: 'cont-fresh-1',
	name: 'Karla',
	lastname: 'Ríos',
	telephon: '6149998877',
	propCont: 'EB-WD1256',
	typeContact: 'comprador',
	contactStage: 'E1',
	createdAt: fiveDaysAgo
} as any;

// Caso B: Lead E1 (>10 días) Día 1: Sin envíos en 48h -> Paso 1 (send_options)
const contactDay1: Contact = {
	id: 'cont-day1-1',
	name: 'Alejandro',
	lastname: 'González',
	telephon: '6141234567',
	propCont: 'EB-WD1256',
	typeContact: 'comprador',
	contactStage: 'E1',
	createdAt: elevenDaysAgo
} as any;

// Caso C: Lead E1 (>10 días) Día 2: Con envío en 24h -> Paso 2 (followup_call)
const contactDay2: Contact = {
	id: 'cont-day2-1',
	name: 'Roberto',
	lastname: 'Mendoza',
	telephon: '6145554433',
	propCont: 'EB-WD1256',
	typeContact: 'comprador',
	contactStage: 'E1',
	createdAt: elevenDaysAgo
} as any;

const binnaclesList: Binnacle[] = [
	{
		id: 'b-day2',
		to: 'cont-day2-1',
		action: 'Propiedad enviada: ',
		comment: 'EB-SS1832',
		date: twentyFourHoursAgo
	} as any
];

const plan = planCopilotoCandidates(
	[contactFreshE1, contactDay1, contactDay2],
	catalogProperties,
	binnaclesList,
	[],
	{ nowMs, baseUrl: 'https://matchhome.vercel.app' }
);

assert.strictEqual(plan.candidates.length, 3, 'Deben planificarse los 3 candidatos');

const candFresh = plan.candidates.find((c) => c.contactId === 'cont-fresh-1')!;
assert.strictEqual(candFresh.isE1Over10Days, false, 'Lead reciente debe tener isE1Over10Days=false');
assert.strictEqual(candFresh.e1Step, undefined, 'Lead reciente no tiene e1Step');
assert.strictEqual(candFresh.matchedProperties.length, 0, 'Lead reciente no tiene matchedProperties en E1');

const candDay1 = plan.candidates.find((c) => c.contactId === 'cont-day1-1')!;
assert.strictEqual(candDay1.isE1Over10Days, true, 'Lead >10d debe tener isE1Over10Days=true');
assert.strictEqual(candDay1.e1Step, 'send_options', 'Día 1 debe tener e1Step=send_options');
assert.strictEqual(candDay1.matchedProperties.length, 2, 'Día 1 debe tener 2 propiedades emparejadas');

const candDay2 = plan.candidates.find((c) => c.contactId === 'cont-day2-1')!;
assert.strictEqual(candDay2.isE1Over10Days, true, 'Lead >10d debe tener isE1Over10Days=true');
assert.strictEqual(candDay2.e1Step, 'followup_call', 'Día 2 debe tener e1Step=followup_call');
assert.strictEqual(candDay2.matchedProperties.length, 0, 'Día 2 no lleva matchedProperties');
console.log('✓ planCopilotoCandidates pasó todas las aserciones de E1.');

// 4. TEST copilotoAnalyzer (buildFallbackCopilotoCard)
console.log('\n[Test 4] Validando buildFallbackCopilotoCard...');

// 4.1 Card para Día 1 (send_options)
const summaryDay1 = summarizeContactBinnacles([], candDay1, nowMs);
const cardDay1 = buildFallbackCopilotoCard(candDay1, summaryDay1);
assert.ok(cardDay1.taskTitle.includes('📲 E1 (>10d) · Enviar opciones en rango'), 'Título debe reflejar envío de opciones');
assert.strictEqual(cardDay1.recommendedExecution, 'whatsapp', 'Canal recomendado debe ser WhatsApp');
assert.ok(cardDay1.whatsappDraft.includes('EB-SS1832'), 'Borrador debe contener link de EB-SS1832');
assert.strictEqual(cardDay1.isE1Over10Days, true);
assert.strictEqual(cardDay1.e1Step, 'send_options');

// 4.2 Card para Día 2 (followup_call)
const summaryDay2 = summarizeContactBinnacles(binnaclesList, candDay2, nowMs);
const cardDay2 = buildFallbackCopilotoCard(candDay2, summaryDay2);
assert.ok(cardDay2.taskTitle.includes('📞 E1 (>10d) · Llamada de seguimiento'), 'Título debe reflejar llamada de seguimiento');
assert.strictEqual(cardDay2.recommendedExecution, 'call', 'Canal recomendado debe ser call');
assert.strictEqual(cardDay2.isE1Over10Days, true);
assert.strictEqual(cardDay2.e1Step, 'followup_call');

// 4.3 Card para Fresh E1 (<10d)
const summaryFresh = summarizeContactBinnacles([], candFresh, nowMs);
const cardFresh = buildFallbackCopilotoCard(candFresh, summaryFresh);
assert.ok(cardFresh.taskTitle.includes('📞 E1 · Llamar a Karla Ríos'), 'Título debe reflejar primer contacto telefónico');
assert.strictEqual(cardFresh.recommendedExecution, 'call', 'Canal recomendado debe ser call');
assert.strictEqual(cardFresh.isE1Over10Days, false);

console.log('✓ buildFallbackCopilotoCard pasó todas las aserciones para Día 1, Día 2 y Fresh E1.');

// 5. TEST isContactInGracePeriod y Exclusión en planCopilotoCandidates
console.log('\n[Test 5] Validando Tiempo de Gracia (20h-24h)...');
const contactGracePeriod: Contact = {
	id: 'cont-grace-1',
	name: 'Lucía',
	lastname: 'Sánchez',
	telephon: '6147778899',
	propCont: 'EB-WD1256',
	typeContact: 'comprador',
	contactStage: 'E1',
	createdAt: elevenDaysAgo
} as any;

const binnacleJustSent: Binnacle[] = [
	{
		id: 'b-just-now',
		to: 'cont-grace-1',
		action: 'Propiedad enviada: ',
		comment: 'EB-SS1832',
		date: nowMs - 2 * 3600_000 // Enviado hace 2 horas (hoy)
	} as any
];

const planGrace = planCopilotoCandidates(
	[contactGracePeriod],
	catalogProperties,
	binnacleJustSent,
	[],
	{ nowMs, gracePeriodHours: 20 }
);

assert.strictEqual(
	planGrace.candidates.length,
	0,
	'Lead con opciones enviadas hace 2 horas DEBE estar en tiempo de gracia y omitirse hoy'
);
assert.strictEqual(
	planGrace.counts.skippedGracePeriod,
	1,
	'skippedGracePeriod debe contabilizar 1 lead en gracia'
);
console.log('✓ Tiempo de gracia validado: contactos tocados recientemente (<20h) son omitidos.');

// 6. TEST Balanceo Multi-Etapa y Round-Robin (E4, E2, E1, E3)
console.log('\n[Test 6] Validando Balanceo Multi-Etapa y Round-Robin...');
const contactE4: Contact = {
	id: 'cont-e4-1',
	name: 'Eduardo',
	lastname: 'E4',
	telephon: '6141112233',
	typeContact: 'comprador',
	contactStage: 'Etapa 4',
	createdAt: fiveDaysAgo,
	budget: 2500000,
	selecTP: 'Casa',
	locaProperty: ['Jacales']
} as any;

const contactE2: Contact = {
	id: 'cont-e2-1',
	name: 'Esteban',
	lastname: 'E2',
	telephon: '6142223344',
	typeContact: 'comprador',
	contactStage: 'Etapa 2',
	createdAt: fiveDaysAgo
} as any;

const contactE3: Contact = {
	id: 'cont-e3-1',
	name: 'Elena',
	lastname: 'E3',
	telephon: '6143334455',
	typeContact: 'comprador',
	contactStage: 'Etapa 3',
	createdAt: fiveDaysAgo
} as any;

const planBalanced = planCopilotoCandidates(
	[contactDay1, contactE4, contactE2, contactE3],
	catalogProperties,
	[],
	[],
	{ nowMs, e1Quota: 2, e2Quota: 2, e4Quota: 2, e3Quota: 2, maxTotalCandidates: 10 }
);

const stagesReturned = planBalanced.candidates.map((c) => c.stage);
console.log('Stages intercalados devueltos:', stagesReturned);

assert.ok(stagesReturned.includes('E1'), 'Plan balanceado debe incluir E1');
assert.ok(stagesReturned.includes('E2'), 'Plan balanceado debe incluir E2');
assert.ok(stagesReturned.includes('E3'), 'Plan balanceado debe incluir E3');
// El primer lote de 4 debe tener etapas balanceadas sin monopolio de E1
assert.notStrictEqual(stagesReturned[0], stagesReturned[1], 'Las etapas deben intercalarse (Round-Robin)');
console.log('✓ Balanceo Multi-Etapa y Round-Robin pasaron todas las aserciones.');

// 7. TEST Recarga al 50% al dar clic de nuevo (isRefill)
console.log('\n[Test 7] Validando Recarga al 50% al volver a dar clic...');
// Lote base: 20 candidatos (5 por etapa)
const planInitial = planCopilotoCandidates(
	[contactDay1, contactE4, contactE2, contactE3],
	catalogProperties,
	[],
	[],
	{ nowMs, e1Quota: 4, e2Quota: 4, e4Quota: 4, e3Quota: 4, maxTotalCandidates: 16 }
);
assert.strictEqual(planInitial.isRefill, false, 'Primera corrida debe tener isRefill=false');
assert.strictEqual(planInitial.scaleApplied, 1.0, 'Escala inicial debe ser 1.0');

// Simular que ya existen tareas de Copiloto hoy
const runDateKey = planInitial.runDate;
const simulatedExistingTodos: Todo[] = [
	{
		id: 'todo-existing-1',
		source: 'atair_copiloto',
		copilotoMeta: { runDate: runDateKey, contactId: 'some-other-contact' }
	} as any
];

const planRefill = planCopilotoCandidates(
	[contactDay1, contactE4, contactE2, contactE3],
	catalogProperties,
	[],
	simulatedExistingTodos,
	{ nowMs, e1Quota: 4, e2Quota: 4, e4Quota: 4, e3Quota: 4, maxTotalCandidates: 16 }
);

assert.strictEqual(planRefill.isRefill, true, 'Corrida posterior debe detectar isRefill=true');
assert.strictEqual(planRefill.scaleApplied, 0.5, 'Escala de recarga debe ser 0.5 (50%)');
console.log('✓ Recarga al 50% validada con éxito: escala a 0.5 cuando ya existen tareas hoy.');

console.log('\n🎉 ALL_COPILOTO_TESTS_PASSED! 100% de pruebas unitarias exitosas.');
