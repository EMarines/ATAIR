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
	| 'observacion';

export type TipoRequisito = 'documento' | 'dato';

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
	obligatorioPara: string;
	motivoRegla: string;
	completado: boolean;
	estadoSistema: EstadoControlSistema;
	estatusEtiqueta: string;
	validadoPor?: string;
	actualizadoEn?: string;
	observacion?: string;
	// Exclusivo para requisitos tipo "dato"
	campoClave?: string;
	valorActual?: string;
	placeholder?: string;
	ayudaFormato?: string;
	formatoValido?: boolean;
	controladoAutomaticamente: boolean;
}

export interface ResultadoEvaluacionMotor {
	config: ConfiguracionTramite;
	requisitos: RequisitoEvaluado[];
	alertas: AlertaJuridica[];
	resumen: {
		total: number;
		completados: number;
		porcentaje: number;
		totalDocs: number;
		docsCompletados: number;
		totalDatos: number;
		datosCompletados: number;
		pendientesPorParte: {
			comprador: number;
			vendedor: number;
			inmueble: number;
		};
	};
}
