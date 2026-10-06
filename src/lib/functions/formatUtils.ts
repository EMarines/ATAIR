// src/lib/functions/formatUtils.ts
// Utilidades unificadas de formateo numérico y moneda para ATAIR CRM

/**
 * Formatea cualquier valor numérico a moneda mexicana: $X,XXX,XXX
 */
export function formatCurrency(val: any): string {
	if (!val && val !== 0) return '';
	const str = String(val).trim();
	if (!str) return '';
	// Si ya incluye signo de pesos o abreviatura, respetarlo
	if (str.includes('$') || str.toLowerCase().includes('m')) return str;
	const num = Number(str.replace(/\D/g, ''));
	if (!isNaN(num) && num > 0) {
		return `$${num.toLocaleString('es-MX')}`;
	}
	return str;
}

/**
 * Formatea un número con separadores de miles: X,XXX
 */
export function formatNumber(val: any): string {
	if (!val && val !== 0) return '0';
	const num = Number(val);
	if (isNaN(num)) return String(val);
	return num.toLocaleString('es-MX');
}
