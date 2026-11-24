import type {
	AlertaJuridica,
	ConfiguracionTramite,
	EstadoCivil,
	EstadoControlSistema,
	FormaPagoVenta,
	OrigenInmueble,
	ParteTrato,
	PasoTramite,
	RegimenConyugal,
	RequisitoEvaluado,
	ResultadoEvaluacionMotor,
	ResumenCostosTramite,
	ResumenTiemposTramite,
	SituacionGravamen,
	SituacionParte,
	TipoGarantiaRenta,
	TipoOperacion,
	TipoPersona,
	TramiteExpediente,
	UsoArrendamiento
} from './tramiteTypes';

// ============================================================================
// CATÁLOGOS DE ETIQUETAS PARA UI (Fuente única de verdad)
// ============================================================================

export const LABELS_OPERACION: Record<TipoOperacion, string> = {
	compraventa: 'Compraventa de Inmueble',
	arrendamiento: 'Arrendamiento (Renta)'
};

export const LABELS_FORMA_PAGO: Record<FormaPagoVenta, string> = {
	contado: 'Recursos Propios (Contado / Transferencia)',
	bancario: 'Crédito Hipotecario Bancario',
	infonavit_tradicional: 'Infonavit Tradicional (Individual)',
	infonavit_conyugal: 'Infonavit Conyugal',
	infonavit_unamos: 'Infonavit Unamos Créditos',
	cofinavit: 'Cofinavit (Banco + Infonavit)',
	fovissste: 'Crédito Fovissste'
};

export const LABELS_GARANTIA_RENTA: Record<TipoGarantiaRenta, string> = {
	fiador_propiedad: 'Fiador con Propiedad Libre de Gravamen',
	poliza_juridica: 'Póliza Jurídica de Arrendamiento',
	obligado_solidario: 'Obligado Solidario con Comprobación de Ingresos',
	deposito_adicional: 'Depósito Adicional / Garantía Líquida'
};

export const LABELS_USO_RENTA: Record<UsoArrendamiento, string> = {
	habitacional: 'Casa Habitación',
	comercial: 'Local / Oficina Comercial (con IVA/Retenciones)'
};

export const LABELS_PERSONA: Record<TipoPersona, string> = {
	fisica: 'Persona Física',
	moral: 'Persona Moral (Empresa / Sociedad)'
};

export const LABELS_ESTADO_CIVIL: Record<EstadoCivil, string> = {
	soltero: 'Soltero(a)',
	casado: 'Casado(a)',
	divorciado: 'Divorciado(a)',
	viudo: 'Viudo(a)'
};

export const LABELS_REGIMEN: Record<RegimenConyugal, string> = {
	sociedad_conyugal: 'Sociedad Conyugal (Bienes Mancomunados)',
	separacion_bienes: 'Separación de Bienes'
};

export const LABELS_ORIGEN_INMUEBLE: Record<OrigenInmueble, string> = {
	compraventa_previa: 'Compraventa Anterior (Título Oneroso)',
	donacion: 'Donación (Título Gratuito / Bien Propio)',
	herencia_sucesion: 'Herencia / Adjudicación Sucesoria',
	adjudicacion: 'Adjudicación Judicial o Remate'
};

export const LABELS_GRAVAMEN: Record<SituacionGravamen, string> = {
	libre_gravamen: 'Libre de Gravamen',
	hipoteca_bancaria: 'Con Hipoteca Bancaria Vigente (Carta Saldo)',
	hipoteca_infonavit_fovissste: 'Con Hipoteca Infonavit / Fovissste Vigente'
};

export const CONFIG_DEFAULT_VENTA: ConfiguracionTramite = {
	tipoOperacion: 'compraventa',
	formaPago: 'bancario',
	comprador: {
		tipoPersona: 'fisica',
		estadoCivil: 'soltero',
		regimenConyugal: 'sociedad_conyugal'
	},
	vendedor: {
		tipoPersona: 'fisica',
		estadoCivil: 'soltero',
		regimenConyugal: 'sociedad_conyugal'
	},
	origenInmueble: 'compraventa_previa',
	situacionGravamen: 'libre_gravamen',
	exentarIsrCasaHab: true,
	discrepanciaDomicilio: false,
	clausulasMasc: false
};

// ============================================================================
// PREDICADOS AUXILIARES DE NEGOCIO (Sin duplicación de condiciones)
// ============================================================================

const ES_VENTA = (c: ConfiguracionTramite) => c.tipoOperacion === 'compraventa';
const ES_RENTA = (c: ConfiguracionTramite) => c.tipoOperacion === 'arrendamiento';

const TIENE_CREDITO_HIPOTECARIO_VENTA = (c: ConfiguracionTramite) =>
	ES_VENTA(c) && c.formaPago !== undefined && c.formaPago !== 'contado';

const TIENE_INFONAVIT = (c: ConfiguracionTramite) =>
	ES_VENTA(c) &&
	['infonavit_tradicional', 'infonavit_conyugal', 'infonavit_unamos', 'cofinavit'].includes(
		c.formaPago || ''
	);

const TIENE_BANCO = (c: ConfiguracionTramite) =>
	ES_VENTA(c) && (c.formaPago === 'bancario' || c.formaPago === 'cofinavit');

const COMPRADOR_REQUIERE_CONYUGE = (c: ConfiguracionTramite) => {
	if (c.comprador.tipoPersona !== 'fisica') return false;
	if (ES_VENTA(c) && c.formaPago === 'infonavit_conyugal') return true;
	return c.comprador.estadoCivil === 'casado' && c.comprador.regimenConyugal === 'sociedad_conyugal';
};

const VENDEDOR_CASADO_MANCOMUNADO_ONEROSO = (c: ConfiguracionTramite) => {
	if (!ES_VENTA(c) || c.vendedor.tipoPersona !== 'fisica') return false;
	if (c.vendedor.estadoCivil !== 'casado' || c.vendedor.regimenConyugal !== 'sociedad_conyugal') {
		return false;
	}
	// En Chihuahua, bienes recibidos por donación o herencia son bienes propios incluso en sociedad conyugal
	return c.origenInmueble !== 'donacion' && c.origenInmueble !== 'herencia_sucesion';
};

function labelSituacionParte(p: SituacionParte): string {
	if (p.tipoPersona === 'moral') return 'Persona Moral';
	if (p.estadoCivil === 'casado') {
		return `Casado (${p.regimenConyugal === 'separacion_bienes' ? 'Sep. Bienes' : 'Soc. Conyugal'})`;
	}
	return LABELS_ESTADO_CIVIL[p.estadoCivil];
}

// ============================================================================
// DEFINICIÓN DE REGLAS PARAMÉTRICAS (Documentos + Datos)
// ============================================================================

interface ReglaRequisitoDef {
	id: string;
	parte: ParteTrato;
	tipo: 'documento' | 'dato';
	concepto: string | ((c: ConfiguracionTramite) => string);
	obligatorioPara: string;
	motivoRegla: (c: ConfiguracionTramite) => string;
	aplica: (c: ConfiguracionTramite) => boolean;
	// Exclusivo para datos controlados por sistema
	campoClave?: string;
	placeholder?: string;
	ayudaFormato?: string;
	extractor?: (exp: TramiteExpediente) => unknown;
	validador?: (val: unknown) => boolean;
}

const tieneTextoMin = (min = 3) => (val: unknown) =>
	typeof val === 'string' && val.trim().length >= min;

