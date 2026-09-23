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
  const mainRes = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!mainRes.ok) throw new Error(`EasyBroker respondió con status ${mainRes.status}`);
  
  const rawCookies = (mainRes.headers as any).getSetCookie ? (mainRes.headers as any).getSetCookie() : [mainRes.headers.get('set-cookie')];
  const cookieHeader = (rawCookies || []).map((c: any) => (c ? String(c).split(';')[0] : '')).filter(Boolean).join('; ');
  const html = await mainRes.text();

  // 1. Extraer JSON de tracking de EasyBroker
  let trackData: any = {};
  const trackMatch = html.match(/data-track-custom-properties="([^"]+)"/);
  if (trackMatch) {
    try {
      trackData = JSON.parse(trackMatch[1].replace(/&quot;/g, '"'));
    } catch (e) {}
  }

  // 2. Extraer Título
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  
  let title = '';
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = ogTitleMatch[1];
  } else if (h1Match && h1Match[1]) {
    title = h1Match[1].replace(/<[^>]+>/g, '').trim();
  } else if (titleTagMatch && titleTagMatch[1]) {
    title = titleTagMatch[1];
  }
  title = title.replace(/\s*\|\s*EasyBroker.*$/i, '').trim();

  // 3. Extraer Descripción completa
  let description = '';
  const descMatch = html.match(/<p class="text-description">\s*([\s\S]*?)\s*<\/p>/);
  if (descMatch) {
    description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } else {
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                   html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDesc) description = ogDesc[1].trim();
  }

  // 4. Extraer Terreno
  let terreno: number | null = null;
  const terrenoMatch = html.match(/([\d,.]+)\s*m²\s*de\s*terreno/i);
  if (terrenoMatch) {
    terreno = Number(terrenoMatch[1].replace(/,/g, ''));
  }

  // 5. Extraer Construcción
  let construccion: number | null = null;
  const constMatch = html.match(/([\d,.]+)\s*m²\s*de\s*construcci[oó]n/i);
  if (constMatch) {
    construccion = Number(constMatch[1].replace(/,/g, ''));
  }
  if (!construccion && trackData['Area M2'] && Number(trackData['Area M2']) > 1) {
    construccion = Number(trackData['Area M2']);
  }

  // 6. Extraer Características / Amenidades explícitas del HTML
  const caracteristicasHtml: string[] = [];
  const amenitiesListMatches = [...html.matchAll(/<ul class="amenities-list">([\s\S]*?)<\/ul>/gi)];
  for (const aList of amenitiesListMatches) {
    const items = [...aList[1].matchAll(/<span>([^<]+)<\/span>/gi)];
    for (const it of items) {
      const txt = it[1].trim();
      if (txt) caracteristicasHtml.push(txt);
    }
  }

  // 7. Extraer Todas las Fotos (Iniciales + Paginadas Turbo Stream)
  const baseImgMatches = [...html.matchAll(/(https:\/\/assets\.easybroker\.com\/property_images\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]+)?)/gi)];
  const photoUrlMap = new Map<string, string>();

  for (const m of baseImgMatches) {
    const cleanUrl = m[1].replace(/&amp;/g, '&');
    const baseKeyMatch = cleanUrl.match(/https:\/\/assets\.easybroker\.com\/property_images\/\d+\/\d+\/[^\?]+/i);
    const key = baseKeyMatch ? baseKeyMatch[0] : cleanUrl;
    if (!photoUrlMap.has(key)) {
      photoUrlMap.set(key, cleanUrl);
    }
  }

  const viewTokenMatch = html.match(/data-view-token="([^"]+)"/);
  const viewToken = viewTokenMatch ? viewTokenMatch[1] : '';
  const mediaUrlMatch = html.match(/data-property-media-url-value="([^"]+)"/);
  const mediaPath = mediaUrlMatch ? mediaUrlMatch[1] : '';
  const totalImagesCount = Number(trackData['Images Count']) || 0;

  if (mediaPath && viewToken && totalImagesCount > photoUrlMap.size) {
    const startIndex = photoUrlMap.size;
    const fetchPromises: Promise<void>[] = [];
    const pathParts = mediaPath.split('?');
    const basePath = pathParts[0];
    const queryPart = pathParts[1] ? `&${pathParts[1]}` : '';

    for (let i = startIndex; i < totalImagesCount; i++) {
      fetchPromises.push((async (idx: number) => {
        try {
          const turboUrl = `https://www.easybroker.com${basePath}/${idx}?view_token=${viewToken}${queryPart}`;

          const turboRes = await fetch(turboUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/vnd.turbo-stream.html, text/html, application/xhtml+xml',
              'Cookie': cookieHeader,
              'Referer': url
            }
          });
          if (turboRes.ok) {
            const turboText = await turboRes.text();
            const imgs = [...turboText.matchAll(/(https:\/\/assets\.easybroker\.com\/property_images\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]+)?)/gi)];
            for (const img of imgs) {
              const cleanUrl = img[1].replace(/&amp;/g, '&');
              const baseKeyMatch = cleanUrl.match(/https:\/\/assets\.easybroker\.com\/property_images\/\d+\/\d+\/[^\?]+/i);
              const key = baseKeyMatch ? baseKeyMatch[0] : cleanUrl;
              if (!photoUrlMap.has(key)) {
                photoUrlMap.set(key, cleanUrl);
              }
            }
          }
        } catch (e) {
          // Ignorar fallo en imagen individual
        }
      })(i));
    }

    await Promise.all(fetchPromises);
  }

  const allPhotos = [...photoUrlMap.values()];

  // 8. Normalizar Tipo de Propiedad
  const rawType = (trackData['Property Type'] || '').toLowerCase();
  const fullTextForType = `${title} ${description}`.toLowerCase();
  
  let tipoPropiedad = 'Casa';
  if (fullTextForType.includes('hotel') || fullTextForType.includes('hotel boutique')) tipoPropiedad = 'Local Comercial';
  else if (rawType.includes('apartment') || rawType.includes('depto') || rawType.includes('departamento') || fullTextForType.includes('departamento')) tipoPropiedad = 'Departamento';
  else if (rawType.includes('land') || rawType.includes('terreno') || rawType.includes('lote') || fullTextForType.includes('terreno')) tipoPropiedad = 'Terreno';
  else if (rawType.includes('commercial') || rawType.includes('local') || fullTextForType.includes('local comercial')) tipoPropiedad = 'Local Comercial';
  else if (rawType.includes('office') || rawType.includes('oficina') || fullTextForType.includes('oficina')) tipoPropiedad = 'Oficina';
  else if (rawType.includes('warehouse') || rawType.includes('bodega') || rawType.includes('nave') || fullTextForType.includes('bodega')) tipoPropiedad = 'Bodega';
  else if (rawType.includes('building') || rawType.includes('edificio') || fullTextForType.includes('edificio')) tipoPropiedad = 'Edificio';
  else if (rawType.includes('rancho') || fullTextForType.includes('rancho')) tipoPropiedad = 'Rancho';
  else if (fullTextForType.includes('casa de campo') || fullTextForType.includes('quinta') || fullTextForType.includes('granja')) tipoPropiedad = 'Casa de Campo';
  else if (fullTextForType.includes('huerta')) tipoPropiedad = 'Huerta';

  // 9. Extraer Anunciante y Teléfonos
  let anuncianteNombre: string | null = null;
  let anuncianteInmobiliaria: string | null = null;
  let contactoTelefono: string | null = null;

  const agentMatch = html.match(/Anunciado por\s+([^<]+)/i) || html.match(/class="author-name">([^<]+)<\/div>/i);
  if (agentMatch) anuncianteNombre = agentMatch[1].trim();

  const orgMatch = html.match(/class="organization"><div>([^<]+)<\/div>/i) || html.match(/class="org-name">([^<]+)<\/div>/i);
  if (orgMatch) anuncianteInmobiliaria = orgMatch[1].trim();

  const phoneMatch = description.match(/(?:tel(?:[eé]fonos?)?|whatsapp|cel(?:ular)?|m[oó]vil|citas|informes)?:?\s*(\+?52\s*)?([1-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4})/i) ||
                     html.match(/tel:(\+?[\d\s-]+)/i);
  if (phoneMatch) {
    const rawDigits = (phoneMatch[2] || phoneMatch[1] || phoneMatch[0]).replace(/\D/g, '');
    if (rawDigits.length >= 10) contactoTelefono = rawDigits.slice(-10);
  }

  // 10. Ubicación detallada y Código Postal
  let ubicacionFull = trackData['Property City'] || trackData['Property State'] || '';
  const addrMatch = html.match(/<meta[^>]+content="([^"]+)"[^>]+itemprop="address"/i) ||
                    html.match(/itemprop="address"[^>]*content="([^"]+)"/i) ||
                    description.match(/Direcci[oó]n:\s*([^📍\n]+)/i);
  if (addrMatch) {
    ubicacionFull = addrMatch[1].trim();
  }

  let codigoPostal: string | null = null;
  const cpMatch = description.match(/\b(22\d{3}|31\d{3}|\d{5})\b/) ||
                  html.match(/(?:c[oó]digo\s*postal|c\.?p\.?)\s*:?\s*(\d{5})/i) ||
                  html.match(/\bpostal[^\d]*(\d{5})/i);
  if (cpMatch) {
    codigoPostal = cpMatch[1];
  } else if (trackData['Property Postal Code'] || trackData['Postal Code']) {
    codigoPostal = String(trackData['Property Postal Code'] || trackData['Postal Code']).trim();
  }

  // 11. Año de construcción / Antigüedad
  let anioConstruccion: number | null = null;
  const yearMatch = description.match(/(?:a[ñn]o(?:\s*de\s*construcci[oó]n)?|construida\s*en)\s*:?\s*(\d{4})/i) ||
                    html.match(/(\d{4})\s*de\s*construcci[oó]n/i);
  if (yearMatch) {
    anioConstruccion = Number(yearMatch[1]);
  } else {
    const ageMatch = description.match(/(\d+)\s*a[ñn]os?\s*(?:de\s*antig[üu]edad|de\s*edad)/i) ||
                     html.match(/(\d+)\s*a[ñn]os?\s*de\s*antig[üu]edad/i);
    if (ageMatch) {
      anioConstruccion = new Date().getFullYear() - Number(ageMatch[1]);
    }
  }

  const combinedAmenityText = `${title} ${description} ${caracteristicasHtml.join(' ')}`;

  return {
    tipoPropiedad,
    tipoOperacion: trackData['Operation Type'] === 'Rental' ? 'Renta' : 'Venta',
    precio: trackData['Sale Price'] ? Number(trackData['Sale Price']) : (trackData['Rental Price'] ? Number(trackData['Rental Price']) : null),
    moneda: trackData['Currency'] || 'MXN',
    colonia: trackData['Property Neighborhood'] || '',
    ubicacion: ubicacionFull,
    codigoPostal,
    anioConstruccion,
    recamaras: trackData['Bedrooms'] ? Number(trackData['Bedrooms']) : null,
    banos: trackData['Bathrooms'] ? Number(trackData['Bathrooms']) : null,
    mediosBanos: null,
    estacionamientos: trackData['Parking Spaces'] ? Number(trackData['Parking Spaces']) : null,
    terreno,
    construccion,
    titulo: title,
    descripcion: description,
    amenidades: detectCatalogAmenities(combinedAmenityText),
    caracteristicas: caracteristicasHtml,
    fotos: allPhotos,
    easybrokerId: trackData['Property ID'] || null,
    contactoNombre: anuncianteNombre,
    companiaCaptadora: anuncianteInmobiliaria,
    contactoTelefono
  };
}

