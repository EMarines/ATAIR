export type TipoOperacion = 'compraventa' | 'arrendamiento';

export type FormaPagoVenta =
	| 'contado'
	| 'bancario'
	| 'infonavit_tradicional'
	| 'infonavit_conyugal'
	| 'infonavit_unamos'
	| 'cofinavit'
	| 'fovissste';

export type TipoGarantiaRenta =
	| 'fiador_propiedad'
	| 'poliza_juridica'
	| 'obligado_solidario'
	| 'deposito_adicional';

export type UsoArrendamiento = 'habitacional' | 'comercial';

export type TipoPersona = 'fisica' | 'moral';

export type EstadoCivil = 'soltero' | 'casado' | 'divorciado' | 'viudo';

export type RegimenConyugal = 'sociedad_conyugal' | 'separacion_bienes';

export type OrigenInmueble =
	| 'compraventa_previa'
	| 'donacion'
	| 'herencia_sucesion'
	| 'adjudicacion';

export type SituacionGravamen =
	| 'libre_gravamen'
	| 'hipoteca_bancaria'
	| 'hipoteca_infonavit_fovissste';

export type ParteTrato = 'comprador' | 'vendedor' | 'inmueble';

export type EstadoControlSistema =
	| 'pendiente'
	| 'en_revision'
	| 'validado_sistema'
	| 'cotejado_admin'
	| 'observacion'
	| 'no_aplica';

export type TipoRequisito = 'documento' | 'dato';

export type QuienCubreCosto = 'vendedor' | 'comprador' | 'ambos' | 'inmobiliaria' | 'por_definir';

export type CondicionRegla =
	| 'siempre'
	| 'comprador_fisica'
	| 'comprador_casado'
	| 'comprador_divorciado'
	| 'comprador_viudo'
	| 'comprador_moral'
	| 'comprador_requiere_conyuge'
	| 'vendedor_fisica'
	| 'vendedor_casado'
	| 'vendedor_casado_mancomunado'
	| 'vendedor_divorciado'
	| 'vendedor_viudo'
	| 'vendedor_moral'
	| 'con_gravamen'
	| 'sucesion_herencia'
	| 'discrepancia_domicilio'
	| 'exentar_isr'
	| 'clausulas_masc'
	| 'renta_fiador'
	| 'renta_poliza'
	| 'renta_comercial_o_venta';

export interface AmbitoConfig {
	id: string;
	nombre: string;
	tipo: 'modalidad' | 'institucion';
	activo: boolean;
}

export interface DocumentoMaestro {
	id: string;
	titulo: string;
	descripcion: string;
	obligatorioPara: string;
	dependencia: string;
	parte: ParteTrato;
	costoEstimado: number;
	pagadoPor: QuienCubreCosto;
	obligatorio: boolean;
	aplicaA: string[];
	condicion: CondicionRegla;
	activo: boolean;
	creadoEn: number;
	actualizadoEn?: number;
}

export interface DatoMaestro {
	id: string;
	campoClave: string;
	titulo: string;
	obligatorioPara: string;
	parte: ParteTrato;
	placeholder?: string;
	ayudaFormato?: string;
	aplicaA: string[];
	condicion: CondicionRegla;
	activo: boolean;
	creadoEn: number;
	actualizadoEn?: number;
}

export interface PasoMaestro {
	id: string;
	orden: number;
	titulo: string;
	descripcion: string;
	responsable: string;
	parteRelacionada?: ParteTrato | 'tramite_externo' | 'notaria' | 'general';
	duracionEstimadaDias: number;
	aplicaA: string[];
	condicion: CondicionRegla;
	activo: boolean;
	creadoEn: number;
	actualizadoEn?: number;
}

export interface ConfiguracionMaestraTramites {
	id: '__config_maestra__';
	version: number;
	updatedAt: number;
	ambitos: AmbitoConfig[];
	documentos: DocumentoMaestro[];
	datos: DatoMaestro[];
	pasos: PasoMaestro[];
}

