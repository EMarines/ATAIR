# 🧭 Investigación Forense Macro (COMPASS Paso 3) — ATAIR Copiloto

**Proyecto:** `COMPASS-ATAIR-COPILOTO` — **ATAIR Copiloto**  
**Fecha:** 2026-11-16  
**Gobernanza:** Maya (Orquestadora), Mina (Memoria Viva), Apolo (Arquitectura), Argos (I+D), Lince (Seguridad & Código), Wero (Bucles & Circuit Breaker), Beto (Trinchera Comercial), Clara & Nexo (UX/Copy)  
**Principio Rector:** *Cero desarrollo a ciegas. Arquitectura híbrida determinística + IA con 95%+ de certidumbre verificada en código real y benchmarking vigente.*

---

## Fase 1: Mapeo Exhaustivo de Palancas del Dominio

Se deconstruyó el sistema **ATAIR Copiloto** en 7 palancas configurables críticas:

1. **Disparador y Alcance (Trigger & Idempotencia):**
   - Botón en la cabecera de `/agenda` (`src/routes/agenda/+page.svelte`) para iniciar el análisis diario de cartera.
   - Idempotencia por día civil (`runDate` + `contactId`) para evitar duplicar tarjetas si el usuario presiona el botón más de una vez en el mismo día.
2. **Modelo de Ejecución (2-Tier Control + Reasoning):**
   - **Tier 1 (Reglas Determinísticas):** Filtrado por etapa (`E1`, `E2`, `E3`, `E4`), cadencia diaria (`E1`, `E2`, `E4` todos los días), cuota diaria configurable de `E3` (`default = 15`), ordenamiento temporal de `E3` (`< 2 años` reciente→antiguo primero; `> 2 años` solo al agotar `< 2 años`), cruce inverso de sinergias para `E4` y deduplicación contra `sendedProperties`.
   - **Tier 2 (Razonamiento IA):** Lectura contextual de entradas recientes de `binnacles` y ficha del contacto para sintetizar `Acción + Objetivo + Porqué + Borrador WhatsApp` y detectar sugerencias de transición de etapa (ej. caída `E1/E2 → E3` por falta de respuesta).
3. **Límites Serverless, Latencia y Costo:**
   - Prevención de `504 Gateway Timeout` (límite de proxy HTTP de 120s en Vercel y timeout de funciones serverless): separación entre endpoint rápido de planificación (`/api/copiloto/plan-candidates`) y procesamiento incremental en micro-lotes desde el cliente hacia `/api/copiloto/analyze-batch`.
4. **Persistencia y Separación de Google Tasks:**
   - Almacenamiento en colección `todos` de Firestore con `source: 'atair_copiloto'` y bloque estructurado `copilotoMeta`, **sin** enviarse a `syncTaskWithGoogle('CREATE')` para no saturar Google Tasks personal con decenas de tarjetas operativas diarias.
5. **UX de Tarjetas en Agenda (Altura Uniforme + Expansión):**
   - Lista en `/agenda` con altura fija/uniforme por fila/tarjeta para no deformar el tablero.
   - Al hacer clic sobre una tarjeta para atacarla, se expande revelando: **Acción**, **Objetivo**, **Porqué**, borrador de WhatsApp con links (`getProposalUrl`) y **botón directo de ejecución en 1 clic** (`wa.me` o registro de llamada).