function extractImagesFromGenericHtml(html: string, baseUrl: string): string[] {
  const images = new Set<string>();

  // 1. JSON-LD images
  const ldMatches = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const ld of ldMatches) {
    try {
      const data = JSON.parse(ld[1].trim());
      const findImgs = (obj: any) => {
        if (!obj) return;
        if (typeof obj === 'string' && obj.match(/^https?:\/\/.*\.(?:jpe?g|png|webp|avif)/i)) {
          images.add(obj);
        } else if (Array.isArray(obj)) {
          obj.forEach(findImgs);
        } else if (typeof obj === 'object') {
          if (obj.image) findImgs(obj.image);
          if (obj.photos) findImgs(obj.photos);
          if (obj.contentUrl) findImgs(obj.contentUrl);
        }
      };
      findImgs(data);
    } catch (e) {}
  }

  // 2. OpenGraph & Twitter image
  const ogImgMatches = [
    ...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi),
    ...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi)
  ];
  for (const m of ogImgMatches) {
    if (m[1] && m[1].startsWith('http')) images.add(m[1]);
  }

  // 3. Img tags and data attributes
  const imgTags = [...html.matchAll(/<img\s+[^>]*>/gi)];
  for (const tag of imgTags) {
    const srcMatch = tag[0].match(/(?:src|data-src|data-original|data-lazy|data-zoom-image|data-full)=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      let src = srcMatch[1];
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/') && baseUrl) {
        try {
          src = new URL(src, baseUrl).toString();
        } catch (e) {}
      }

      const isBad = src.includes('avatar') || src.includes('logo') || src.includes('icon') || 
                    src.includes('.svg') || src.includes('tracker') || src.includes('pixel') ||
                    src.includes('badge') || src.includes('1x1') || src.includes('button');
      if (!isBad && src.match(/^https?:\/\/.*\.(?:jpe?g|png|webp|avif)/i)) {
        images.add(src.replace(/&amp;/g, '&'));
      }
    }
  }

  // 4. Regex for direct image URLs from CDNs
  const cdnMatches = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>]+)?/gi)];
  for (const m of cdnMatches) {
    const u = m[0].replace(/&amp;/g, '&');
    const isBad = u.includes('avatar') || u.includes('logo') || u.includes('icon') || 
                  u.includes('tracker') || u.includes('pixel') || u.includes('badge');
    if (!isBad && (u.includes('property') || u.includes('inmueble') || u.includes('fotos') || u.includes('photos') || u.includes('uploads') || u.includes('cdn') || u.includes('cloudfront') || u.includes('s3') || u.includes('cloudinary') || u.includes('tokko') || u.includes('wiggot'))) {
      images.add(u);
    }
  }

  return [...images];
}