export type EstadoPasoTramite = 'pendiente' | 'en_curso' | 'completado' | 'bloqueado';

export interface PasoTramite {
	id: string;
	orden: number;
	titulo: string;
	descripcion: string;
	responsable: string;
	parteRelacionada?: ParteTrato | 'tramite_externo' | 'notaria' | 'general';
	duracionEstimadaDias: number;
	estado: EstadoPasoTramite;
	fechaEstimada?: string;
	fechaCompletado?: string;
	notas?: string;
	esPersonalizado?: boolean;
}

export interface ConfirmacionRequisito {
	estado: 'aplica' | 'no_aplica';
	motivo?: string;
	confirmadoPor?: string;
	confirmadoEn: string;
}

export interface SituacionParte {
	tipoPersona: TipoPersona;
	estadoCivil: EstadoCivil;
	regimenConyugal?: RegimenConyugal;
}

export interface ConfiguracionTramite {
	tipoOperacion: TipoOperacion;
	formaPago?: FormaPagoVenta;
	usoArrendamiento?: UsoArrendamiento;
	garantiaRenta?: TipoGarantiaRenta;
	comprador: SituacionParte;
	vendedor: SituacionParte;
	origenInmueble: OrigenInmueble;
	situacionGravamen: SituacionGravamen;
	exentarIsrCasaHab: boolean;
	discrepanciaDomicilio: boolean;
	clausulasMasc: boolean;
}

export interface RegistroControlChecklist {
	estado: EstadoControlSistema;
	actualizadoEn?: string;
	validadoPor?: string;
	archivoUrl?: string;
	archivoNombre?: string;
	observacion?: string;
}

export interface TramiteInfonavitInfo {
	montoCredito: number;
	saldoSubcuentaVivienda: number;
	gastosTitulacion: number;
	retencionMensual: number;
	tasaInteres: number;
}

export interface TramiteParteDatos {
	contactId?: string;
	nombre: string;
	nombreEnEscritura?: string;
	estadoCivil?: string;
	curp?: string;
	rfc?: string;
	nss?: string;
	claveElector?: string;
	vigenciaIne?: string;
	domicilio?: string;
	telefono?: string;
	email?: string;
	clabeBancaria?: string;
	bancoCuenta?: string;
	razonSocial?: string;
	representanteLegal?: string;
	fiadorNombre?: string;
	fiadorTelefono?: string;
	fiadorFolioRealGarantia?: string;
	infonavit?: TramiteInfonavitInfo;
}

