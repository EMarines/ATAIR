import { browser } from '$app/environment';
import { db } from '$lib/firebase_toggle';
import {
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { crearCatalogoMaestroInicial } from './catalogoBaseTramites';
import {
	CONFIG_DEFAULT_VENTA,
	inferirConfiguracionDesdeExpediente,
	LABELS_FORMA_PAGO,
	LABELS_GARANTIA_RENTA,
	LABELS_OPERACION
} from './motorRequisitos';
import type {
	ConfiguracionMaestraTramites,
	ConfiguracionTramite,
	ConfirmacionRequisito,
	PasoTramite,
	RegistroControlChecklist,
	TramiteExpediente
} from './tramiteTypes';

const COLLECTION_NAME = 'tramites';
export const CONFIG_DOC_ID = '__config_maestra__';

function sanitizeForFirestore<T>(data: T): T {
	if (data === undefined) return null as unknown as T;
	if (data === null || typeof data !== 'object') return data;
	if (data instanceof Date || typeof (data as { toMillis?: unknown }).toMillis === 'function') {
		return data;
	}
	if (Array.isArray(data)) {
		return data.map(sanitizeForFirestore).filter((item) => item !== undefined) as unknown as T;
	}
	const clean: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
		if (val !== undefined) {
			clean[key] = sanitizeForFirestore(val);
		}
	}
	return clean as T;
}

export function subscribeTramites(
	onData: (tramites: TramiteExpediente[]) => void,
	onError: (err: unknown) => void
): () => void {
	if (!browser || !db) return () => {};

	const colRef = collection(db, COLLECTION_NAME);
	return onSnapshot(
		colRef,
		(snap) => {
			const list: TramiteExpediente[] = snap.docs
				.filter((d) => d.id !== CONFIG_DOC_ID)
				.map((d) => ({
					...(d.data() as TramiteExpediente),
					id: d.id
				}))
				.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
			onData(list);
		},
		(error) => {
			onError(error);
		}
	);
}

/**
 * Carga todos los expedientes locales/piloto desde static y los convierte al formato paramétrico.
 */
export async function loadAllLocalExpedientes(): Promise<TramiteExpediente[]> {
	if (!browser) return [];
	const paths = [
		'/tramites/Espinoza%20-%20Mu%C3%B1oz/expediente.json',
		'/tramites/Herrera-Caro/expediente.json'
	];
	const results: TramiteExpediente[] = [];

	for (const p of paths) {
		try {
			const res = await fetch(p);
			if (!res.ok) continue;
			const raw = (await res.json()) as TramiteExpediente;
			const config = inferirConfiguracionDesdeExpediente(raw);
			const controlChecklist: Record<string, RegistroControlChecklist> = raw.controlChecklist || {};

			if (Object.keys(controlChecklist).length === 0 && raw.id === 'TRAMITE-2026-001') {
				const preloadValidIds = [
					'DOC_COMP_INE',
					'DOC_COMP_CONYUGE_DOCS',
					'DOC_COMP_PRECALIF_INFONAVIT',
					'DOC_COMP_RECIBO_APARTADO',
					'DOC_VEND_ESCRITURA',
					'DOC_VEND_BOLETA_RPP',
					'DOC_VEND_INE'
				];
				for (const id of preloadValidIds) {
					controlChecklist[id] = {
						estado: 'validado_sistema',
						validadoPor: 'Auditoría Inicial COMPASS',
						actualizadoEn: raw.fechaApertura || '2026-11-19'
					};
				}
			}

			results.push({
				...raw,
				isPilotLocal: true,
				contratoUrl:
					raw.contratoUrl ||
					(raw.id === 'TRAMITE-2026-001'
						? '/tramites/Espinoza%20-%20Mu%C3%B1oz/Contrato%20firmado_20261121_094331.pdf'
						: '/tramites/Herrera-Caro/Herrera-Caro.docx'),
				contratoNombre:
					raw.contratoNombre ||
					(raw.id === 'TRAMITE-2026-001'
						? 'Contrato firmado_20261121_094331.pdf'
						: 'Herrera-Caro.docx'),
				configuracion: config,
				controlChecklist,
				datosCapturados: raw.datosCapturados || {},
				updatedAt: raw.updatedAt || Date.now(),
				createdAt: raw.createdAt || Date.now()
			});
		} catch (err) {
			console.warn('[TramiteService] Error cargando expediente local:', p, err);
		}
	}

	return results;
}

