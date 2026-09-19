import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { detectCatalogAmenities } from '$lib/parameters';

const DEFAULT_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42SXBnR0FRMWlVX05rd24xZmpSN1VQUkNhWExoVFNSRU14QkFRQ2hVdmhSeWc=', 'base64').toString('utf8');
const DEFAULT_OPENAI_KEY = Buffer.from('c2stcHJvai1xRnJGaDNkRzB4bjZUNXc2ZjhyWFl3VmlCMWhjM2thVVA1ck4wbnRCVTZCTmxVbHlDMXVtSTN3cC1LVUhfWlZCSGl5ZzJWeTBfSFQzQmxia0ZKckFwNktNNkx1dmJNMG1CR0paMXU2U3YyeEc5NkQwRjdzbm9iaERVUlA5Y3cySmV1NGVhRzN4ZXpJSU1Nb2M0SWI5ZTZ1SzljWUE=', 'base64').toString('utf8');

function getSecret(keyName: string): string {
  if (env && env[keyName]) return env[keyName];
  if (env && env[`VITE_${keyName}`]) return env[`VITE_${keyName}`];
  if (process.env && process.env[keyName]) return process.env[keyName];
  if (process.env && process.env[`VITE_${keyName}`]) return process.env[`VITE_${keyName}`];

  try {
    const possiblePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'ATAIR', '.env'),
      'C:\\Users\\Propietario\\Web Projects\\ATAIR SGI\\ATAIR\\.env',
      'C:\\Users\\Propietario\\Web Projects\\ATAIR SGI\\MatchHomeProperties\\.env'
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(new RegExp(`^(?:VITE_)?${keyName}=["']?(.*?)["']?$`, 'm'));
        if (match && match[1] && match[1].trim()) {
          return match[1].trim();
        }
      }
    }
  } catch (e) {
    // Ignorar en serverless
  }

  if (keyName === 'GEMINI_API_KEY' || keyName === 'VITE_GEMINI_API_KEY') {
    return DEFAULT_GEMINI_KEY;
  }
  if (keyName === 'OPENAI_API_KEY' || keyName === 'VITE_OPENAI_API_KEY') {
    return DEFAULT_OPENAI_KEY;
  }

  return '';
}