const esCurpValida = (val: unknown) =>
	typeof val === 'string' && /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i.test(val.trim());

const esRfcValido = (val: unknown) =>
	typeof val === 'string' && /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/i.test(val.trim());

const esNssValido = (val: unknown) =>
	typeof val === 'string' && /^\d{11}$/.test(val.replace(/\D/g, ''));

const esClabeValida = (val: unknown) =>
	typeof val === 'string' && /^\d{18}$/.test(val.replace(/\D/g, ''));

const esMontoPositivo = (val: unknown) => {
	const num = typeof val === 'number' ? val : Number(String(val || '').replace(/[^0-9.]/g, ''));
	return !isNaN(num) && num > 0;
};

const esEmailValido = (val: unknown) =>
	typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

const getDato = (exp: TramiteExpediente, clave: string, fallback?: unknown): unknown => {
	const custom = exp.datosCapturados?.[clave];
	if (custom !== undefined && custom !== null && String(custom).trim() !== '') {
		return custom;
	}
	return fallback;
};

const REGLAS_REQUISITOS: ReglaRequisitoDef[] = [
	// ------------------------------------------------------------------------
	// PARTE COMPRADORA / ARRENDATARIA — DATOS REQUERIDOS
	// ------------------------------------------------------------------------
	{
		id: 'DATO_COMP_NOMBRE',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Nombre completo o Razón Social del Comprador / Arrendatario',
		obligatorioPara: 'Proemio del Contrato y Escritura',
		motivoRegla: (c) => (ES_RENTA(c) ? 'Universal Arrendamiento' : 'Universal Compraventa'),
		aplica: () => true,
		campoClave: 'compradorNombre',
		placeholder: 'Nombre completo conforme a identificación',
		extractor: (e) => getDato(e, 'compradorNombre', e.partes.compradorTitular?.nombre),
		validador: tieneTextoMin(5)
	},
	{
		id: 'DATO_COMP_TELEFONO',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Teléfono celular / WhatsApp del Comprador Titular',
		obligatorioPara: 'Seguimiento automatizado y notificaciones',
		motivoRegla: () => 'Control Operativo ATAIR',
		aplica: () => true,
		campoClave: 'compradorTelefono',
		placeholder: '10 dígitos (ej. 6141234567)',
		extractor: (e) => getDato(e, 'compradorTelefono', e.partes.compradorTitular?.telefono),
		validador: (v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 10
	},
	{
		id: 'DATO_COMP_EMAIL',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Correo electrónico del Comprador Titular',
		obligatorioPara: 'Notificaciones formales, CFDI y expediente digital',
		motivoRegla: () => 'Notificaciones y CFDI Notarial',
		aplica: () => true,
		campoClave: 'compradorEmail',
		placeholder: 'ejemplo@correo.com',
		ayudaFormato: 'Correo electrónico válido',
		extractor: (e) => getDato(e, 'compradorEmail', e.partes.compradorTitular?.email),
		validador: esEmailValido
	},
	{
		id: 'DATO_COMP_CURP',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'CURP del Comprador Titular (18 caracteres)',
		obligatorioPara: 'Registro Notarial, RPP y Contrato',
		motivoRegla: (c) => `Persona Física (${LABELS_OPERACION[c.tipoOperacion]})`,
		aplica: (c) => c.comprador.tipoPersona === 'fisica',
		campoClave: 'compradorCurp',
		placeholder: '18 caracteres alfanuméricos',
		ayudaFormato: 'Formato oficial RENAPO (18 caracteres)',
		extractor: (e) => getDato(e, 'compradorCurp', e.partes.compradorTitular?.curp),
		validador: esCurpValida
	},
	{
		id: 'DATO_COMP_RFC',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'RFC con Homoclave del Comprador / Arrendatario',
		obligatorioPara: 'CFDI Notarial / Facturación / PLD',
		motivoRegla: (c) => (ES_RENTA(c) ? 'Si requiere factura / Póliza' : 'Obligatorio Compraventa SAT'),
		aplica: (c) => ES_VENTA(c) || c.comprador.tipoPersona === 'moral' || c.usoArrendamiento === 'comercial',
		campoClave: 'compradorRfc',
		placeholder: '13 chars (Física) o 12 chars (Moral)',
		ayudaFormato: 'Debe incluir homoclave exacta del SAT',
		extractor: (e) => getDato(e, 'compradorRfc', e.partes.compradorTitular?.rfc),
		validador: esRfcValido
	},
	{
		id: 'DATO_COMP_NSS',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Número de Seguridad Social (NSS - 11 dígitos)',
		obligatorioPara: 'Inscripción de Crédito ante Infonavit',
		motivoRegla: (c) => `Financiamiento: ${LABELS_FORMA_PAGO[c.formaPago || 'infonavit_tradicional']}`,
		aplica: TIENE_INFONAVIT,
		campoClave: 'compradorNss',
		placeholder: '11 dígitos numéricos',
		ayudaFormato: 'Exactamente 11 dígitos IMSS',
		extractor: (e) => getDato(e, 'compradorNss', e.partes.compradorTitular?.nss),
		validador: esNssValido
	},
	{
		id: 'DATO_COMP_CONYUGE_NOMBRE',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Nombre completo del Cónyuge / Coacreditado',
		obligatorioPara: 'Comparecencia en Escritura / Crédito Conyugal',
		motivoRegla: (c) =>
			c.formaPago === 'infonavit_conyugal'
				? 'Infonavit Conyugal'
				: `Comprador ${labelSituacionParte(c.comprador)}`,
		aplica: COMPRADOR_REQUIERE_CONYUGE,
		campoClave: 'compradorConyugeNombre',
		placeholder: 'Nombre completo del cónyuge',
		extractor: (e) => getDato(e, 'compradorConyugeNombre', e.partes.compradoraConyuge?.nombre),
		validador: tieneTextoMin(5)
	},
	{
		id: 'DATO_COMP_CONYUGE_CURP',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'CURP del Cónyuge / Coacreditado',
		obligatorioPara: 'Expediente Notarial y RPP',
		motivoRegla: (c) =>
			c.formaPago === 'infonavit_conyugal'
				? 'Infonavit Conyugal'
				: 'Casado en Sociedad Conyugal',
		aplica: COMPRADOR_REQUIERE_CONYUGE,
		campoClave: 'compradorConyugeCurp',
		placeholder: '18 caracteres alfanuméricos',
		extractor: (e) => getDato(e, 'compradorConyugeCurp', e.partes.compradoraConyuge?.curp),
		validador: esCurpValida
	},
	{
		id: 'DATO_COMP_CONYUGE_NSS',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'NSS del Cónyuge Coacreditado (11 dígitos)',
		obligatorioPara: 'Enlace de Crédito Conyugal Infonavit',
		motivoRegla: () => 'Por: Crédito Infonavit Conyugal',
		aplica: (c) => ES_VENTA(c) && c.formaPago === 'infonavit_conyugal',
		campoClave: 'compradorConyugeNss',
		placeholder: '11 dígitos numéricos',
		extractor: (e) => getDato(e, 'compradorConyugeNss', e.partes.compradoraConyuge?.nss),
		validador: esNssValido
	},
	{
		id: 'DATO_COMP_CONYUGE_TELEFONO',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Teléfono celular / WhatsApp del Cónyuge Coacreditado (Compradora)',
		obligatorioPara: 'Coordinación directa, firmas y notificaciones',
		motivoRegla: (c) =>
			c.formaPago === 'infonavit_conyugal'
				? 'Infonavit Conyugal'
				: 'Casado en Sociedad Conyugal',
		aplica: COMPRADOR_REQUIERE_CONYUGE,
		campoClave: 'compradorConyugeTelefono',
		placeholder: '10 dígitos (ej. 6141234567)',
		ayudaFormato: '10 dígitos telefónicos',
		extractor: (e) => getDato(e, 'compradorConyugeTelefono', e.partes.compradoraConyuge?.telefono),
		validador: (v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 10
	},
	{
		id: 'DATO_COMP_CONYUGE_EMAIL',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Correo electrónico del Cónyuge Coacreditado (Compradora)',
		obligatorioPara: 'Expediente digital Infonavit y Notaría',
		motivoRegla: (c) =>
			c.formaPago === 'infonavit_conyugal'
				? 'Infonavit Conyugal'
				: 'Casado en Sociedad Conyugal',
		aplica: COMPRADOR_REQUIERE_CONYUGE,
		campoClave: 'compradorConyugeEmail',
		placeholder: 'ejemplo@correo.com',
		ayudaFormato: 'Correo electrónico válido',
		extractor: (e) => getDato(e, 'compradorConyugeEmail', e.partes.compradoraConyuge?.email),
		validador: esEmailValido
	},
	{
		id: 'DATO_COMP_REP_LEGAL',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Nombre del Representante Legal / Apoderado',
		obligatorioPara: 'Personalidad jurídica de Persona Moral',
		motivoRegla: () => 'Comprador / Arrendatario Persona Moral',
		aplica: (c) => c.comprador.tipoPersona === 'moral',
		campoClave: 'compradorRepLegal',
		placeholder: 'Nombre del apoderado con poder para actos de dominio/admin.',
		extractor: (e) => getDato(e, 'compradorRepLegal', e.partes.compradorTitular?.representanteLegal),
		validador: tieneTextoMin(5)
	},
	{
		id: 'DATO_RENTA_FIADOR_NOMBRE',
		parte: 'comprador',
		tipo: 'dato',
		concepto: 'Nombre y Folio Real del inmueble en garantía del Fiador',
		obligatorioPara: 'Contrato de Arrendamiento con Fiador',
		motivoRegla: () => 'Garantía: Fiador con Propiedad',
		aplica: (c) => ES_RENTA(c) && c.garantiaRenta === 'fiador_propiedad',
		campoClave: 'fiadorGarantiaResumen',
		placeholder: 'Ej. Juan Pérez - Folio Real 123456',
		extractor: (e) =>
			getDato(
				e,
				'fiadorGarantiaResumen',
				e.partes.compradorTitular?.fiadorNombre
					? `${e.partes.compradorTitular.fiadorNombre} (${e.partes.compradorTitular.fiadorFolioRealGarantia || ''})`
					: ''
			),
		validador: tieneTextoMin(6)
	},

	// ------------------------------------------------------------------------
	// PARTE COMPRADORA / ARRENDATARIA — DOCUMENTOS REQUERIDOS
	// ------------------------------------------------------------------------
	{
		id: 'DOC_COMP_INE',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Identificación Oficial Vigente (INE / Pasaporte al 200% y a color)',
		obligatorioPara: 'Identificación de identidad y firma de contrato',
		motivoRegla: (c) =>
			c.comprador.tipoPersona === 'moral'
				? 'INE del Representante Legal'
				: 'Universal Persona Física',
		aplica: () => true
	},
	{
		id: 'DOC_COMP_CURP',
		parte: 'comprador',
		tipo: 'documento',
		concepto: (c) =>
			COMPRADOR_REQUIERE_CONYUGE(c)
				? 'Constancias Oficiales de CURP Certificada por RENAPO (Titular y Cónyuge)'
				: 'Constancia Oficial de CURP Certificada por RENAPO del Comprador',
		obligatorioPara: 'Expediente Notarial e Inscripción Infonavit',
		motivoRegla: () => 'Formato Oficial RENAPO Verificado con Registro Civil',
		aplica: (c) => c.comprador.tipoPersona === 'fisica'
	},
	{
		id: 'DOC_COMP_COMPROBANTE_DOM',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Comprobante de Domicilio Actual (< 3 meses)',
		obligatorioPara: 'Expediente KYC, Banco/Infonavit y Notaría',
		motivoRegla: () => 'Requisito Universal KYC / PLD',
		aplica: () => true
	},
	{
		id: 'DOC_COMP_ACTA_NACIMIENTO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: (c) =>
			COMPRADOR_REQUIERE_CONYUGE(c)
				? 'Actas de Nacimiento Certificadas (de AMBOS: Titular y Cónyuge)'
				: 'Acta de Nacimiento Certificada del Comprador',
		obligatorioPara: 'Acreditación de nacionalidad y generales en Notaría/Crédito',
		motivoRegla: (c) => `Compraventa (${LABELS_PERSONA[c.comprador.tipoPersona]})`,
		aplica: (c) => ES_VENTA(c) && c.comprador.tipoPersona === 'fisica'
	},
	{
		id: 'DOC_COMP_CONSTANCIA_SAT',
		parte: 'comprador',
		tipo: 'documento',
		concepto: (c) =>
			COMPRADOR_REQUIERE_CONYUGE(c)
				? 'Constancias de Situación Fiscal SAT con Homoclave (de AMBOS Compradores)'
				: 'Constancia de Situación Fiscal SAT (mes en curso con homoclave)',
		obligatorioPara: 'Emisión de CFDI de escrituración / banco / arrendamiento',
		motivoRegla: (c) =>
			ES_RENTA(c) ? 'Uso Comercial / Póliza' : 'Requisito Notarial e Institucional',
		aplica: (c) => ES_VENTA(c) || c.comprador.tipoPersona === 'moral' || c.usoArrendamiento === 'comercial'
	},
	{
		id: 'DOC_COMP_CONYUGE_DOCS',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'INE vigente (al 200% y a color) y CURP del Cónyuge Coacreditado',
		obligatorioPara: 'Identificación oficial del cónyuge coacreditado / copropietario',
		motivoRegla: (c) =>
			c.formaPago === 'infonavit_conyugal'
				? 'Por: Infonavit Conyugal'
				: 'Por: Casado en Sociedad Conyugal',
		aplica: COMPRADOR_REQUIERE_CONYUGE
	},
	{
		id: 'DOC_COMP_ACTA_MATRIMONIO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Acta de Matrimonio Certificada Reciente',
		obligatorioPara: 'Acreditación de régimen conyugal ante Banco / Infonavit / Notaría',
		motivoRegla: (c) =>
			c.comprador.estadoCivil === 'casado'
				? `Comprador Casado (${LABELS_REGIMEN[c.comprador.regimenConyugal || 'sociedad_conyugal']})`
				: 'Por: Infonavit Conyugal',
		aplica: (c) =>
			(ES_VENTA(c) && c.comprador.tipoPersona === 'fisica' && c.comprador.estadoCivil === 'casado') ||
			c.formaPago === 'infonavit_conyugal'
	},
	{
		id: 'DOC_COMP_ACTA_DIVORCIO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Acta de Divorcio Certificada del Comprador',
		obligatorioPara: 'Acreditar disolución de vínculo matrimonial previo',
		motivoRegla: () => 'Comprador Divorciado',
		aplica: (c) => ES_VENTA(c) && c.comprador.tipoPersona === 'fisica' && c.comprador.estadoCivil === 'divorciado'
	},
	{
		id: 'DOC_COMP_ACTA_DEFUNCION',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Acta de Defunción del Cónyuge',
		obligatorioPara: 'Acreditar estado civil viudo en escritura',
		motivoRegla: () => 'Comprador Viudo',
		aplica: (c) => ES_VENTA(c) && c.comprador.tipoPersona === 'fisica' && c.comprador.estadoCivil === 'viudo'
	},
	{
		id: 'DOC_COMP_MORAL_ACTA_PODER',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Acta Constitutiva + RPP + Poder Notarial del Representante Legal',
		obligatorioPara: 'Acreditar existencia de la sociedad y facultades de firma',
		motivoRegla: () => 'Por: Persona Moral',
		aplica: (c) => c.comprador.tipoPersona === 'moral'
	},
	{
		id: 'DOC_COMP_PRECALIF_INFONAVIT',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Precalificación Infonavit vigente y Tablas de Descuento/Amortización',
		obligatorioPara: 'Validar monto neto (Crédito + Subcuenta de Vivienda)',
		motivoRegla: (c) => `Crédito: ${LABELS_FORMA_PAGO[c.formaPago || 'infonavit_tradicional']}`,
		aplica: TIENE_INFONAVIT
	},
	{
		id: 'DOC_COMP_TALLER_INFONAVIT',
		parte: 'comprador',
		tipo: 'documento',
		concepto: (c) =>
			c.formaPago === 'infonavit_conyugal' || c.formaPago === 'infonavit_unamos'
				? 'Constancia Taller Infonavit "Saber más para decidir mejor" (de AMBOS acreditados)'
				: 'Constancia Taller Infonavit "Saber más para decidir mejor"',
		obligatorioPara: 'Inscripción formal de crédito en módulo Infonavit',
		motivoRegla: (c) => `Crédito: ${LABELS_FORMA_PAGO[c.formaPago || 'infonavit_tradicional']}`,
		aplica: TIENE_INFONAVIT
	},
	{
		id: 'DOC_COMP_CARTA_AUTORIZACION_BANCO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Carta de Autorización Definitiva de Crédito Hipotecario Bancario',
		obligatorioPara: 'Fondeo del crédito, orden de avalúo y designación de Notaría del banco',
		motivoRegla: (c) => `Crédito: ${LABELS_FORMA_PAGO[c.formaPago || 'bancario']}`,
		aplica: TIENE_BANCO
	},
	{
		id: 'DOC_COMP_ESTADOS_CUENTA_BANCO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Comprobante de Ingresos / Últimos 3 Estados de Cuenta Bancarios',
		obligatorioPara: 'Validación bancaria o calificación de solvencia en renta/crédito',
		motivoRegla: (c) =>
			ES_RENTA(c)
				? 'Calificación Arrendatario'
				: `Crédito: ${LABELS_FORMA_PAGO[c.formaPago || 'bancario']}`,
		aplica: (c) => TIENE_BANCO(c) || ES_RENTA(c)
	},
	{
		id: 'DOC_COMP_RECIBO_APARTADO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Recibo de Apartado / Enganche Firmado',
		obligatorioPara: 'Constancia de seriedad de la operación',
		motivoRegla: () => 'Compraventa con Apartado/Anticipo',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_COMP_ORIGEN_FONDOS_CONTADO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Comprobante de Disponibilidad y Origen Lícito de Saldo/Contado (PLD)',
		obligatorioPara: 'Liquidación de precio de contado o diferencia de recursos propios (Gap)',
		motivoRegla: (c) =>
			c.formaPago === 'contado'
				? 'Pago de Contado (PLD)'
				: 'Soporte de Diferencia en Efectivo/SPEI',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_COMP_FOVISSSTE_OFICIO',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Oficio de Autorización y Constancia de Crédito Fovissste (SIF)',
		obligatorioPara: 'Asignación de notaría y validación de elegibilidad',
		motivoRegla: () => 'Por: Crédito Fovissste',
		aplica: (c) => ES_VENTA(c) && c.formaPago === 'fovissste'
	},
	{
		id: 'DOC_RENTA_GARANTIA_FIADOR',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Escritura en Garantía libre de gravamen + Predial pagado + INE del Fiador (al 200% y a color)',
		obligatorioPara: 'Blindaje de contrato de arrendamiento en Chihuahua',
		motivoRegla: () => 'Garantía: Fiador con Propiedad',
		aplica: (c) => ES_RENTA(c) && c.garantiaRenta === 'fiador_propiedad'
	},
	{
		id: 'DOC_RENTA_POLIZA_EXPEDIENTE',
		parte: 'comprador',
		tipo: 'documento',
		concepto: 'Solicitud y Buró de Crédito aprobatorio para Póliza Jurídica',
		obligatorioPara: 'Emisión de Póliza Jurídica de Arrendamiento',
		motivoRegla: () => 'Garantía: Póliza Jurídica',
		aplica: (c) => ES_RENTA(c) && c.garantiaRenta === 'poliza_juridica'
	},

	// ------------------------------------------------------------------------
	// PARTE VENDEDORA / ARRENDADORA — DATOS REQUERIDOS
	// ------------------------------------------------------------------------
	{
		id: 'DATO_VEND_NOMBRE',
		parte: 'vendedor',
		tipo: 'dato',
		concepto: 'Nombre completo o Razón Social del Propietario / Arrendador',
		obligatorioPara: 'Identidad en escritura y contrato',
		motivoRegla: () => 'Universal Propietario',
		aplica: () => true,
		campoClave: 'vendedorNombre',
		placeholder: 'Nombre actual en INE vigente',
		extractor: (e) => getDato(e, 'vendedorNombre', e.partes.vendedora?.nombre),
		validador: tieneTextoMin(5)
	},
	{
		id: 'DATO_VEND_TELEFONO',
		parte: 'vendedor',
		tipo: 'dato',
		concepto: 'Teléfono celular / WhatsApp de la Parte Vendedora',
		obligatorioPara: 'Coordinación de avalúo, firma notarial y entrega',
		motivoRegla: () => 'Contacto Propietario',
		aplica: () => true,
		campoClave: 'vendedorTelefono',
		placeholder: '10 dígitos (ej. 6141234567)',
		ayudaFormato: '10 dígitos telefónicos',
		extractor: (e) => getDato(e, 'vendedorTelefono', e.partes.vendedora?.telefono),
		validador: (v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 10
	},
	{
		id: 'DATO_VEND_EMAIL',
		parte: 'vendedor',
		tipo: 'dato',
		concepto: 'Correo electrónico de la Parte Vendedora',
		obligatorioPara: 'Envío de CFDI Notarial de retención/exención y finiquito',
		motivoRegla: () => 'CFDI Notarial y Cierre',
		aplica: () => true,
		campoClave: 'vendedorEmail',
		placeholder: 'ejemplo@correo.com',
		ayudaFormato: 'Correo electrónico válido',
		extractor: (e) => getDato(e, 'vendedorEmail', e.partes.vendedora?.email),
		validador: esEmailValido
	},
	{
		id: 'DATO_VEND_RFC',
		parte: 'vendedor',
		tipo: 'dato',
		concepto: 'RFC completo con Homoclave del Propietario (13 caracteres)',
		obligatorioPara: 'Cálculo y timbrado fiscal de ISR Notarial / CFDI Renta',
		motivoRegla: (c) => (ES_RENTA(c) ? 'Emisión de Factura Renta' : 'Obligatorio ISR Notaría'),
		aplica: (c) => ES_VENTA(c) || c.usoArrendamiento === 'comercial' || c.vendedor.tipoPersona === 'moral',
		campoClave: 'vendedorRfc',
		placeholder: 'Ej. MUVF510503XXX (13 chars)',
		ayudaFormato: 'Clave SAT completa de 12 o 13 caracteres',
		extractor: (e) => getDato(e, 'vendedorRfc', e.partes.vendedora?.rfc),
		validador: esRfcValido
	},
	{
		id: 'DATO_VEND_CLABE',
		parte: 'vendedor',
		tipo: 'dato',
		concepto: 'CLABE Interbancaria para depósito (18 dígitos a nombre del titular)',
		obligatorioPara: 'Dispersión de fondos de Infonavit / Banco / Renta',
		motivoRegla: () => 'Dispersión Financiera Segura',
		aplica: () => true,
		campoClave: 'vendedorClabe',
		placeholder: '18 dígitos numéricos',
		ayudaFormato: 'Exactamente 18 dígitos sin espacios',
		extractor: (e) => getDato(e, 'vendedorClabe', e.partes.vendedora?.clabeBancaria),
		validador: esClabeValida
	},

	// ------------------------------------------------------------------------
	// PARTE VENDEDORA / ARRENDADORA — DOCUMENTOS REQUERIDOS
	// ------------------------------------------------------------------------
	{
		id: 'DOC_VEND_INE',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Identificación Oficial Vigente (INE / Pasaporte al 200% y a color)',
		obligatorioPara: 'Acreditación de identidad del propietario',
		motivoRegla: () => 'Universal Propietario',
		aplica: () => true
	},
	{
		id: 'DOC_VEND_CURP',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Constancia Oficial de CURP Certificada por RENAPO del Propietario',
		obligatorioPara: 'Expediente Notarial y cotejo de identidad registral',
		motivoRegla: () => 'Formato Oficial RENAPO Propietario',
		aplica: (c) => c.vendedor.tipoPersona === 'fisica'
	},
	{
		id: 'DOC_VEND_ESCRITURA',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Título de Propiedad (Escritura Pública con sello de RPPyC)',
		obligatorioPara: 'Acreditación del derecho de propiedad',
		motivoRegla: (c) => `Origen: ${LABELS_ORIGEN_INMUEBLE[c.origenInmueble]}`,
		aplica: () => true
	},
	{
		id: 'DOC_VEND_BOLETA_RPP',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Boleta de Inscripción en el Registro Público (RPPyC)',
		obligatorioPara: 'Verificación de Folio Real y antecedente registral',
		motivoRegla: () => 'Certeza Registral Chihuahua',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_VEND_ACTA_NACIMIENTO',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Acta de Nacimiento Certificada del Propietario',
		obligatorioPara: 'Expediente Notarial y cotejo de CURP',
		motivoRegla: () => 'Requisito Notarial Compraventa',
		aplica: (c) => ES_VENTA(c) && c.vendedor.tipoPersona === 'fisica'
	},
	{
		id: 'DOC_VEND_CONSTANCIA_SAT',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Constancia de Situación Fiscal SAT del Propietario',
		obligatorioPara: 'Timbrado CFDI Notarial y análisis/exención de ISR',
		motivoRegla: () => 'Cumplimiento Fiscal SAT',
		aplica: (c) => ES_VENTA(c) || c.vendedor.tipoPersona === 'moral' || c.usoArrendamiento === 'comercial'
	},
	{
		id: 'DOC_VEND_ACTA_DIVORCIO',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Acta de Divorcio Certificada del Propietario (y convenio si aplica)',
		obligatorioPara: 'Acreditar cambio de estado civil respecto a escritura previa',
		motivoRegla: () => 'Vendedor Divorciado',
		aplica: (c) => ES_VENTA(c) && c.vendedor.tipoPersona === 'fisica' && c.vendedor.estadoCivil === 'divorciado'
	},
	{
		id: 'DOC_VEND_ACTA_MATRIMONIO',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Acta de Matrimonio Certificada del Vendedor',
		obligatorioPara: 'Verificación de régimen patrimonial ante Notaría',
		motivoRegla: (c) =>
			`Vendedor Casado (${LABELS_REGIMEN[c.vendedor.regimenConyugal || 'sociedad_conyugal']})`,
		aplica: (c) => ES_VENTA(c) && c.vendedor.tipoPersona === 'fisica' && c.vendedor.estadoCivil === 'casado'
	},
	{
		id: 'DOC_VEND_CONYUGE_DOCS',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'INE (al 200% y a color) + CURP + Constancia SAT del Cónyuge del Vendedor (Debe firmar)',
		obligatorioPara: 'Consentimiento y firma obligatoria de copropietario conyugal',
		motivoRegla: () => 'Vendedor Casado Soc. Conyugal (Adquisición onerosa)',
		aplica: VENDEDOR_CASADO_MANCOMUNADO_ONEROSO
	},
	{
		id: 'DOC_VEND_ACTA_DEFUNCION_CONYUGE',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Acta de Defunción del Cónyuge (y revisión sucesoria si era soc. conyugal)',
		obligatorioPara: 'Acreditar viudez y libre disposición del dominio',
		motivoRegla: () => 'Vendedor Viudo',
		aplica: (c) => ES_VENTA(c) && c.vendedor.tipoPersona === 'fisica' && c.vendedor.estadoCivil === 'viudo'
	},
	{
		id: 'DOC_VEND_SUCESION_ADJUDICACION',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Escritura o Sentencia de Adjudicación Sucesoria / Judicial inscrita',
		obligatorioPara: 'Acreditar tracto sucesivo completo en herencias o remates',
		motivoRegla: (c) => `Origen: ${LABELS_ORIGEN_INMUEBLE[c.origenInmueble]}`,
		aplica: (c) =>
			ES_VENTA(c) && (c.origenInmueble === 'herencia_sucesion' || c.origenInmueble === 'adjudicacion')
	},
	{
		id: 'DOC_VEND_MORAL_ACTA_PODER',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Acta Constitutiva + Poder para Actos de Dominio + INE Apoderado (al 200% y a color)',
		obligatorioPara: 'Facultades legales para vender o rentar como sociedad',
		motivoRegla: () => 'Vendedor Persona Moral',
		aplica: (c) => c.vendedor.tipoPersona === 'moral'
	},
	{
		id: 'DOC_VEND_PREDIAL_2026',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Boleta y Recibo de Pago del Impuesto Predial Año en Curso',
		obligatorioPara: 'Cero adeudo municipal, avalúo y escritura',
		motivoRegla: () => 'Requisito Obligatorio Chihuahua',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_VEND_JMAS_AGUA',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Último Recibo JMAS y Certificado Oficial de No Adeudo de Agua',
		obligatorioPara: 'Requisito legal de Notaría en Chihuahua para autorizar escritura',
		motivoRegla: () => 'Obligatorio Notaría Chihuahua',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_VEND_CFE_LUZ',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Recibo de Luz CFE pagado al corriente (con fecha reciente)',
		obligatorioPara: 'Avalúo (servicio activo) + Comprobante fiscal para Exención de ISR (Art. 93 LISR)',
		motivoRegla: (c) =>
			c.exentarIsrCasaHab
				? 'Exención ISR Casa Habitación + Avalúo'
				: 'Cierre de Servicios / Avalúo',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_VEND_CARATULA_BANCO',
		parte: 'vendedor',
		tipo: 'documento',
		concepto: 'Carátula de Estado de Cuenta Bancario con CLABE (y domicilio si exenta ISR)',
		obligatorioPara: 'Validación bancaria de cuenta de pago para Infonavit/Banco',
		motivoRegla: () => 'Dispersión Bancaria / Exención ISR',
		aplica: () => true
	},

	// ------------------------------------------------------------------------
	// INMUEBLE Y OPERACIÓN — DATOS Y DOCUMENTOS ESPECÍFICOS
	// ------------------------------------------------------------------------
	{
		id: 'DATO_INM_PRECIO_O_RENTA',
		parte: 'inmueble',
		tipo: 'dato',
		concepto: 'Precio de Compraventa o Renta Mensual Pactada ($ MXN)',
		obligatorioPara: 'Cláusula de Precio, Comisiones e Impuestos',
		motivoRegla: () => 'Dato Financiero Raíz',
		aplica: () => true,
		campoClave: 'precioORentaPactado',
		placeholder: 'Ej. 2150000',
		extractor: (e) =>
			getDato(
				e,
				'precioORentaPactado',
				e.financiero?.precioPactado || e.financiero?.rentaMensual
			),
		validador: esMontoPositivo
	},
	{
		id: 'DATO_INM_CLAVE_CATASTRAL',
		parte: 'inmueble',
		tipo: 'dato',
		concepto: 'Clave Catastral Municipal exacta',
		obligatorioPara: 'Avalúo fiscal, traslado de dominio e inscripción RPP',
		motivoRegla: () => 'Identificación Catastral Chihuahua',
		aplica: ES_VENTA,
		campoClave: 'claveCatastral',
		placeholder: 'Ej. 191-016-021',
		extractor: (e) => getDato(e, 'claveCatastral', e.inmueble?.claveCatastral),
		validador: tieneTextoMin(5)
	},
	{
		id: 'DATO_INM_FOLIO_REAL',
		parte: 'inmueble',
		tipo: 'dato',
		concepto: 'Folio Real / Inscripción y Libro en RPPyC',
		obligatorioPara: 'Certificado de Libertad de Gravamen y escritura',
		motivoRegla: () => 'Dato Registral Notarial',
		aplica: ES_VENTA,
		campoClave: 'folioReal',
		placeholder: 'Ej. 1120676 o Inscripción/Libro',
		extractor: (e) =>
			getDato(
				e,
				'folioReal',
				e.inmueble?.folioReal || e.inmueble?.antecedentePropiedad?.rppInscripcion
			),
		validador: tieneTextoMin(3)
	},
	{
		id: 'DOC_INM_ALINEAMIENTO_NUM_OFICIAL',
		parte: 'inmueble',
		tipo: 'documento',
		concepto: 'Constancia de Alineamiento y Número Oficial Municipal',
		obligatorioPara: 'Aclarar diferencia de nomenclatura entre Escritura y Dirección Actual',
		motivoRegla: () => 'Alerta: Discrepancia de Dirección Activa',
		aplica: (c) => ES_VENTA(c) && c.discrepanciaDomicilio
	},
	{
		id: 'DOC_INM_CARTA_SALDO_HIPOTECA',
		parte: 'inmueble',
		tipo: 'documento',
		concepto: 'Carta Saldo Condicionada de Cancelación de Hipoteca (Banco / Infonavit / Fovissste)',
		obligatorioPara: 'Liquidación de pasivo y cancelación de gravamen simultánea en Notaría',
		motivoRegla: (c) => `Gravamen: ${LABELS_GRAVAMEN[c.situacionGravamen]}`,
		aplica: (c) => ES_VENTA(c) && c.situacionGravamen !== 'libre_gravamen'
	},
	{
		id: 'DOC_INM_AVALUO_COMERCIAL',
		parte: 'inmueble',
		tipo: 'documento',
		concepto: 'Avalúo Comercial Certificado por Unidad de Valuación Autorizada',
		obligatorioPara: 'Determinar tope de financiamiento y valor fiscal de traslado',
		motivoRegla: (c) =>
			TIENE_CREDITO_HIPOTECARIO_VENTA(c)
				? 'Obligatorio Unidad de Valuación Crédito'
				: 'Avalúo Fiscal Catastral / Notaría',
		aplica: ES_VENTA
	},
	{
		id: 'DOC_INM_CONVENIO_MASC',
		parte: 'inmueble',
		tipo: 'documento',
		concepto: 'Convenio / Cláusula MASC de Mediación y Justicia Alternativa (Sala PACTUM)',
		obligatorioPara: 'Blindaje de ejecución rápida y conciliación ante conflicto',
		motivoRegla: () => 'Activado: Cláusulas MASC',
		aplica: (c) => c.clausulasMasc
	}
];

// Mapa de compatibilidad hacia el formato del caso piloto Espinoza - Muñoz
const LEGACY_TO_RULE_MAP: Record<string, { part: 'comprador' | 'vendedor'; legacyId: string }> = {
	DOC_COMP_INE: { part: 'comprador', legacyId: 'COMP-001' },
	DOC_COMP_CONYUGE_DOCS: { part: 'comprador', legacyId: 'COMP-002' },
	DOC_COMP_PRECALIF_INFONAVIT: { part: 'comprador', legacyId: 'COMP-003' },
	DOC_COMP_RECIBO_APARTADO: { part: 'comprador', legacyId: 'COMP-004' },
	DOC_COMP_ACTA_MATRIMONIO: { part: 'comprador', legacyId: 'COMP-005' },
	DOC_COMP_ACTA_NACIMIENTO: { part: 'comprador', legacyId: 'COMP-006' },
	DOC_COMP_CONSTANCIA_SAT: { part: 'comprador', legacyId: 'COMP-007' },
	DOC_COMP_COMPROBANTE_DOM: { part: 'comprador', legacyId: 'COMP-008' },
	DOC_COMP_TALLER_INFONAVIT: { part: 'comprador', legacyId: 'COMP-009' },
	DOC_COMP_ORIGEN_FONDOS_CONTADO: { part: 'comprador', legacyId: 'COMP-010' },
	DOC_COMP_CURP: { part: 'comprador', legacyId: 'COMP-011' },

	DOC_VEND_ESCRITURA: { part: 'vendedor', legacyId: 'VEND-001' },
	DOC_VEND_BOLETA_RPP: { part: 'vendedor', legacyId: 'VEND-002' },
	DOC_VEND_INE: { part: 'vendedor', legacyId: 'VEND-003' },
	DOC_VEND_ACTA_DIVORCIO: { part: 'vendedor', legacyId: 'VEND-004' },
	DOC_VEND_ACTA_NACIMIENTO: { part: 'vendedor', legacyId: 'VEND-005' },
	DOC_VEND_CONSTANCIA_SAT: { part: 'vendedor', legacyId: 'VEND-006' },
	DOC_VEND_PREDIAL_2026: { part: 'vendedor', legacyId: 'VEND-007' },
	DOC_VEND_JMAS_AGUA: { part: 'vendedor', legacyId: 'VEND-008' },
	DOC_VEND_CFE_LUZ: { part: 'vendedor', legacyId: 'VEND-009' },
	DOC_INM_ALINEAMIENTO_NUM_OFICIAL: { part: 'vendedor', legacyId: 'VEND-010' },
	DOC_VEND_CARATULA_BANCO: { part: 'vendedor', legacyId: 'VEND-011' },
	DOC_VEND_CURP: { part: 'vendedor', legacyId: 'VEND-012' }
};

export function inferirConfiguracionDesdeExpediente(exp: TramiteExpediente): ConfiguracionTramite {
	if (exp.configuracion) {
		return exp.configuracion;
	}

	const opStr = (exp.tipoOperacion || '').toLowerCase();
	const credStr = (exp.modalidadCredito || '').toLowerCase();
	const esRenta = opStr.includes('renta') || opStr.includes('arrend');

	let formaPago: FormaPagoVenta = 'contado';
	if (credStr.includes('conyugal')) formaPago = 'infonavit_conyugal';
	else if (credStr.includes('unamos')) formaPago = 'infonavit_unamos';
	else if (credStr.includes('cofinavit')) formaPago = 'cofinavit';
	else if (credStr.includes('infonavit')) formaPago = 'infonavit_tradicional';
	else if (credStr.includes('fovissste')) formaPago = 'fovissste';
	else if (credStr.includes('bancar') || credStr.includes('hipotec')) formaPago = 'bancario';

	const vendCivilRaw = (exp.partes?.vendedora?.estadoCivil || '').toLowerCase();
	let vendCivil: EstadoCivil = 'soltero';
	if (vendCivilRaw.includes('divorc')) vendCivil = 'divorciado';
	else if (vendCivilRaw.includes('casad')) vendCivil = 'casado';
	else if (vendCivilRaw.includes('viud')) vendCivil = 'viudo';

	const actoOrigenRaw = (exp.inmueble?.antecedentePropiedad?.tipoActo || '').toLowerCase();
	let origen: OrigenInmueble = 'compraventa_previa';
	if (actoOrigenRaw.includes('donac')) origen = 'donacion';
	else if (actoOrigenRaw.includes('heren') || actoOrigenRaw.includes('suces')) origen = 'herencia_sucesion';

	const hasConyuge = Boolean(exp.partes?.compradoraConyuge?.nombre);
	const hayDiscrepancia = Boolean(
		exp.inmueble?.numeroEscritura &&
			exp.inmueble?.numeroOficial &&
			exp.inmueble.numeroEscritura.trim() !== exp.inmueble.numeroOficial.trim()
	);

	return {
		tipoOperacion: esRenta ? 'arrendamiento' : 'compraventa',
		formaPago: esRenta ? undefined : formaPago,
		usoArrendamiento: esRenta ? 'habitacional' : undefined,
		garantiaRenta: esRenta ? 'fiador_propiedad' : undefined,
		comprador: {
			tipoPersona: 'fisica',
			estadoCivil: hasConyuge ? 'casado' : 'soltero',
			regimenConyugal: 'sociedad_conyugal'
		},
		vendedor: {
			tipoPersona: 'fisica',
			estadoCivil: vendCivil,
			regimenConyugal: 'sociedad_conyugal'
		},
		origenInmueble: origen,
		situacionGravamen: 'libre_gravamen',
		exentarIsrCasaHab: true,
		discrepanciaDomicilio: hayDiscrepancia,
		clausulasMasc: false
	};
}

// ============================================================================
// ALERTAS JURÍDICAS INTELIGENTES (Dictamen Automático en Vivo)
// ============================================================================

export function generarAlertasJuridicas(config: ConfiguracionTramite): AlertaJuridica[] {
	const alertas: AlertaJuridica[] = [];

	if (
		ES_VENTA(config) &&
		config.vendedor.tipoPersona === 'fisica' &&
		config.vendedor.estadoCivil === 'casado' &&
		config.vendedor.regimenConyugal === 'sociedad_conyugal' &&
		(config.origenInmueble === 'donacion' || config.origenInmueble === 'herencia_sucesion')
	) {
		alertas.push({
			id: 'ALERTA_BIEN_PROPIO',
			nivel: 'info',
			titulo: 'Excepción Legal — Bien Propio por Título Gratuito (Chihuahua)',
			detalle:
				'Aunque el vendedor esté casado bajo Sociedad Conyugal, los bienes adquiridos por Donación o Herencia son bienes propios. El cónyuge NO necesita firmar como copropietario.'
		});
	}

	if (VENDEDOR_CASADO_MANCOMUNADO_ONEROSO(config)) {
		alertas.push({
			id: 'ALERTA_FIRMA_CONYUGE_VENDEDOR',
			nivel: 'advertencia',
			titulo: 'Comparecencia Obligatoria del Cónyuge del Vendedor',
			detalle:
				'El inmueble ingresó a la Sociedad Conyugal. Es obligatorio integrar identificación, CURP y RFC de ambos cónyuges para que firmen la escritura de venta.'
		});
	}

	if (
		ES_VENTA(config) &&
		config.vendedor.tipoPersona === 'fisica' &&
		config.vendedor.estadoCivil === 'divorciado'
	) {
		alertas.push({
			id: 'ALERTA_DIVORCIO_TRACTO',
			nivel: 'advertencia',
			titulo: 'Revisión de Tracto Sucesivo por Divorcio',
			detalle:
				'Solicitar Acta de Divorcio certificada. Si adquirió el bien estando casado bajo sociedad conyugal (compra onerosa, no donación), se requerirá también el convenio de liquidación.'
		});
	}

	if (ES_VENTA(config) && config.discrepanciaDomicilio) {
		alertas.push({
			id: 'ALERTA_DISCREPANCIA_NUMERO',
			nivel: 'critica',
			titulo: 'Discrepancia de Nomenclatura (Número en Escritura vs Actual)',
			detalle:
				'Tramitar de inmediato Constancia de Alineamiento y Número Oficial ante Municipio para evitar rechazo en la Unidad de Valuación del crédito.'
		});
	}

	if (ES_VENTA(config) && config.situacionGravamen !== 'libre_gravamen') {
		alertas.push({
			id: 'ALERTA_CARTA_SALDO',
			nivel: 'critica',
			titulo: 'Gravamen Vigente — Gestión de Carta Saldo',
			detalle:
				'Se deberá solicitar Carta Saldo oficial ante el acreedor y coordinar la cancelación de hipoteca simultánea en el mismo instrumento notarial.'
		});
	}

	if (ES_VENTA(config) && config.vendedor.tipoPersona === 'fisica' && config.exentarIsrCasaHab) {
		alertas.push({
			id: 'ALERTA_EXENCION_ISR',
			nivel: 'info',
			titulo: 'Estrategia Fiscal: Exención de ISR (Art. 93 LISR)',
			detalle:
				'Exención de hasta 700,000 UDIS (~$5.8M MXN). Confirmado: se acredita prioritariamente con la Credencial para Votar (INE) vigente del enajenante cuyo domicilio coincide plenamente con el inmueble enajenado (Art. 93 Frac. XIX Inc. a LISR y Art. 155 RLISR), sin depender del recibo de CFE para la exención notarial.'
		});
	}

	return alertas;
}

// ============================================================================
// EVALUADOR DEL MOTOR (Genera Checklist + Checkboxes Controlados)
// ============================================================================

function etiquetaEstado(estado: EstadoControlSistema): string {
	switch (estado) {
		case 'validado_sistema':
			return 'Validado por Sistema ✓';
		case 'cotejado_admin':
			return 'Cotejado por Admin ✓';
		case 'en_revision':
			return 'En Revisión';
		case 'observacion':
			return 'Con Observación ⚠️';
		default:
			return 'Pendiente';
	}
}

export function evaluarRequisitosTramite(
	config: ConfiguracionTramite,
	expediente?: Partial<TramiteExpediente> | null
): ResultadoEvaluacionMotor {
	const expSeguro = (expediente || {
		partes: { vendedora: { nombre: '' }, compradorTitular: { nombre: '' } },
		inmueble: {},
		financiero: {},
		documentos: []
	}) as TramiteExpediente;

	const requisitosEvaluados: RequisitoEvaluado[] = [];

	for (const regla of REGLAS_REQUISITOS) {
		if (!regla.aplica(config)) continue;

		if (regla.tipo === 'dato') {
			const valorCrudo = regla.extractor ? regla.extractor(expSeguro) : '';
			const valorStr =
				valorCrudo !== undefined && valorCrudo !== null ? String(valorCrudo).trim() : '';
			const esValido = regla.validador ? regla.validador(valorStr) : valorStr.length > 0;
			const estadoSistema: EstadoControlSistema = esValido ? 'validado_sistema' : 'pendiente';

			const conceptoResuelto =
				typeof regla.concepto === 'function' ? regla.concepto(config) : regla.concepto;

			requisitosEvaluados.push({
				id: regla.id,
				parte: regla.parte,
				tipo: 'dato',
				concepto: conceptoResuelto,
				obligatorioPara: regla.obligatorioPara,
				motivoRegla: regla.motivoRegla(config),
				completado: esValido,
				estadoSistema,
				estatusEtiqueta: esValido ? 'Dato Validado ✓' : 'Dato Faltante',
				campoClave: regla.campoClave,
				valorActual: valorStr,
				placeholder: regla.placeholder,
				ayudaFormato: regla.ayudaFormato,
				formatoValido: esValido,
				controladoAutomaticamente: true
			});
		} else {
			const registro = expSeguro.controlChecklist?.[regla.id];
			let estadoSistema: EstadoControlSistema = registro?.estado || 'pendiente';

			// Compatibilidad heredada si no hay registro aún en controlChecklist
			if (!registro && LEGACY_TO_RULE_MAP[regla.id]) {
				const map = LEGACY_TO_RULE_MAP[regla.id];
				const arr =
					map.part === 'comprador' ? expSeguro.checklistComprador : expSeguro.checklistVendedor;
				const match = arr?.find((item) => item.id === map.legacyId);
				if (match?.completado) {
					estadoSistema = 'validado_sistema';
				}
			}

			const completado =
				estadoSistema === 'validado_sistema' || estadoSistema === 'cotejado_admin';

			const conceptoResuelto =
				typeof regla.concepto === 'function' ? regla.concepto(config) : regla.concepto;

			requisitosEvaluados.push({
				id: regla.id,
				parte: regla.parte,
				tipo: 'documento',
				concepto: conceptoResuelto,
				obligatorioPara: regla.obligatorioPara,
				motivoRegla: regla.motivoRegla(config),
				completado,
				estadoSistema,
				estatusEtiqueta: etiquetaEstado(estadoSistema),
				validadoPor: registro?.validadoPor,
				actualizadoEn: registro?.actualizadoEn,
				observacion: registro?.observacion,
				controladoAutomaticamente: false
			});
		}
	}

	const alertas = generarAlertasJuridicas(config);
	const total = requisitosEvaluados.length;
	const completados = requisitosEvaluados.filter((r) => r.completado).length;
	const docs = requisitosEvaluados.filter((r) => r.tipo === 'documento');
	const datos = requisitosEvaluados.filter((r) => r.tipo === 'dato');

	const docsCompletados = docs.filter((r) => r.completado).length;
	const datosCompletados = datos.filter((r) => r.completado).length;
	const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;
	const porcentajeDocs = docs.length > 0 ? Math.round((docsCompletados / docs.length) * 100) : 0;
	const porcentajeDatos = datos.length > 0 ? Math.round((datosCompletados / datos.length) * 100) : 0;

	// Pasos del trámite
	const pasos: PasoTramite[] = expSeguro.pasos || [];
	const totalPasos = pasos.length;
	const pasosCompletados = pasos.filter((p) => p.estado === 'completado').length;
	const pasosEnCurso = pasos.filter((p) => p.estado === 'en_curso').length;
	const pasosBloqueados = pasos.filter((p) => p.estado === 'bloqueado').length;
	const porcentajePasos = totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;

	// Costos
	const costos: ResumenCostosTramite = {
		totalEstimado: 0,
		vendedor: 0,
		comprador: 0,
		ambos: 0,
		inmobiliaria: 0,
		porDefinir: 0
	};
	for (const req of requisitosEvaluados) {
		const c = req.costoEstimado || 0;
		if (c > 0) {
			costos.totalEstimado += c;
			if (req.pagadoPor === 'vendedor') costos.vendedor += c;
			else if (req.pagadoPor === 'comprador') costos.comprador += c;
			else if (req.pagadoPor === 'ambos') costos.ambos += c;
			else if (req.pagadoPor === 'inmobiliaria') costos.inmobiliaria += c;
			else costos.porDefinir += c;
		}
	}

	// Tiempos
	const pasoActual =
		pasos.find((p) => p.estado === 'en_curso') || pasos.find((p) => p.estado === 'pendiente');
	const diasTotales = pasos.reduce((acc, p) => acc + (p.duracionEstimadaDias || 0), 0);
	const diasRestantes = pasos
		.filter((p) => p.estado !== 'completado')
		.reduce((acc, p) => acc + (p.duracionEstimadaDias || 0), 0);

	let diasTranscurridos = 0;
	if (expSeguro.fechaApertura) {
		const diff = Date.now() - new Date(expSeguro.fechaApertura).getTime();
		diasTranscurridos = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
	}

	const tiempos: ResumenTiemposTramite = {
		diasTranscurridos,
		diasEstimadosTotales: diasTotales,
		diasEstimadosRestantes: diasRestantes,
		pasoActualTitulo: pasoActual?.titulo,
		pasoActualResponsable: pasoActual?.responsable
	};

	const pendientesPorConfirmar = requisitosEvaluados.filter(
		(r) => r.requiereConfirmacionNuevo
	).length;

	return {
		config,
		requisitos: requisitosEvaluados,
		alertas,
		pasos,
		costos,
		tiempos,
		resumen: {
			total,
			completados,
			porcentaje,
			totalDocs: docs.length,
			docsCompletados,
			porcentajeDocs,
			totalDatos: datos.length,
			datosCompletados,
			porcentajeDatos,
			totalPasos,
			pasosCompletados,
			pasosEnCurso,
			pasosBloqueados,
			porcentajePasos,
			pendientesPorConfirmar,
			pendientesPorParte: {
				comprador: requisitosEvaluados.filter((r) => r.parte === 'comprador' && !r.completado)
					.length,
				vendedor: requisitosEvaluados.filter((r) => r.parte === 'vendedor' && !r.completado).length,
				inmueble: requisitosEvaluados.filter((r) => r.parte === 'inmueble' && !r.completado).length
			}
		}
	};
}