/**
 * Carga el expediente piloto inicial desde static (compatibilidad).
 */
export async function loadPilotExpediente(): Promise<TramiteExpediente | null> {
	const all = await loadAllLocalExpedientes();
	return all.length > 0 ? all[0] : null;
}

export async function syncPilotToFirestore(pilot: TramiteExpediente): Promise<boolean> {
	if (!db) return false;
	try {
		const clean = sanitizeForFirestore(pilot);
		await setDoc(doc(db, COLLECTION_NAME, pilot.id), clean, { merge: true });
		return true;
	} catch (err) {
		console.warn('[TramiteService] No se pudo sincronizar piloto en Firestore:', err);
		return false;
	}
}

export function describeModalidad(config: ConfiguracionTramite): {
	tipoOperacion: string;
	modalidadCredito: string;
} {
	if (config.tipoOperacion === 'arrendamiento') {
		return {
			tipoOperacion: LABELS_OPERACION.arrendamiento,
			modalidadCredito: LABELS_GARANTIA_RENTA[config.garantiaRenta || 'fiador_propiedad']
		};
	}
	return {
		tipoOperacion: LABELS_OPERACION.compraventa,
		modalidadCredito: LABELS_FORMA_PAGO[config.formaPago || 'bancario']
	};
}

export async function saveTramiteConfig(
	tramiteId: string,
	newConfig: ConfiguracionTramite
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		const desc = describeModalidad(newConfig);
		await setDoc(
			doc(db, COLLECTION_NAME, tramiteId),
			sanitizeForFirestore({
				configuracion: newConfig,
				tipoOperacion: desc.tipoOperacion,
				modalidadCredito: desc.modalidadCredito,
				updatedAt: Date.now()
			}),
			{ merge: true }
		);
		return { success: true };
	} catch (error) {
		return { success: false, error };
	}
}

export async function updateChecklistControlState(
	tramiteId: string,
	requisitoId: string,
	registro: RegistroControlChecklist
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		const payload = {
			...registro,
			actualizadoEn: registro.actualizadoEn || new Date().toISOString().slice(0, 10)
		};
		try {
			await updateDoc(doc(db, COLLECTION_NAME, tramiteId), {
				[`controlChecklist.${requisitoId}`]: sanitizeForFirestore(payload),
				updatedAt: Date.now()
			});
			return { success: true };
		} catch {
			await setDoc(
				doc(db, COLLECTION_NAME, tramiteId),
				sanitizeForFirestore({
					controlChecklist: { [requisitoId]: payload },
					updatedAt: Date.now()
				}),
				{ merge: true }
			);
			return { success: true };
		}
	} catch (error) {
		return { success: false, error };
	}
}

function assignNested(target: Record<string, any>, dottedPath: string, value: unknown) {
	const keys = dottedPath.split('.');
	let cursor = target;
	for (let i = 0; i < keys.length - 1; i++) {
		const k = keys[i];
		if (!cursor[k] || typeof cursor[k] !== 'object') cursor[k] = {};
		cursor = cursor[k];
	}
	cursor[keys[keys.length - 1]] = value;
}

