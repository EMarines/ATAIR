# Criterios Oficiales de Etapas — ATAIR CRM & Copiloto IA

> **Fuente de verdad oficial** para la operación comercial, el motor determinístico ([copilotoPlanner.ts](src/lib/functions/copilotoPlanner.ts)), el análisis con IA ([copilotoAnalyzer.ts](src/lib/functions/copilotoAnalyzer.ts)) y el cruce de inventario ([propertyMatching.ts](src/lib/functions/propertyMatching.ts)).

---

## 1. Catálogo Maestro de Etapas (E1 – E8)

| Etapa | Badge | Nombre | Definición operativa |
| :--- | :---: | :--- | :--- |
| **Etapa 1** | `E1` | **Primer Contacto** | Lead reciente (`≤ 30 días`) por una propiedad específica. Prioridad #1: llamada para empatía e info inicial. |
| **Etapa 2** | `E2` | **Perfilamiento** | Ya contestó E1 y dio más datos. Envío de máx. 3 propiedades y llamada al día siguiente para cerrar perfil. |
| **Etapa 3** | `E3` | **Filtro / Reactivación** | Leads sin respuesta en E1/E2 (`> 30 días` o `≥ 2` llamadas sin respuesta) o cartera fría (`> 180 días` / `> 2 años`). |
| **Etapa 4** | `E4` | **Búsqueda Activa** | Prospecto comprometido y calificado. Recibe todo el inventario compatible sin esperar días extra. |
| **Etapa 5** | `E5` | **Cierre** | En oferta, apartado, avalúo o trámite notarial. Protegido fuera de Copiloto diario y difusiones. |
| **Etapa 6** | `E6` | **Post-Venta** | Operación escriturada/entregada. Protegido para relación y referidos. |
| **Etapa 7** | `PAU` | **En Pausa** | Dijo *"de momento no"*. Excluido de difusiones (`isActive: false`); chequeo cada **3 meses** sin reactivar salvo confirmación. |
| **Etapa 8** | `IN` | **Inactivo** | Ya compró, no le interesa o ignoró el Paso 2 de E3 por 7+ días (`isActive: false`). Excluido definitivamente. |

**Roles externos al embudo comprador:** `OW` (Propietario / Vendedor / Arrendador), `A1 / A2` (Arrendatario), `S1 / S2 / S3 / MH` (Agentes / Sinergias).

---

## 2. Reglas Operativas por Etapa

### 🟥 Etapa 1 · Primer Contacto (`E1`)
- **Alta inicial (`0–10 días`):** Se guarda la propiedad consultada como referencia base (precio, tipo, operación y zona) y Copiloto agenda **llamada para el día siguiente hábil** para validar si le gustó o sacar más datos.
- **Seguimiento (`10–30 días`):**
  - **Paso 1:** Si no ha tenido envío reciente, envía **2–3 opciones similares** (`±25%` de precio).
  - **Paso 2:** Agenda **llamada al día siguiente** para saber qué le parecieron.
- **Regla de intentos en E1:** Máximo **2 llamadas con 1 día de diferencia (48h)** entre intento 1 y 2. **Colgando cada llamada sin respuesta se envía WhatsApp** de respaldo (`✗ No contestó + WA`).
- **Caída a estrategia E3:** Si acumula **≥ 2 llamadas sin respuesta** o supera **30 días** en E1 sin avanzar → aplica estrategia unificada de **E3**.
- **Salida positiva:** Si contesta y da más información → sube a **E2** (o directo a **E4** si ya dio todo su perfil).

### 🟧 Etapa 2 · Perfilamiento (`E2`)
- **Ciclo activo (`≤ 30 días`):**
  - **Paso 1:** Enviar **máx. 3 propiedades** compatibles con lo que pidió hasta ahora.
  - **Paso 2:** Copiloto agenda **llamada al día siguiente** para conocer impresiones y recabar los datos faltantes del listado ideal.
- **Regla de intentos en E2:** Máximo **2 llamadas con 1 día de diferencia (48h)** + **WhatsApp colgando** cada intento sin respuesta.
- **Caída a estrategia E3:** Si acumula **≥ 2 llamadas sin respuesta** o supera **30 días** sin subir a E4 → aplica estrategia unificada de **E3**.
- **Salida positiva:** Al completar sus criterios principales → sube a **E4**.

