export const CATALOG_AMENITIES = [
  "Una planta",
  "Recamara en planta baja",
  "Frente a parque",
  "Fraccionamiento privado",
  "Nueva",
  "Lista para habitar",
  "Oportunidad",
  "Alberca",
  "Sobre Avenida Principal",
  "Patio amplio"
] as const;

export const tags = [...CATALOG_AMENITIES];

export function detectCatalogAmenities(text: string, existing: string[] = []): string[] {
  if (!text) return Array.isArray(existing) ? existing : [];
  
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matched = new Set<string>(Array.isArray(existing) ? existing : []);

  // 1. Una planta
  if (/\b(una\s*planta|1\s*planta|un\s*solo\s*piso|1\s*solo\s*piso|un\s*piso|1\s*piso|planta\s*unica|una\s*sola\s*planta)\b/.test(t)) {
    matched.add('Una planta');
  }

  // 2. Recamara en planta baja
  if (/\b(recamara\s*(en\s*)?(pb|planta\s*baja)|habitacion\s*(en\s*)?(pb|planta\s*baja)|cuarto\s*(en\s*)?(pb|planta\s*baja)|dormitorio\s*(en\s*)?(pb|planta\s*baja)|recamara\s*abajo|recamaras\s*(en\s*)?(pb|planta\s*baja))\b/.test(t)) {
    matched.add('Recamara en planta baja');
  }

  // 3. Frente a parque
  if (/\b(frente\s*(a(l)?\s*)?parque|vista\s*a(l)?\s*parque|junto\s*a(l)?\s*parque|a\s*pasos\s*del\s*parque|frente\s*a(l)?\s*area\s*verde)\b/.test(t)) {
    matched.add('Frente a parque');
  }

  // 4. Fraccionamiento privado
  if (/\b(fracc(ionamiento)?\s*(privado|cerrado)|privada|colonia\s*privada|acceso\s*controlado|caseta(\s*de)?\s*(vigilancia|seguridad)|seguridad\s*24\s*[\/-]?\s*7|vigilancia\s*24\s*[\/-]?\s*7|condominio\s*cerrado|coto)\b/.test(t)) {
    matched.add('Fraccionamiento privado');
  }

  // 5. Nueva
  if (/\b(nueva|nuevo|a\s*estrenar|para\s*estrenar|por\s*estrenar|recien\s*construid[ao]|preventa)\b/.test(t)) {
    matched.add('Nueva');
  }

  // 6. Lista para habitar
  if (/\b(lista\s*para\s*(habitar|mudarse|entregar|entrar)|llave\s*en\s*mano|equipada\s*y\s*lista|para\s*habitarse)\b/.test(t)) {
    matched.add('Lista para habitar');
  }

  // 7. Oportunidad
  if (/\b(oportunidad|ganga|remate|precio\s*de\s*oportunidad|debajo\s*de(l)?\s*avaluo|por\s*debajo\s*de\s*su\s*valor)\b/.test(t)) {
    matched.add('Oportunidad');
  }

  // 8. Alberca
  if (/\b(alberca|piscina|pool)\b/.test(t)) {
    matched.add('Alberca');
  }

  // 9. Sobre Avenida Principal
  if (/\b(sobre\s*ave(nida)?|avenida\s*principal|sobre\s*blvd|sobre\s*boulevard|sobre\s*calle\s*principal|arteria\s*principal)\b/.test(t)) {
    matched.add('Sobre Avenida Principal');
  }

  // 10. Patio amplio
  if (/\b(patio\s*(amplio|grande|enorme|espacioso)|(amplio|grande|enorme|espacioso)\s*patio|mucho\s*patio|buen\s*patio|patio\s*trasero\s*(amplio|grande))\b/.test(t)) {
    matched.add('Patio amplio');
  }

  // Normalizar variaciones en existing
  for (const item of (Array.isArray(existing) ? existing : [])) {
    const itemNorm = (item || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const cat of CATALOG_AMENITIES) {
      const catNorm = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (itemNorm === catNorm) {
        matched.add(cat);
      }
    }
  }

  return Array.from(matched);
}

export const typeContacts = [
    "Comprador",
    "Vendedor",
    "Arrendador",
    "Arrendatario",
    "Agente Inmobiliario",
    "Constructor",
    "Inversionista",
    "Otro"
];

export const modeContact = [
    "Lona en Propiedad",
    "Llamada",
    "WA",
    "Email",
    "Mensaje",
    "Presencial",
    "Facebook",
    "Instagram",
    "Recomendación",
    "Página Web"
];

export const typeProperties = [
    "Casa",
    "Departamento",
    "Terreno",
    "Local Comercial",
    "Oficina",
    "Bodega",
    "Edificio",
    "Rancho",
    "Otro"
];

export const modePays = [
    "Contado",
    "Crédito Hipotecario",
    "Infonavit",
    "Fovissste",
    "Cofinavit",
    "Otro"
];

export const oneToFive = ["1", "2", "3", "4", "5"];
export const oneToFour = ["1", "2", "3", "4"];
export const oneToThree = ["1", "2", "3"];

export const contStage = [
    "Etapa 1",
    "Etapa 2",
    "Etapa 3",
    "Etapa 4",
    "Cierre",
    "Post-Venta"
];

export const arrendatarioStages = [
    "A1",
    "A2"
];

export const arrendatarioStageOptions = [
    "A1",
    "A2"
];

export const range = [
    "0 - 1,000,000",
    "1,000,000 - 2,000,000",
    "2,000,000 - 3,000,000",
    "3,000,000 - 4,000,000",
    "4,000,000 - 5,000,000",
    "5,000,000 - 7,000,000",
    "7,000,000 - 10,000,000",
    "10,000,000+"
];

export const operTypes = ["Venta", "Arrendador"];