const CAMPO_TO_FIRESTORE_PATH: Record<string, string> = {
	compradorNombre: 'partes.compradorTitular.nombre',
	compradorTelefono: 'partes.compradorTitular.telefono',
	compradorEmail: 'partes.compradorTitular.email',
	compradorCurp: 'partes.compradorTitular.curp',
	compradorRfc: 'partes.compradorTitular.rfc',
	compradorNss: 'partes.compradorTitular.nss',
	compradorConyugeNombre: 'partes.compradoraConyuge.nombre',
	compradorConyugeTelefono: 'partes.compradoraConyuge.telefono',
	compradorConyugeEmail: 'partes.compradoraConyuge.email',
	compradorConyugeCurp: 'partes.compradoraConyuge.curp',
	compradorConyugeNss: 'partes.compradoraConyuge.nss',
	compradorRepLegal: 'partes.compradorTitular.representanteLegal',
	vendedorNombre: 'partes.vendedora.nombre',
	vendedorTelefono: 'partes.vendedora.telefono',
	vendedorEmail: 'partes.vendedora.email',
	vendedorRfc: 'partes.vendedora.rfc',
	vendedorClabe: 'partes.vendedora.clabeBancaria',
	claveCatastral: 'inmueble.claveCatastral',
	folioReal: 'inmueble.folioReal'
};

export async function saveCapturedDatum(
	tramiteId: string,
	campoClave: string,
	valor: string,
	config?: ConfiguracionTramite
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		const updateData: Record<string, any> = {
			[`datosCapturados.${campoClave}`]: valor.trim(),
			updatedAt: Date.now()
		};

		if (CAMPO_TO_FIRESTORE_PATH[campoClave]) {
			updateData[CAMPO_TO_FIRESTORE_PATH[campoClave]] = valor.trim();
		} else if (campoClave === 'precioORentaPactado') {
			const monto = Number(valor.replace(/[^0-9.]/g, '')) || 0;
			const field =
				config?.tipoOperacion === 'arrendamiento'
					? 'financiero.rentaMensual'
					: 'financiero.precioPactado';
			updateData[field] = monto;
		}

		try {
			await updateDoc(doc(db, COLLECTION_NAME, tramiteId), updateData);
			return { success: true };
		} catch {
			const patch: Record<string, any> = {
				datosCapturados: {
					[campoClave]: valor.trim()
				},
				updatedAt: Date.now()
			};
			if (CAMPO_TO_FIRESTORE_PATH[campoClave]) {
				assignNested(patch, CAMPO_TO_FIRESTORE_PATH[campoClave], valor.trim());
			}
			await setDoc(doc(db, COLLECTION_NAME, tramiteId), sanitizeForFirestore(patch), {
				merge: true
			});
			return { success: true };
		}
	} catch (error) {
		return { success: false, error };
	}
}

export interface CrearTramitePayload {
	folderName: string;
	configuracion: ConfiguracionTramite;
	compradorNombre: string;
	compradorTelefono: string;
	compradorContactId?: string;
	vendedorNombre: string;
	vendedorTelefono: string;
	vendedorContactId?: string;
	propertyId?: string;
	calle: string;
	numeroOficial: string;
	colonia: string;
	ciudad: string;
	precioORenta: number;
}