async function scrapeGenericUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`El sitio web respondió con error HTTP ${res.status}`);
  const html = await res.text();

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
  const title = ogTitleMatch ? ogTitleMatch[1].trim() : '';

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : '';

  const cleanBody = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const photos = extractImagesFromGenericHtml(html, url);

  return {
    title,
    ogDesc,
    bodyText: cleanBody.substring(0, 4000),
    photos
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { rawText = '' } = body;

    if (!rawText || !rawText.trim()) {
      return json({ success: false, error: 'Por favor pega el texto o enlace de la propiedad.' }, { status: 400 });
    }

    // 1. Detección automática de enlaces de EasyBroker (dominio principal, subdominios o micrositios)
    const ebUrlMatch = rawText.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?easybroker\.com\/[^\s"'>]+/i) ||
                       rawText.match(/https?:\/\/(?:www\.)?pincali\.com\/[^\s"'>]+/i);
    if (ebUrlMatch) {
      try {
        const scraped = await scrapeEasyBrokerListing(ebUrlMatch[0]);
        return json({
          success: true,
          data: scraped,
          source: 'easybroker_link'
        });
      } catch (scrapeErr: any) {
        console.warn('Fallo al scrapear enlace directo de EasyBroker, intentando fallback:', scrapeErr.message);
      }
    }

    // 2. Detección de cualquier otro enlace web (portales inmobiliarios genéricos, Tokko, Lamudi, etc.)
    let genericScrapedPhotos: string[] = [];
    let textToAnalyze = rawText;

    const genericUrlMatch = rawText.match(/https?:\/\/[^\s"'>]+/i);
    if (genericUrlMatch) {
      try {
        const genericData = await scrapeGenericUrl(genericUrlMatch[0]);
        genericScrapedPhotos = genericData.photos || [];
        textToAnalyze = `TÍTULO ENLACE: ${genericData.title}\nDESCRIPCIÓN META: ${genericData.ogDesc}\nCONTENIDO DEL SITIO:\n${genericData.bodyText}\n\nTEXTO ORIGINAL COPIADO:\n${rawText}`;
      } catch (genErr: any) {
        console.warn('Fallo al pre-scrapear enlace genérico:', genErr.message);
      }
    }

    const geminiKey = getSecret('GEMINI_API_KEY');
    const openAiKey = getSecret('OPENAI_API_KEY');

    const prompt = `
Eres un extractor de datos inmobiliarios de alta precisión para ATAIR SGI en Chihuahua, México.
Analiza el siguiente texto crudo (copiado de un grupo de WhatsApp, mensaje o publicación inmobiliaria) y extrae de forma estructurada los datos de la propiedad:

TEXTO COPIADO:
"""
${textToAnalyze}
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
5. "colonia": Nombre limpio de la colonia o fraccionamiento (ej. "Las Granjas", "San Felipe", "Lomas del Santuario", "Cumbres", "Ensenada Centro"). Quita palabras como "Colonia", "Fracc.", etc.
6. "ubicacion": Ubicación o zona geográfica descriptiva.
7. "recamaras": Número entero de recámaras/habitaciones (máximo 12), o null.
8. "banos": Número entero o decimal de baños completos (máximo 12), o null.
9. "mediosBanos": Número de medios baños, o null.
10. "estacionamientos": Número de autos en cochera/estacionamiento, o null.
11. "terreno": Metros cuadrados de terreno (número limpio), o null.
12. "construccion": Metros cuadrados de construcción (número limpio), o null.
13. "titulo": Título comercial vendedor formateado como: "[tipoPropiedad] en [tipoOperacion] Col. [colonia], [amenidad o cualidad más atractiva]". Longitud 50 a 70 caracteres. NUNCA menciones nombres de inmobiliarias ni agentes en el título.
14. "descripcion": Redacción completa, vendedora y bien estructurada del inmueble, usando emojis sobrios, párrafos limpios, distribución y amenidades. Longitud recomendada entre 700 y 1,200 caracteres. PROHIBICIÓN ESTRICTA: Queda TERMINANTEMENTE PROHIBIDO mencionar nombres de agencias, inmobiliarias (ej. Match Home, Century 21, Remax, JGCapital, etc.) o nombres de agentes/asesores en la descripción. La redacción debe ser 100% de marca blanca, enfocada exclusivamente en el inmueble y su ubicación, con un llamado a la acción neutro.
15. "amenidades": Array de strings evaluando obligatoriamente el título, descripción y características frente al catálogo de 10 amenidades oficiales. Si alguna está presente o implícita por sinónimos en el texto, INCLÚYELA en el array con su nombre EXACTO de la siguiente lista:
   - "Una planta"
   - "Recamara en planta baja"
   - "Frente a parque"
   - "Fraccionamiento privado"
   - "Nueva"
   - "Lista para habitar"
   - "Oportunidad"
   - "Alberca"
   - "Sobre Avenida Principal"
   - "Patio amplio"
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
      const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
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
      `${parsed.titulo || ''} ${parsed.descripcion || ''} ${textToAnalyze}`,
      Array.isArray(parsed.amenidades) ? parsed.amenidades : []
    );

    if (genericScrapedPhotos.length > 0 && (!parsed.fotos || parsed.fotos.length === 0)) {
      parsed.fotos = genericScrapedPhotos;
    }

    return json({
      success: true,
      data: parsed
    });

  } catch (err: any) {
    console.error('Error en /api/parse-property-text:', err);
    return json({ success: false, error: err.message || 'Error interno al procesar el texto.' }, { status: 500 });
  }
};