export interface TramiteExpediente {
	id: string;
	folderName: string;
	tipoOperacion: string;
	modalidadCredito: string;
	estadoTramite: string;
	fechaApertura: string;
	updatedAt?: number;
	createdAt?: number;
	isPilotLocal?: boolean;
	contratoUrl?: string;
	contratoNombre?: string;
	propertyId?: string;
	configuracion?: ConfiguracionTramite;
	datosCapturados?: Record<string, string>;
	controlChecklist?: Record<string, RegistroControlChecklist>;
	pasos?: PasoTramite[];
	confirmacionesRequisitos?: Record<string, ConfirmacionRequisito>;
	requisitosExtraDocs?: DocumentoMaestro[];
	requisitosExtraDatos?: DatoMaestro[];
	inmueble: {
		calle: string;
		numeroEscritura: string;
		numeroOficial: string;
		colonia: string;
		codigoPostal: string;
		ciudad: string;
		estado: string;
		claveCatastral: string;
		folioReal: string;
		superficieTerrenoM2: number;
		superficieConstruccionM2: number;
		medidasColindancias?: Record<string, string>;
		antecedentePropiedad: {
			tipoActo: string;
			numeroEscritura: string;
			volumen: string;
			fecha: string;
			notario: string;
			numeroNotaria: number | string;
			distrito: string;
			rppInscripcion: string;
			rppFolio: string;
			rppLibro: string;
			rppSeccion: string;
			rppFecha: string;
		};
		equipamientoIncluido?: string[];
		institucionAcreedoraGravamen?: string;
	};
	partes: {
		vendedora: TramiteParteDatos;
		compradorTitular: TramiteParteDatos;
		compradoraConyuge?: TramiteParteDatos;
	};
	financiero: {
		precioPactado: number;
		apartadoEfectivo: number;
		fechaApartado: string;
		saldoRestante: number;
		montoNetoInfonavit: number;
		gapRecursosPropios: number;
		estimadoGastosEscrituracionComprador?: number;
		porcentajeComisionInmobiliaria?: number;
		comisionInmobiliariaPactada: number;
		penalizacionTotal?: number;
		repartoPenalizacion?: {
			parteAfectada: number;
			inmobiliaria: number;
		};
		rentaMensual?: number;
		depositoGarantia?: number;
	};
	documentos: Array<{ nombre: string; tipo: string; estatus: string; url?: string }>;
	checklistComprador?: Array<{
		id: string;
		concepto: string;
		obligatorioPara: string;
		estatus: string;
		completado: boolean;
	}>;
	checklistVendedor?: Array<{
		id: string;
		concepto: string;
		obligatorioPara: string;
		estatus: string;
		completado: boolean;
	}>;
}

export interface AlertaJuridica {
	id: string;
	nivel: 'critica' | 'advertencia' | 'info';
	titulo: string;
	detalle: string;
}

export interface RequisitoEvaluado {
	id: string;
	parte: ParteTrato;
	tipo: TipoRequisito;
	concepto: string;
	descripcion?: string;
	dependencia?: string;
	costoEstimado?: number;
	pagadoPor?: QuienCubreCosto;
	obligatorioPara: string;
	motivoRegla: string;
	completado: boolean;
	estadoSistema: EstadoControlSistema;
	estatusEtiqueta: string;
	validadoPor?: string;
	actualizadoEn?: string;
	observacion?: string;
	// Nuevo requisito desde configuración global (⚠️) o excepción puntual
	requiereConfirmacionNuevo?: boolean;
	noAplica?: boolean;
	motivoNoAplica?: string;
	esExcepcionExpediente?: boolean;
	creadoEn?: number;
	// Exclusivo para requisitos tipo "dato"
	campoClave?: string;
	valorActual?: string;
	placeholder?: string;
	ayudaFormato?: string;
	formatoValido?: boolean;
	controladoAutomaticamente: boolean;
}

export interface ResumenCostosTramite {
	totalEstimado: number;
	vendedor: number;
	comprador: number;
	ambos: number;
	inmobiliaria: number;
	porDefinir: number;
}

export interface ResumenTiemposTramite {
	diasTranscurridos: number;
	diasEstimadosTotales: number;
	diasEstimadosRestantes: number;
	pasoActualTitulo?: string;
	pasoActualResponsable?: string;
}

export interface ResultadoEvaluacionMotor {
	config: ConfiguracionTramite;
	requisitos: RequisitoEvaluado[];
	alertas: AlertaJuridica[];
	pasos: PasoTramite[];
	costos: ResumenCostosTramite;
	tiempos: ResumenTiemposTramite;
	resumen: {
		total: number;
		completados: number;
		porcentaje: number;
		totalDocs: number;
		docsCompletados: number;
		porcentajeDocs: number;
		totalDatos: number;
		datosCompletados: number;
		porcentajeDatos: number;
		totalPasos: number;
		pasosCompletados: number;
		pasosEnCurso: number;
		pasosBloqueados: number;
		porcentajePasos: number;
		pendientesPorConfirmar: number;
		pendientesPorParte: {
			comprador: number;
			vendedor: number;
			inmueble: number;
		};
	};
}