6. **Sincronización Móvil Omnicanal (GOWA / n8n #037):**
   - Captura de mensajes salientes enviados desde el celular (`is_from_me: true` en workflow n8n `GfiTqq8lh9an9cIX`) hacia `binnacles` y actualización de `sendedProperties` si incluye link de propiedad.
   - Propuesta automática de cierre (`copilotoMeta.proposedClose = true`) en la tarjeta abierta de Agenda cuando se detecta respuesta desde móvil, requiriendo confirmación en 1 clic del asesor.
   - Fase aparte: importación única, lenta y solo lectura de respuestas históricas en los 1,309 chats guardados en GOWA (individuales 1:1 anteriores al 14-nov-2026).
7. **Embudo E3 y Página Pública Ligera (`/buscar`):**
   - Ruta pública en ATAIR (`PUBLIC_ROUTES` en `src/lib/config/routes.ts`) para que prospectos en `E3` capturen lo que buscan; al enviarse vía API validada, actualiza la ficha en Firestore y los promueve automáticamente a `E4`.

---

## Fase 2: Benchmarking Forense Activo & Auditoría Real de ATAIR

### A. Hallazgos de Benchmarking Global (2025–2026)
1. **Patrón Top 1% CRM Inmobiliario ("Blueprint First, Model Second" — Follow Up Boss / HubSpot Breeze):**
   - Las plataformas líderes evitan darle acceso libre al LLM sobre toda la base de datos. Separar el **Control Plane Determinístico** (filtros de etapa, SLA de contacto, deduplicación, cuotas) del **Probabilistic Reasoning Plane** (resumen de bitácora, sentimiento, redacción de borrador) elimina alucinaciones, reduce costos de tokens >80% y garantiza cumplimiento estricto de reglas comerciales.
2. **Gemini Structured Output (`responseSchema` + `responseMimeType: "application/json"`):**
   - La API de Gemini (`v1beta` y `@google/genai`) soporta esquemas JSON estrictos con descripciones por campo y orden lógico de propiedades. Usar `responseSchema` junto con `thinkingBudget: 0` en modelos Flash/Flash-Lite garantiza respuestas tipadas estables sin parsers frágiles.
3. **Vercel Serverless & Batching con Cursores (2025–2026):**
   - Aunque Fluid Compute en Vercel permite `maxDuration` extendido, el proxy HTTP corta respuestas síncronas largas (120s de gateway timeout; además en ATAIR ya ocurrió `504` documentado en bitácora `#066`). La arquitectura resiliente recomendada es **planificación determinística + micro-lotes dirigidos desde el cliente**, actualizando la UI progresivamente.

### B. Auditoría Forense del Código Actual de ATAIR
| Archivo / Módulo | Estado Verificado en Sesión | Impacto en ATAIR Copiloto |
| :--- | :--- | :--- |
| `src/routes/agenda/+page.svelte` | Tabla de tareas sobre colección `todos`; `handleAddTodo` dispara `syncTaskWithGoogle('CREATE')`. | Debe aislarse `source: 'atair_copiloto'` para no contaminar Google Tasks y añadir vista/fila de altura uniforme expandible al clic. |
| `src/routes/actions/cont-filter/+page.svelte` | Líneas 328-330 verifican `contact.tags` pero filtran con `contact.tagsProperty` (bug activo `#036`); recámaras usa `<=`. | Extraer motor puro `$lib/functions/propertyMatching.ts`, corregir el bug y soportarlo en sentido inverso (Lead E4 → máx 3 propiedades no enviadas). |
| `src/lib/functions/contactBadge.ts` & `contactAudit.ts` | Ya existen `getContactBadgeInfo`, `normalizeStage`, `getContactCreatedAtMs`, `isWithinMaxAgeYears`, `isStage4Base`. | Reutilizar al 100% para clasificar `E1`–`E4` y ordenar `E3` (`≤ 2 años` vs `> 2 años`) sin duplicar lógica. |
| `src/lib/functions/binnSaver.ts` & `urlUtils.ts` | `infoToBinnacle` registra en `binnacles` y actualiza `sendedProperties`; `getProposalUrl` arma link seguro `?c={contactId}`. | Reutilización directa para adjuntar links en borradores y registrar ejecuciones. |
| `src/routes/+layout.svelte` | `onSnapshot(collection(getDb(), 'binnacles'))` descarga toda la colección sin `limit()`. | Riesgo de lectura masiva/latencia al crecer la bitácora; documentado como punto de control en `TASK-011` (y alineado con optimización pendiente). |
| `src/routes/api/generate-description/+server.ts` | Usa Gemini REST `v1beta` con `AbortSignal.timeout(8000)`, pero incluye llaves base64 de fallback en código fuente. | **Hallazgo Lince:** En Copiloto usar exclusivamente `env` server-side sin secretos embebidos en el repo. |
| `src/lib/config/routes.ts` & `firestore.rules` | `PUBLIC_ROUTES = ['/login']`; colecciones `contacts`, `todos`, `binnacles` permiten `read, write: if true`. | Agregar `/buscar` a `PUBLIC_ROUTES` y validar envíos por endpoint server-side (`/api/copiloto/e3-submit`). |
| `vercel.json` | CSP restringe `script-src` (no permite `cdn.tailwindcss.com` externo). | Tablero COMPASS y UI de ATAIR deben usar CSS propio o assets locales compatibles con la CSP. |
| n8n `GfiTqq8lh9an9cIX` | Webhook GOWA activo (`logged_in` para `614 540 4003`); actualmente descarta `p.is_from_me === true`. | Extender nodo extractor para capturar mensajes salientes del teléfono hacia contactos existentes (`#037`). |

---

## Fase 3: Filtro de Trinchera y Pragmatismo (Validación Beto)

- **Cero spam de WABA:** Los envíos disparados desde la tarjeta del Copiloto abren WhatsApp directo (`wa.me` con borrador + link público `getProposalUrl`), sin consumir plantillas pagadas de Meta ni exponer la línea principal a bloqueos.
- **Agenda usable en campo:** Límite inicial de **15 leads/día en E3** (ajustable), **máximo 3 propiedades por envío en E4**, y altura fija en la lista de Agenda para escanear en 3 segundos quién toca hoy.
- **Regla comercial innegociable:** *"Trabajar solo con los clientes interesados."* Quien no responde tras 2 llamadas + 2 o 3 envíos de propiedades cae a `E3`; quien en `E3` no llena el formulario pasa a `inactivo`.

---

## Fase 4: Matriz de Decisiones y Trade-offs

| Decisión | Opción A | Opción B | Elección & Justificación |
| :--- | :--- | :--- | :--- |
| **Orquestación del Análisis IA** | Monolito en 1 solo POST serverless o n8n pesado | **Planificador determinístico rápido + Micro-lotes (3–5 leads) desde `/agenda`** | **Opción B:** Cero riesgo de `504 Gateway Timeout` en Vercel, barra de progreso en vivo, tolerante a fallos parciales. |
| **Persistencia de Tarjetas** | Colección nueva `copiloto_cards` | **Colección `todos` con `source: 'atair_copiloto'` y `copilotoMeta`** | **Opción B:** Convive nativamente en `/agenda`, filtra por origen y evita duplicar listeners; excluido de `Google Tasks` sync. |
| **Motor de Cruce E4** | Copiar código de `cont-filter/+page.svelte` | **Módulo compartido `$lib/functions/propertyMatching.ts`** | **Opción B:** Corrige el bug `contact.tags` vs `contact.tagsProperty` (`#036`) de raíz y sirve a ambos flujos sin duplicación. |
| **Formulario Ligero E3** | Escritura directa a Firestore desde el navegador | **Ruta pública `/buscar` → `POST /api/copiloto/e3-submit`** | **Opción B:** Validación de entrada, verificación de existencia de `contactId`, promoción atómica a `E4` y registro en `binnacles`. |

---

## Fase 5: Circuit Breaker de Wero (Auditoría de Omisiones)

> **Pregunta crítica:** *"¿Existe alguna configuración, palanca o mejor práctica que un senior configuraría y que nosotros hayamos omitido?"*

Sí se detectaron 5 omisiones potenciales y **todas quedan blindadas en el WBS antes de codificar**:
1. **Idempotencia diaria:** Evitar tarjetas duplicadas si el botón se presiona dos veces el mismo día (llave lógica `contactId + runDate` + validación de tarjetas abiertas).
2. **Aislamiento de Google Tasks:** Bloquear explícitamente el disparo de `syncTaskWithGoogle` para `source === 'atair_copiloto'` para no inundar la app Google Tasks personal.
3. **Transición segura a E3 (human-in-the-loop):** Cuando la IA detecte 2 llamadas y 2–3 envíos sin respuesta desde `lastResponse`, propondrá en la tarjeta `suggestedStageChange: 'E3'` para que el asesor confirme al cerrar o con un botón, evitando degradaciones silenciosas erróneas.
4. **Propiedades sin `public_id`:** Si una propiedad de sinergia carece de `public_id`, usar `urlProp` o ficha interna sin fabricar URLs rotas en `getProposalUrl`.
5. **Deduplicación GOWA saliente (`#037`):** Si el asesor envía un mensaje desde el botón de ATAIR (que ya registra en `binnacles`), el webhook de GOWA debe evitar duplicar la nota o saber conciliarla, y solo proponer cierre de tarjeta abierta si existe un `todo` activo de `atair_copiloto` para ese contacto.

**Veredicto Circuit Breaker:** Ninguna omisión bloqueante restante. **Aprobado para Paso 5 (Formalización) y Paso 6 (Ejecución Micro JIT 1 a 1).**