### 🟨 Etapa 3 · Filtro / Reactivación (`E3`)
Flujo unificado en **2 pasos** para todos los leads en E3 (tanto `30–180 días` como `> 180 días` o `> 2 años`):
1. **Paso 1 (sin link):** Saludar, preguntar si sigue buscando casa o ya resolvió, e invitarlo a nuestra herramienta rápida (30 seg) cerrando con **`¿Te interesa?`**.
   - *Si responde "sí":* reacción inmediata en la bandeja para enviarle el link (o copiar respuesta en 1 clic).
   - *Si no responde:* esperar **2 días (48h)**.
2. **Paso 2 (con link `/buscar?c=...`):** Enviar mensaje breve (*"te envío el link para que nos digas qué características tiene la casa de tus sueños..."*) + enlace directo.
   - *Si llena el formulario:* sube **automáticamente a E4** con fecha reactivada.
   - *Si pasan **7 días** tras el Paso 2 sin respuesta ni registro:* Copiloto propone moverlo a **Etapa 8 · Inactivo (`IN`)**.

### 🟩 Etapa 4 · Búsqueda Activa (`E4`)
- **Cobertura de inventario:** Busca en **TODO el inventario disponible** compatible (no solo sinergias).
- **Prioridad comercial de recomendación:**
  1. **Propiedades propias Match Home (`MH` / directas)**
  2. **EasyBroker (`EB`)**
  3. **Sinergias (`S1 / S2 / S3`)**
- **Cadencia:** Envía hasta **3 propiedades nuevas no enviadas** por tarjeta, **sin enfriamiento entre días** cuando haya opciones compatibles nuevas (solo evita duplicar en el mismo día).
- **Captación cruzada (1 sola vez por cliente):** Si aún no se ha preguntado en bitácora ni notas, el borrador pregunta amablemente si también tiene alguna propiedad en venta (`OW`).

### ⏸️ Etapa 7 · En Pausa (`PAU`) y 🚫 Etapa 8 · Inactivo (`IN`)
- **`PAU`:** Para clientes que respondieron *"de momento no"*. Quedan con `isActive: false` y fecha `reactivateAt` a **+90 días (3 meses)**. Cuando llega la fecha, Copiloto genera chequeo sin reactivarlos; tras enviarlo, reprograma otros 3 meses automáticamente. Solo vuelven a activo si confirman reinicio (`✅ Reinició búsqueda`).
- **`IN`:** Descartados definitivos (`ya_compro`, `no_interesa` o post-Paso 2 E3). Excluidos de toda automatización.

---

## 3. Anti-Repetición y Rotación Justa

- Se calcula el último contacto real (`lastTouchMs`): máximo entre `lastContact`, `lastResponse`, última bitácora del contacto y última tarjeta Copiloto completada.
- En **E1, E2 y E3**, la cola rota ordenando **primero a los contactos sin toque previo o con más tiempo sin ser contactados** (en lugar de repetir siempre los mismos registros recientes).
- Los contactos que **respondieron después de nuestro último mensaje** saltan la espera y pasan al frente.
- En **E1/E2**, una llamada sin respuesta respeta **48h (1 día completo de diferencia)** antes del 2.º intento.

---

## 4. Listado Ideal de Información por Contacto *(Guía no obligatoria)*

Sirve como guía para el asesor y para que Copiloto IA indique en **E2** qué dato puntual conviene confirmar (sin bloquear el avance si algún campo falta):

### A. 6 Datos Clave Principales
1. **Operación:** Venta o Renta
2. **Tipo de propiedad:** Casa, Departamento, Terreno, Local, etc.
3. **Presupuesto:** Monto aproximado o rango
4. **Zona(s) / Colonias** de preferencia
5. **Recámaras** *(cuando aplica a casa o departamento)*
6. **Forma de pago:** Contado, Crédito hipotecario, Infonavit, Fovissste

### B. 4 Datos de Valor
7. **Características clave / no negociables:** 1 planta, recámara en PB, fracc. privado, patio amplio, etc.
8. **Plazo / urgencia de compra:** Inmediata, 1–3 meses, 3–6 meses
9. **¿Tiene propiedad en venta?** *(oportunidad de captación `OW`)*
10. **Motivo / decisores:** Familia, inversión, compra en pareja
