import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';

function getSecret(keyName: string): string {
  if (env && env[keyName]) return env[keyName];
  if (process.env && process.env[keyName]) return process.env[keyName];
  
  // Fallback a lectura directa de archivo .env en disco
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
        const match = content.match(new RegExp(`^${keyName}=["']?(.*?)["']?$`, 'm'));
        if (match && match[1] && match[1].trim()) {
          return match[1].trim();
        }
      }
    }
  } catch (e) {
    console.error(`Error leyendo variable ${keyName} desde disco:`, e);
  }
  return '';
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      tipoPropiedad = 'Casa',
      tipoOperacion = 'Venta',
      precio = '',
      moneda = 'MXN',
      colonia = '',
      ubicacion = '',
      recamaras = '',
      banos = '',
      mediosBanos = '',
      estacionamientos = '',
      terreno = '',
      construccion = '',
      condicion = '',
      amenidades = [],
      descripcionPrevia = '',
      companiaCaptadora = ''
    } = body;

    const geminiKey = getSecret('GEMINI_API_KEY');
    const openAiKey = getSecret('OPENAI_API_KEY');

    if (!geminiKey && !openAiKey) {
      return json({
        success: false,
        error: 'Para generar con IA, configura OPENAI_API_KEY o GEMINI_API_KEY en el archivo .env de ATAIR.'
      }, { status: 400 });
    }

    const amenidadesList = Array.isArray(amenidades) ? amenidades.join(', ') : '';

    // Detalle del contexto del inmueble
    const propertyDetails = [
      `Tipo de inmueble: ${tipoPropiedad}`,
      `Operación: ${tipoOperacion}`,
      precio ? `Precio: $${Number(precio).toLocaleString('es-MX')} ${moneda}` : null,
      colonia ? `Colonia: ${colonia}` : null,
      ubicacion ? `Zona geográfica: ${ubicacion}` : null,
      'Ciudad: Chihuahua, Chihuahua, México',
      recamaras ? `Recámaras: ${recamaras}` : null,
      banos ? `Baños completos: ${banos}` : null,
      mediosBanos ? `Medios baños: ${mediosBanos}` : null,
      estacionamientos ? `Cochera / Estacionamiento: ${estacionamientos} autos` : null,
      construccion ? `Construcción: ${construccion} m²` : null,
      terreno ? `Terreno: ${terreno} m²` : null,
      condicion ? `Estado de conservación: ${condicion}` : null,
      amenidadesList ? `Amenidades / Tags seleccionadas: ${amenidadesList}` : null,
      companiaCaptadora ? `Captada por: ${companiaCaptadora}` : null,
      descripcionPrevia ? `Notas o borrador previo ingresado por el asesor:\n"${descripcionPrevia}"` : null
    ].filter(Boolean).join('\n');

    const promptText = `
Eres un redactor inmobiliario profesional de élite especializado en el mercado de bienes raíces de Chihuahua, México.
Genera un TÍTULO COMERCIAL y una DESCRIPCIÓN PROFESIONAL para la siguiente propiedad:

INFORMACIÓN DEL INMUEBLE:
${propertyDetails}

REGLAS PARA EL TÍTULO (OBLIGATORIO):
- Estructura exacta: "[Tipo de propiedad] en [Tipo de operación] en Col. [Colonia], [Mejor cualidad o amenidad destacada]"
- Ejemplo exacto: "Casa en Venta en Col. San Felipe, Frente a Parque"
- Para la mejor cualidad: Elige prioritariamente la amenidad/tag más vendedora de las seleccionadas (${amenidadesList || 'o un atributo destacado'}). Ejemplos: "Frente a Parque", "con Alberca", "en Fraccionamiento Privado", "de Una Planta", "con Recámara en Planta Baja", "con Patio Amplio", "Nueva", "Lista para Habitar".
- Longitud máxima del título: entre 50 y 70 caracteres.

REGLAS PARA LA DESCRIPCIÓN:
1. INVESTIGACIÓN DE LA ZONA / COLONIA:
   - Ten en cuenta las ventajas de la colonia "${colonia || 'la zona'}" en Chihuahua (conectividad vial, avenidas rápidas, centros comerciales como Fashion Mall / Paseo Central / Distrito 1, colegios, hospitales, tranquilidad o plusvalía).
2. ESTRUCTURA:
   - Gancho inicial emocionante.
   - Distribución de espacios interiores y exteriores.
   - Equipamiento y amenidades destacadas.
   - Ventajas del entorno y conectividad de la colonia.
   - Llamado a la acción (CTA) para coordinar cita.
3. CONSERVA NOTAS PREVIAS:
   - Incluye cualquier detalle o especificación dada en el borrador previo del asesor.
4. FORMATO Y LÍMITE DE CARACTERES (OBLIGATORIO):
   - Tono sofisticado, profesional y vendedor.
   - Usa saltos de línea y viñetas para lectura ágil.
   - LÍMITE ESTRICTO: La descripción DEBE tener entre 1,100 y 1,350 caracteres en total (incluyendo espacios). NUNCA debes superar los 1,400 caracteres para asegurar que quepa holgadamente en el límite de los portales inmobiliarios y no sufra recortes.

FORMATO DE SALIDA (MUY IMPORTANTE):
Debes responder ÚNICAMENTE con un objeto JSON válido con esta estructura:
{
  "title": "[Título generado según las reglas]",
  "description": "[Descripción completa generada]"
}
`;

    let rawResponse = '';
    let geminiError = '';

    // 1. Intentar con Gemini si hay GEMINI_API_KEY
    if (geminiKey) {
      const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const model of geminiModels) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1500
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawResponse) break;
          } else {
            const errText = await response.text();
            geminiError = `Gemini (${model}) error: ${errText}`;
          }
        } catch (e: any) {
          geminiError = `Gemini fetch error: ${e.message}`;
        }
      }
    }

    // 2. Si no hay respuesta de Gemini o no hay key, intentar con OpenAI
    if (!rawResponse && openAiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'Eres un redactor inmobiliario profesional de élite en Chihuahua, México. Respondes exclusivamente en JSON con { title, description }.'
              },
              {
                role: 'user',
                content: promptText
              }
            ],
            temperature: 0.7,
            max_tokens: 1200
          })
        });

        if (response.ok) {
          const data = await response.json();
          rawResponse = data.choices?.[0]?.message?.content || '';
        } else {
          const errData = await response.text();
          throw new Error(`Error en API de OpenAI: ${errData}`);
        }
      } catch (err: any) {
        if (!rawResponse && geminiError) {
          throw new Error(`Fallo en Gemini (${geminiError}) y en OpenAI (${err.message})`);
        }
        throw err;
      }
    }

    if (!rawResponse) {
      if (geminiError) {
        throw new Error(`No se pudo generar contenido con IA: ${geminiError}`);
      }
      throw new Error('La IA no devolvió contenido.');
    }

    // Parse JSON from response
    let title = '';
    let description = '';

    try {
      const cleanJson = rawResponse.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      title = parsed.title || '';
      description = parsed.description || '';
    } catch {
      const bestAmenity = Array.isArray(amenidades) && amenidades.length > 0 ? amenidades[0] : '';
      const colText = colonia ? `en Col. ${colonia}` : '';
      const qualityText = bestAmenity ? `, ${bestAmenity}` : '';
      title = `${tipoPropiedad} en ${tipoOperacion} ${colText}${qualityText}`.trim().replace(/\s+,/g, ',');
      description = rawResponse.trim();
    }

    // Garantizar que nunca exceda el límite de caracteres
    if (description.length > 1450) {
      const truncated = description.slice(0, 1400);
      const lastPeriod = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('.\n'), truncated.lastIndexOf('\n\n'));
      if (lastPeriod > 950) {
        description = truncated.slice(0, lastPeriod + 1).trim();
      } else {
        description = truncated.trim();
      }
    }

    return json({
      success: true,
      title: title.trim(),
      description: description.trim()
    });

  } catch (err: any) {
    console.error('Error generando título y descripción:', err);
    return json({
      success: false,
      error: err.message || 'Error interno al generar contenido con IA.'
    }, { status: 500 });
  }
};
