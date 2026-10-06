// src/lib/config/empresa.ts
import empresaData from '$lib/data/empresa.json';

export interface ConfiguracionEmpresa {
	companyName: string;
	logoUrl: string;
	faviconUrl: string;
	slogan: string;
	agentName: string;
	companyUrl: string;
	phoneNumber: string;
	whatsapp: string;
	email: string;
	address: {
		street: string;
		city: string;
		state: string;
		zipCode: string;
		country: string;
	};
	socialMedia: {
		facebook: string;
		instagram: string;
		linkedin: string;
	};
}

export const empresa: ConfiguracionEmpresa = empresaData;
