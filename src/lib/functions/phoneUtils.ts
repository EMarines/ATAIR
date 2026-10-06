// src/lib/functions/phoneUtils.ts
// Utilidad canónica para formateo estándar de teléfonos en ATAIR CRM: ### ### #### (ej. 614 275 4512)

/**
 * Formatea cualquier número de teléfono al formato visual canónico del CRM:
 * ### ### #### (ej. "614 275 4512")
 */
export function formatDisplayPhone(raw?: string | null): string {
	if (!raw) return '';
	const digits = String(raw).replace(/\D/g, '');
	// Manejar prefijo internacional de México (+52)
	const national = digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits.slice(-10);
	if (national.length === 10) {
		return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
	}
	return String(raw).trim();
}

/**
 * Limpia cualquier string telefónico para extraer exactamente los 10 dígitos nacionales limpios.
 */
export function extractCleanPhone(raw?: string | null): string {
	if (!raw) return '';
	const digits = String(raw).replace(/\D/g, '');
	if (digits.length === 12 && digits.startsWith('52')) {
		return digits.slice(2);
	}
	return digits.slice(-10);
}
