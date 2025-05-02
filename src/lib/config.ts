// // src/lib/config.ts

// /**
//  * Define la estructura de la configuración personalizable de la aplicación.
//  */
// interface TenantConfig {
//   id: string;
//   companyName: string;
//   logoUrl: string;
//   faviconUrl: string;
//   slogan: string | null;
//   agentName: string; 
//   companyUrl: string | null;
//   colors: {
//     primary: string;
//     secondary: string;
//     accent: string;
//   };
//   firebaseProjectId: string;
// }

// // /**
// //  * Almacena la configuración de todos los tenants disponibles
// //  */
// // const TENANTS: Record<string, TenantConfig> = {
// //   'matchhome': {
// //     id: 'matchhome',
// //     companyName: import.meta.env.VITE_MATCHHOME_COMPANY_NAME || 'Match Home',
// //     logoUrl: import.meta.env.VITE_MATCHHOME_LOGO_URL || '/logos/matchhome-logo.png',
// //     faviconUrl: import.meta.env.VITE_MATCHHOME_FAVICON || '/favicon-matchhome.png',
// //     slogan: import.meta.env.VITE_MATCHHOME_SLOGAN || 'Tu Patrimonio en Buenas Manos',
// //     agentName: import.meta.env.VITE_MATCHHOME_AGENT_NAME || 'Enrique Marines',
// //     companyUrl: import.meta.env.VITE_MATCHHOME_COMPANY_URL || 'https://www.matchhome.net/',
// //     colors: {
// //       primary: import.meta.env.VITE_MATCHHOME_PRIMARY_COLOR || '#3B82F6',
// //       secondary: import.meta.env.VITE_MATCHHOME_SECONDARY_COLOR || '#1E40AF',
// //       accent: import.meta.env.VITE_MATCHHOME_ACCENT_COLOR || '#6b21a8',
// //     },
// //     firebaseProjectId: import.meta.env.VITE_MATCHHOME_FIREBASE_PROJECT_ID || 'match-home-7d1f9',
// //   },
// //   'jgcapital': {
// //     id: 'jgcapital',
// //     companyName: import.meta.env.VITE_EMPRESA2_COMPANY_NAME || 'JGCapital',
// //     logoUrl: import.meta.env.VITE_EMPRESA2_LOGO_URL || '/logos/jgcapital-logo.png',
// //     faviconUrl: import.meta.env.VITE_EMPRESA2_FAVICON || '/favicon-jgcapital.png',
// //     slogan: import.meta.env.VITE_EMPRESA2_SLOGAN || 'Seguridad y Confianza en Bienes Raíces',
// //     agentName: import.meta.env.VITE_EMPRESA2_AGENT_NAME || 'Julio Marines',
// //     companyUrl: import.meta.env.VITE_EMPRESA2_COMPANY_URL || 'https://www.jgcapital.mx/',
// //     colors: {
// //       primary: import.meta.env.VITE_EMPRESA2_PRIMARY_COLOR || '#10B981',
// //       secondary: import.meta.env.VITE_EMPRESA2_SECONDARY_COLOR || '#059669',
// //       accent: import.meta.env.VITE_EMPRESA2_ACCENT_COLOR || '#7C3AED',
// //     },
// //     firebaseProjectId: import.meta.env.VITE_EMPRESA2_FIREBASE_PROJECT_ID || 'empresa2-proyecto',
// //   },
// //   'empresa3': {
// //     id: 'empresa3',
// //     companyName: import.meta.env.VITE_EMPRESA3_COMPANY_NAME || 'Bienes Raíces ABC',
// //     logoUrl: import.meta.env.VITE_EMPRESA3_LOGO_URL || '/empresa3-logo.png',
// //     faviconUrl: import.meta.env.VITE_EMPRESA3_FAVICON || '/favicon-empresa3.png',
// //     slogan: import.meta.env.VITE_EMPRESA3_SLOGAN || 'Construimos Tu Futuro',
// //     agentName: import.meta.env.VITE_EMPRESA3_AGENT_NAME || 'Ana Rodríguez',
// //     companyUrl: import.meta.env.VITE_EMPRESA3_COMPANY_URL || 'https://www.empresa3.com/',
// //     colors: {
// //       primary: import.meta.env.VITE_EMPRESA3_PRIMARY_COLOR || '#F59E0B',
// //       secondary: import.meta.env.VITE_EMPRESA3_SECONDARY_COLOR || '#D97706',
// //       accent: import.meta.env.VITE_EMPRESA3_ACCENT_COLOR || '#8B5CF6',
// //     },
// //     firebaseProjectId: import.meta.env.VITE_EMPRESA3_FIREBASE_PROJECT_ID || 'empresa3-proyecto',
// //   }
// // };

// // Determina el tenant actual basado en la URL, localStorage o un valor predeterminado
// function getCurrentTenantId(): string {
//   if (typeof window === 'undefined') {
//     // En el servidor, usa el default
//     return import.meta.env.VITE_DEFAULT_TENANT || 'matchhome';
//   }
  
//   // 1. Intenta detectar por dominio/subdominio
//   const hostname = window.location.hostname;
//   if (hostname.includes('jgcapital')) return 'jgcapital';
//   if (hostname.includes('empresa3')) return 'empresa3';
  
//   // 1b. Intenta detectar por ruta de URL (para localhost o desarrollo)
//   const pathname = window.location.pathname;
//   if (pathname.startsWith('/jgcapital')) return 'jgcapital';
//   if (pathname.startsWith('/empresa3')) return 'empresa3';
  
//   // 2. Busca un parámetro de URL "tenant"
//   const urlParams = new URLSearchParams(window.location.search);
//   const tenantParam = urlParams.get('tenant');
//   if (tenantParam && TENANTS[tenantParam]) {
//     // Guarda la preferencia en localStorage
//     localStorage.setItem('currentTenantId', tenantParam);
//     return tenantParam;
//   }
  
//   // 3. Busca en localStorage
//   const savedTenant = localStorage.getItem('currentTenantId');
//   if (savedTenant && TENANTS[savedTenant]) {
//     return savedTenant;
//   }
  
//   // 4. Usa el tenant predeterminado
//   return import.meta.env.VITE_DEFAULT_TENANT || 'matchhome';
// }

// // Obtiene la configuración del tenant actual
// const currentTenantId = getCurrentTenantId();
// const currentTenant = TENANTS[currentTenantId];

// // Aplica la configuración del tenant al cargar la página
// if (typeof document !== 'undefined') {
//   // Actualiza el favicon
//   const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
//   if (link) {
//     link.href = currentTenant.faviconUrl;
//   }
  
//   // Aplica colores CSS personalizados
//   document.documentElement.style.setProperty('--color-primary', currentTenant.colors.primary);
//   document.documentElement.style.setProperty('--color-secondary', currentTenant.colors.secondary);
//   document.documentElement.style.setProperty('--color-accent', currentTenant.colors.accent);
  
//   // Actualiza el título del documento si es necesario
//   document.title = currentTenant.companyName + " | ATAIR";
// }

// export { TENANTS, getCurrentTenantId };
// export type { TenantConfig };
// export default currentTenant;