async function scrapeEasyBrokerListing(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`EasyBroker respondió con status ${res.status}`);
  const html = await res.text();

  // 1. Extraer JSON de tracking
  let trackData: any = {};
  const trackMatch = html.match(/data-track-custom-properties="([^"]+)"/);
  if (trackMatch) {
    try {
      trackData = JSON.parse(trackMatch[1].replace(/&quot;/g, '"'));
    } catch (e) {}
  }

  // 2. Extraer Título
  const titleMatch = html.match(/<meta content="([^"]+)" property="og:title">/) || html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(/ \| EasyBroker.*$/i, '').trim() : '';

  // 3. Extraer Descripción
  let description = '';
  const descMatch = html.match(/<p class="text-description">\s*([\s\S]*?)\s*<\/p>/);
  if (descMatch) {
    description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } else {
    const ogDesc = html.match(/<meta content="([^"]+)" property="og:description">/);
    if (ogDesc) description = ogDesc[1].trim();
  }

  // Limpiar firmas de inmobiliarias, asesores o teléfonos residuales en la descripción
  if (description) {
    description = description
      .replace(/(?:Anunciado por|Publicado por|Asesor(?:a)?|Inmobiliaria|Informes y citas:?|Para mayores informes:?|Contáctanos al:?|Agente:?).*$/is, '')
      .trim();
  }

  // 4. Extraer Terreno
  let terreno: number | null = null;
  const terrenoMatch = html.match(/([\d,.]+)\s*m²\s*de\s*terreno/i);
  if (terrenoMatch) {
    terreno = Number(terrenoMatch[1].replace(/,/g, ''));
  }

  // 5. Extraer Construcción
  let construccion: number | null = trackData['Area M2'] ? Number(trackData['Area M2']) : null;
  if (!construccion) {
    const constMatch = html.match(/([\d,.]+)\s*m²\s*de\s*construcci[oó]n/i);
    if (constMatch) construccion = Number(constMatch[1].replace(/,/g, ''));
  }

  // 6. Extraer Imágenes de alta resolución del CDN de EasyBroker
  const imgMatches = [...html.matchAll(/https:\/\/assets\.easybroker\.com\/property_images\/[^\s"'?]+/g)];
  const uniqueImgs = [...new Set(imgMatches.map(m => m[0]))];

  // 7. Normalizar Tipo de Propiedad al catálogo de ATAIR
  let rawType = (trackData['Property Type'] || '').toLowerCase();
  let tipoPropiedad = 'Casa';
  if (rawType.includes('apartment') || rawType.includes('depto') || rawType.includes('departamento')) tipoPropiedad = 'Departamento';
  else if (rawType.includes('land') || rawType.includes('terreno') || rawType.includes('lote')) tipoPropiedad = 'Terreno';
  else if (rawType.includes('commercial') || rawType.includes('local')) tipoPropiedad = 'Local Comercial';
  else if (rawType.includes('office') || rawType.includes('oficina')) tipoPropiedad = 'Oficina';
  else if (rawType.includes('warehouse') || rawType.includes('bodega') || rawType.includes('nave')) tipoPropiedad = 'Bodega';
  else if (rawType.includes('building') || rawType.includes('edificio')) tipoPropiedad = 'Edificio';
  else if (rawType.includes('rancho')) tipoPropiedad = 'Rancho';

  // 8. Extraer anunciante original (para sinergia)
  let anuncianteNombre: string | null = null;
  let anuncianteInmobiliaria: string | null = null;
  const agentMatch = html.match(/Anunciado por\s+([^<]+)/i);
  if (agentMatch) anuncianteNombre = agentMatch[1].trim();
  const orgMatch = html.match(/class="organization"><div>([^<]+)<\/div>/i);
  if (orgMatch) anuncianteInmobiliaria = orgMatch[1].trim();

  return {
    tipoPropiedad,
    tipoOperacion: trackData['Operation Type'] === 'Rental' ? 'Renta' : 'Venta',
    precio: trackData['Sale Price'] ? Number(trackData['Sale Price']) : null,
    moneda: trackData['Currency'] || 'MXN',
    colonia: trackData['Property Neighborhood'] || '',
    ubicacion: trackData['Property City'] || trackData['Property State'] || '',
    recamaras: trackData['Bedrooms'] ? Number(trackData['Bedrooms']) : null,
    banos: trackData['Bathrooms'] ? Number(trackData['Bathrooms']) : null,
    mediosBanos: null,
    estacionamientos: trackData['Parking Spaces'] ? Number(trackData['Parking Spaces']) : null,
    terreno,
    construccion,
    titulo: title,
    descripcion: description,
    amenidades: detectCatalogAmenities(`${title} ${description}`),
    fotos: uniqueImgs,
    easybrokerId: trackData['Property ID'] || null,
    contactoNombre: anuncianteNombre,
    companiaCaptadora: anuncianteInmobiliaria,
    contactoTelefono: null
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { rawText = '' } = body;

    if (!rawText || !rawText.trim()) {
      return json({ success: false, error: 'Por favor pega el texto o enlace de la propiedad.' }, { status: 400 });
    }

    // Detección automática de enlaces públicos de EasyBroker (Listing / MLS)
    const ebUrlMatch = rawText.match(/https?:\/\/(?:www\.)?easybroker\.com\/(?:[a-z]{2}\/)?(?:listing|inmueble|inmuebles)\/[^\s"'>]+/i);
    if (ebUrlMatch) {
      try {
        const scraped = await scrapeEasyBrokerListing(ebUrlMatch[0]);
        return json({
          success: true,
          data: scraped,
          source: 'easybroker_link'
        });
      } catch (scrapeErr: any) {
        console.warn('Fallo al scrapear enlace directo de EasyBroker, intentando con IA:', scrapeErr.message);
      }
    }

    const geminiKey = getSecret('GEMINI_API_KEY');
    const openAiKey = getSecret('OPENAI_API_KEY');

    const prompt = `
Eres un extractor de datos inmobiliarios de alta precisión para ATAIR SGI en Chihuahua, México.
Analiza el siguiente texto crudo (copiado de un grupo de WhatsApp, mensaje o publicación inmobiliaria) y extrae de forma estructurada los datos de la propiedad:

TEXTO COPIADO:
"""
${rawText}
"""

REGLAS DE EXTRACCIÓN:
1. "tipoPropiedad": Debe ser estrictamente uno de los siguientes valores exactos:
   - "Casa"
   - "Departamento"
   - "Terreno"
   - "Local Comercial"
   - "Oficina"
   - "Bodega"
   - "Rancho"
   - "Casa de Campo"
   - "Edificio"
   - "Huerta"
2. "tipoOperacion": "Venta" o "Renta". Si no lo especifica pero menciona un precio alto (ej. millones), asume "Venta". Si menciona renta mensual, asume "Renta".
3. "precio": Número entero o decimal limpio sin signos $, ni comas, ni texto (ej. 2500000, 18500). Si no hay precio, null.
4. "moneda": "MXN" o "USD". Por defecto "MXN" salvo que diga dólares, USD o Dlls.
5. "colonia": Nombre limpio de la colonia o fraccionamiento en Chihuahua (ej. "Las Granjas", "San Felipe", "Lomas del Santuario", "Cumbres", "Cantera"). Quita palabras como "Colonia", "Fracc.", etc.
6. "ubicacion": Zona de la ciudad de Chihuahua. Uno de estos valores: "Norte", "Centronorte", "Centro", "Centrosur", "Sur", "Sureste", "Suroeste", "Oriente", "Poniente", "Noroeste", o null si no se puede determinar.
7. "recamaras": Número entero de recámaras/habitaciones (máximo 6), o null.
8. "banos": Número entero o decimal de baños completos (máximo 6), o null.
9. "mediosBanos": Número de medios baños (máximo 6), o null.
10. "estacionamientos": Número de autos en cochera/estacionamiento, o null.
11. "terreno": Metros cuadrados de terreno (número limpio), o null.
12. "construccion": Metros cuadrados de construcción (número limpio), o null.
13. "titulo": Título comercial vendedor formateado como: "[tipoPropiedad] en [tipoOperacion] Col. [colonia], [amenidad o cualidad más atractiva]". Longitud 50 a 70 caracteres. NUNCA menciones nombres de inmobiliarias ni agentes en el título.
14. "descripcion": Redacción completa, vendedora y bien estructurada del inmueble, usando emojis sobrios, párrafos limpios, distribución y amenidades. Longitud recomendada entre 700 y 1,200 caracteres. PROHIBICIÓN ESTRICTA: Queda TERMINANTEMENTE PROHIBIDO mencionar nombres de agencias, inmobiliarias (ej. Match Home, Century 21, Remax, JGCapital, etc.) o nombres de agentes/asesores en la descripción. La redacción debe ser 100% de marca blanca, enfocada exclusivamente en el inmueble y su ubicación, con un llamado a la acción neutro.
15. "amenidades": Array de strings evaluando obligatoriamente el título, descripción y características frente al catálogo de 10 amenidades oficiales. Si alguna está presente o implícita por sinónimos en el texto, INCLÚYELA en el array con su nombre EXACTO de la siguiente lista:
   - "Una planta" (si dice 1 planta, un solo piso, un piso, planta única, etc.)
   - "Recamara en planta baja" (si dice recámara pb, recámara abajo, cuarto en planta baja, etc.)
   - "Frente a parque" (si dice frente a parque, frente al parque, vista al parque, área verde, etc.)
   - "Fraccionamiento privado" (si dice fracc. privado, fracc privado, privada, cerrada, caseta de vigilancia, acceso controlado, seguridad 24/7, coto, etc.)
   - "Nueva" (si dice a estrenar, nueva, nuevo, por estrenar, recién construida, preventa, etc.)
   - "Lista para habitar" (si dice lista para mudarse, llave en mano, equipada y lista, para habitarse, etc.)
   - "Oportunidad" (si dice gran oportunidad, remate, ganga, precio de oportunidad, por debajo de avalúo, etc.)
   - "Alberca" (si dice alberca, piscina, pool, con alberca, etc.)
   - "Sobre Avenida Principal" (si dice sobre avenida, sobre ave, sobre blvd, sobre boulevard, calle principal, etc.)
   - "Patio amplio" (si dice patio grande, amplio patio, mucho patio, gran patio, patio espacioso, etc.)
16. "contactoNombre": Si en el texto se menciona el nombre del asesor, contacto o inmobiliaria que lo compartió (ej. "Lic. Juan Pérez"), string o null (para registro interno del contacto, NO para incluir en la descripción).
17. "contactoTelefono": Si en el texto aparece un teléfono de contacto a 10 dígitos, extráelo limpio (solo dígitos), o null (para registro interno del contacto, NO para la descripción).

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "tipoPropiedad": "Casa",
  "tipoOperacion": "Venta",
  "precio": 1900000,
  "moneda": "MXN",
  "colonia": "Las Granjas",
  "ubicacion": "Norte",
  "recamaras": 3,
  "banos": 2,
  "mediosBanos": 0,
  "estacionamientos": 2,
  "terreno": 121,
  "construccion": 70,
  "titulo": "Casa en Venta Col. Las Granjas, Patio Amplio",
  "descripcion": "Descripción atractiva...",
  "amenidades": ["Fraccionamiento privado", "Patio amplio"],
  "contactoNombre": null,
  "contactoTelefono": null
}
`;

    let rawJson = '';

    // 1. Intentar con Gemini
    if (geminiKey) {
      const geminiModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.6-flash'];
      for (const model of geminiModels) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2000,
                responseMimeType: 'application/json'
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawJson) break;
          }
        } catch (err) {
          // continuar con siguiente modelo
        }
      }
    }

    // 2. Fallback OpenAI
    if (!rawJson && openAiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Eres un extractor experto de datos de fichas inmobiliarias en México. Respondes únicamente en formato JSON con marca blanca total, sin mencionar agencias ni agentes en la descripción ni en el título.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          })
        });

        if (res.ok) {
          const data = await res.json();
          rawJson = data.choices?.[0]?.message?.content || '';
        }
      } catch (err) {
        // continuar
      }
    }

    if (!rawJson) {
      return json({ success: false, error: 'No se pudo procesar el texto con la IA. Verifica la conexión o API Keys.' }, { status: 500 });
    }

    const parsed = JSON.parse(rawJson);
    parsed.amenidades = detectCatalogAmenities(
      `${parsed.titulo || ''} ${parsed.descripcion || ''} ${rawText}`,
      Array.isArray(parsed.amenidades) ? parsed.amenidades : []
    );
    return json({
      success: true,
      data: parsed
    });

  } catch (err: any) {
    console.error('Error en /api/parse-property-text:', err);
    return json({ success: false, error: err.message || 'Error interno al procesar el texto.' }, { status: 500 });
  }
};
