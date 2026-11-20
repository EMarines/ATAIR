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
import {
	CONFIG_DEFAULT_VENTA,
	inferirConfiguracionDesdeExpediente,
	LABELS_FORMA_PAGO,
	LABELS_GARANTIA_RENTA,
	LABELS_OPERACION
} from './motorRequisitos';
import type {
	ConfiguracionTramite,
	RegistroControlChecklist,
	TramiteExpediente
} from './tramiteTypes';

const COLLECTION_NAME = 'tramites';

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
 * Carga el expediente piloto desde static y lo convierte al formato paramétrico unificado.
 */
export async function loadPilotExpediente(): Promise<TramiteExpediente | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/tramites/Espinoza%20-%20Mu%C3%B1oz/expediente.json');
		if (!res.ok) return null;
		const raw = (await res.json()) as TramiteExpediente;
		const config = inferirConfiguracionDesdeExpediente(raw);

		const controlChecklist: Record<string, RegistroControlChecklist> = raw.controlChecklist || {};
		if (Object.keys(controlChecklist).length === 0) {
			// Migrar los cotejados iniciales del caso piloto al esquema controlado por sistema
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

		return {
			...raw,
			isPilotLocal: true,
			contratoUrl:
				'/tramites/Espinoza%20-%20Mu%C3%B1oz/CONTRATO_COMPRAVENTA_ESPINOZA_MU%C3%91OZ_ACTUALIZADO.docx',
			contratoNombre: 'CONTRATO_COMPRAVENTA_ESPINOZA_MUÑOZ_ACTUALIZADO.docx',
			configuracion: config,
			controlChecklist,
			datosCapturados: raw.datosCapturados || {},
			updatedAt: raw.updatedAt || Date.now(),
			createdAt: raw.createdAt || new Date('2026-11-19T12:00:00Z').getTime()
		};
	} catch (err) {
		console.warn('[TramiteService] Error cargando piloto local:', err);
		return null;
	}
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
	compradorCurp: 'partes.compradorTitular.curp',
	compradorRfc: 'partes.compradorTitular.rfc',
	compradorNss: 'partes.compradorTitular.nss',
	compradorConyugeNombre: 'partes.compradoraConyuge.nombre',
	compradorConyugeCurp: 'partes.compradoraConyuge.curp',
	compradorConyugeNss: 'partes.compradoraConyuge.nss',
	compradorRepLegal: 'partes.compradorTitular.representanteLegal',
	vendedorNombre: 'partes.vendedora.nombre',
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