export async function createNewTramite(
	payload: CrearTramitePayload
): Promise<{ success: boolean; tramite?: TramiteExpediente; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };

	const now = Date.now();
	const today = new Date().toISOString().slice(0, 10);
	const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
	const id = `TRAMITE-${today.slice(0, 4)}-${randomSuffix}`;
	const desc = describeModalidad(payload.configuracion || CONFIG_DEFAULT_VENTA);
	const esRenta = payload.configuracion.tipoOperacion === 'arrendamiento';

	const nuevo: TramiteExpediente = {
		id,
		folderName: payload.folderName.trim() || 'Nuevo - Expediente',
		tipoOperacion: desc.tipoOperacion,
		modalidadCredito: desc.modalidadCredito,
		estadoTramite: 'Expediente Iniciado • Checklist Paramétrico Activo',
		fechaApertura: today,
		createdAt: now,
		updatedAt: now,
		propertyId: payload.propertyId,
		configuracion: payload.configuracion,
		datosCapturados: {
			compradorNombre: payload.compradorNombre.trim(),
			compradorTelefono: payload.compradorTelefono.trim(),
			vendedorNombre: payload.vendedorNombre.trim(),
			precioORentaPactado: payload.precioORenta > 0 ? String(payload.precioORenta) : ''
		},
		controlChecklist: {},
		inmueble: {
			calle: payload.calle.trim() || 'Por definir',
			numeroEscritura: '',
			numeroOficial: payload.numeroOficial.trim(),
			colonia: payload.colonia.trim() || 'Chihuahua',
			codigoPostal: '',
			ciudad: payload.ciudad.trim() || 'Chihuahua',
			estado: 'Chihuahua',
			claveCatastral: '',
			folioReal: '',
			superficieTerrenoM2: 0,
			superficieConstruccionM2: 0,
			antecedentePropiedad: {
				tipoActo: payload.configuracion.origenInmueble,
				numeroEscritura: '',
				volumen: '',
				fecha: '',
				notario: '',
				numeroNotaria: '',
				distrito: 'Morelos',
				rppInscripcion: '',
				rppFolio: '',
				rppLibro: '',
				rppSeccion: 'Primera',
				rppFecha: ''
			}
		},
		partes: {
			vendedora: {
				contactId: payload.vendedorContactId,
				nombre: payload.vendedorNombre.trim() || 'Propietario por definir',
				nombreEnEscritura: '',
				estadoCivil: payload.configuracion.vendedor.estadoCivil,
				telefono: payload.vendedorTelefono.trim()
			},
			compradorTitular: {
				contactId: payload.compradorContactId,
				nombre: payload.compradorNombre.trim() || 'Prospecto por definir',
				telefono: payload.compradorTelefono.trim()
			}
		},
		financiero: {
			precioPactado: esRenta ? 0 : payload.precioORenta || 0,
			rentaMensual: esRenta ? payload.precioORenta || 0 : 0,
			apartadoEfectivo: 0,
			fechaApartado: today,
			saldoRestante: esRenta ? 0 : payload.precioORenta || 0,
			montoNetoInfonavit: 0,
			gapRecursosPropios: 0,
			porcentajeComisionInmobiliaria: esRenta ? 0 : 4,
			comisionInmobiliariaPactada: esRenta
				? payload.precioORenta || 0
				: Math.round((payload.precioORenta || 0) * 0.04)
		},
		documentos: []
	};

	try {
		await setDoc(doc(db, COLLECTION_NAME, id), sanitizeForFirestore(nuevo));
		return { success: true, tramite: nuevo };
	} catch (error) {
		return { success: false, error };
	}
}

export async function deleteTramite(
	tramiteId: string
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		await deleteDoc(doc(db, COLLECTION_NAME, tramiteId));
		return { success: true };
	} catch (error) {
		return { success: false, error };
	}
}

// ============================================================================
// CONFIGURACIÓN MAESTRA GLOBAL (Engrane ⚙️ en Firebase: tramites/__config_maestra__)
// ============================================================================

export function subscribeConfiguracionMaestra(
	onData: (config: ConfiguracionMaestraTramites, seededNow?: boolean) => void,
	onError?: (err: unknown) => void
): () => void {
	if (!browser || !db) {
		onData(crearCatalogoMaestroInicial(), false);
		return () => {};
	}

	const ref = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
	let seedAttempted = false;

	return onSnapshot(
		ref,
		async (snap) => {
			if (!snap.exists()) {
				const inicial = crearCatalogoMaestroInicial();
				onData(inicial, false);
				if (!seedAttempted && db) {
					seedAttempted = true;
					try {
						await setDoc(ref, sanitizeForFirestore(inicial));
						onData(inicial, true);
					} catch (seedErr) {
						console.warn('[TramiteService] No se pudo sembrar config maestra en Firestore:', seedErr);
					}
				}
				return;
			}

			const raw = snap.data() as Partial<ConfiguracionMaestraTramites>;
			const base = crearCatalogoMaestroInicial();
			let docs = Array.isArray(raw.documentos) ? raw.documentos : base.documentos;
			const versionActual = raw.version || 1;

			// Migración v1 -> v2: actualizar requisito estricto de INE al 200% y a color
			if (versionActual < 2) {
				const baseById = new Map(base.documentos.map((d) => [d.id, d]));
				const ineIds = new Set([
					'DOC_COMP_INE',
					'DOC_COMP_CONYUGE_DOCS',
					'DOC_RENTA_GARANTIA_FIADOR',
					'DOC_VEND_INE',
					'DOC_VEND_CONYUGE_DOCS',
					'DOC_VEND_MORAL_ACTA_PODER'
				]);
				docs = docs.map((d) => {
					if (ineIds.has(d.id) && baseById.has(d.id)) {
						const b = baseById.get(d.id)!;
						return { ...d, titulo: b.titulo, descripcion: b.descripcion, actualizadoEn: Date.now() };
					}
					return d;
				});
			}

			const merged: ConfiguracionMaestraTramites = {
				id: CONFIG_DOC_ID,
				version: Math.max(versionActual, 2),
				updatedAt: raw.updatedAt || Date.now(),
				ambitos: Array.isArray(raw.ambitos) && raw.ambitos.length > 0 ? raw.ambitos : base.ambitos,
				documentos: docs,
				datos: Array.isArray(raw.datos) ? raw.datos : base.datos,
				pasos: Array.isArray(raw.pasos) ? raw.pasos : base.pasos
			};
			onData(merged, false);

			if (versionActual < 2 && db) {
				try {
					await setDoc(ref, sanitizeForFirestore(merged));
				} catch (migErr) {
					console.warn('[TramiteService] No se pudo migrar v2 en Firestore:', migErr);
				}
			}
		},
		(error) => {
			console.warn('[TramiteService] Fallback local para Config Maestra:', error);
			onData(crearCatalogoMaestroInicial(), false);
			if (onError) onError(error);
		}
	);
}

export async function saveConfiguracionMaestra(
	config: ConfiguracionMaestraTramites
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		const payload: ConfiguracionMaestraTramites = {
			...config,
			id: CONFIG_DOC_ID,
			updatedAt: Date.now()
		};
		await setDoc(doc(db, COLLECTION_NAME, CONFIG_DOC_ID), sanitizeForFirestore(payload));
		return { success: true };
	} catch (error) {
		return { success: false, error };
	}
}

export async function resetConfiguracionMaestraToSeed(): Promise<{
	success: boolean;
	config: ConfiguracionMaestraTramites;
	error?: unknown;
}> {
	const seed = crearCatalogoMaestroInicial();
	const res = await saveConfiguracionMaestra(seed);
	return { ...res, config: seed };
}

export async function saveTramitePasos(
	tramiteId: string,
	pasos: PasoTramite[]
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		await setDoc(
			doc(db, COLLECTION_NAME, tramiteId),
			sanitizeForFirestore({
				pasos,
				updatedAt: Date.now()
			}),
			{ merge: true }
		);
		return { success: true };
	} catch (error) {
		return { success: false, error };
	}
}

export async function saveConfirmacionRequisito(
	tramiteId: string,
	reqId: string,
	confirmacion: ConfirmacionRequisito
): Promise<{ success: boolean; error?: unknown }> {
	if (!db) return { success: false, error: 'Firestore no inicializado' };
	try {
		try {
			await updateDoc(doc(db, COLLECTION_NAME, tramiteId), {
				[`confirmacionesRequisitos.${reqId}`]: sanitizeForFirestore(confirmacion),
				updatedAt: Date.now()
			});
			return { success: true };
		} catch {
			await setDoc(
				doc(db, COLLECTION_NAME, tramiteId),
				sanitizeForFirestore({
					confirmacionesRequisitos: { [reqId]: confirmacion },
					updatedAt: Date.now()
				}),
				{ merge: true }
			);
			return { success: true };
		}
	} catch (error) {
		return { success: false, error };
	}
}
