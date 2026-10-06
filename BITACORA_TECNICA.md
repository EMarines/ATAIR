# 📘 Cuaderno Técnico de Arquitectura & Decisiones de Diseño — ATAIR CRM
**Aplicación:** ATAIR CRM (Modernización Mobile-First Desacoplada)  
**Ubicación:** `c:\Users\Propietario\Web Projects\ATAIR SGI\ATAIR CRM`  
**Autor & Dirección:** Enrique Marines / Antigravity AI  
**Última actualización:** 2026-10-06  

---

## 1. Filosofía de Arquitectura & Principio de Desacople
- **Desacople Absoluto del Legacy:** ATAIR CRM se construyó en un directorio independiente (`ATAIR CRM/`) con su propio repositorio Git, dependencias y configuración. El CRM en producción (`c:\Users\Propietario\Web Projects\ATAIR SGI\ATAIR`) se mantiene **100% intocado** para garantizar cero riesgo operativo.
- **Mobile-First Real (Ergonomía de Campo):** Todas las interfaces están pensadas para que una asociada las use en su smartphone con **un solo pulgar** mientras maneja, atiende una lona o muestra una casa.
- **Ultra Ligereza & Cero Fricción:** Eliminación de formularios burocráticos y campos redundantes; la app infiere, separa y normaliza datos mediante código en background.

---

## 2. Autenticación, Seguridad & Roles (Paso 1)

### A. Método de Autenticación Híbrido (Client + Server Guard)
1. **Cliente (Firebase Auth SDK):**
   - Estado de sesión sincronizado en memoria y persistido con `browserLocalPersistence`.
   - Stores reactivos de Svelte:
     - `userStore`: Usuario nativo de Firebase Auth.
     - `userProfile`: Documento del usuario en Firestore (`users/{uid}`).
     - `isAdmin`: Booleano derivado (`role === 'admin'`).
     - `isAsociado`: Booleano derivado (`role === 'asociado'`).
2. **Servidor SvelteKit (`hooks.server.ts`):**
   - Cookie segura HTTP-Only `atair_session` que guarda token y rol.
   - **Guardián de APIs:** Toda petición a `/api/*` es interceptada por el servidor. Si no existe sesión válida o rol autorizado, responde de inmediato con `401 Unauthorized`.
3. **Bootstrap Multi-Admin sin Hardcoding:**
   - Erradicado el mock estático `admin@example.com` del legacy.
   - Lista inicial de correos fundadores (`marines.enrique@gmail.com`, `matchhomebr@gmail.com`, `matchhome@hotmail.com`) que reciben rol de administrador en su primer inicio de sesión.
   - El resto de usuarios se crean en la colección `users` con rol `asociado` o `user`.

---

## 3. Cartera de Clientes & Aislamiento Estricto (Paso 2)

### A. Criterios de Aislamiento de Cartera (Multi-Tenancy)
- **Asociada:** Solo tiene acceso visual a los prospectos que ella captó o que le fueron asignados.
  - Consulta en Firestore: `where('associate_id', '==', user.uid)`.
  - Si un usuario no es admin, no puede consultar la cartera de otros asesores.
- **Administrador (Enrique / Claudia):** Supervisión 360° de toda la red comercial.
  - Consulta global de la colección `contacts`.
  - Filtros directos por Plaza (`CUU` / `DEL`), por Asesora, por Tipo y por Etapa.

### B. Pipeline de Etapas Unificado
- **Compradores:** Etapas `E1` a `E5` (Primer contacto, Perfilamiento, Recorrido, Oferta, Cierre).
- **Arrendatarios:** Etapas `A1` y `A2` (Primer contacto, Búsqueda con Sinergias) con SLA de atención rápida.
- **Progresión en 1 Clic:** La ficha `/contact/[id]` permite cambiar de etapa con un solo toque, registrando la fecha de cambio en Firestore.
- **Badges Cromáticos:** Lógica centralizada en `src/lib/functions/contactBadge.ts` con colores específicos (`#ef4444` para E1, `#0cbff6` para A1/A2, etc.).

---

## 4. Ingesta Móvil de Leads (`/ingesta-lead`)

### A. Criterio de Velocidad (15 Segundos en Lona)
Cuando una persona llama frente a una lona, la asociada no puede llenar 10 campos. Criterios aplicados:
1. **Un solo campo de Nombre:** La asociada escribe `"Enrique Marines"`. En background, la función `splitFullName()` lo divide automáticamente en `name: "Enrique"` y `lastname: "Marines"`.
2. **Teléfono Flexible con Sanitización:** Permite teclear con espacios o guiones (ej. `614 275-4512`). La función `extractCleanPhone()` extrae los 10 dígitos puros para E.164 (`+526142754512`).
3. **Presupuesto Máximo Único:** Se eliminaron los campos duales de presupuesto mínimo/máximo; se solicita únicamente el presupuesto tope con chips rápidos (`$1.5M`, `$2.5M`, `$4M`, `$7M`).
4. **Buscador Predictivo de Inmuebles:** A partir de la 3ª letra filtra el catálogo en memoria por clave, título o colonia. Si no existe en inventario, permite guardar el texto libre de la lona.

---

## 5. Formato Telefónico Universal & Mensajería Ligera de WhatsApp

### A. Regla Visual Universal de Teléfono
- **En Pantalla (UI):** Formato canónico obligatorio `### ### ####` (ej. `614 275 4512`) mediante `formatDisplayPhone()`. Aplica a tarjetas, cabeceras, pies de página y modales.
- **En Base de Datos & APIs:** Se almacena `telephon: '+526142754512'` para interoperabilidad con llamadas y WhatsApp, y opcionalmente `phoneFormatted: '614 275 4512'`.

### B. Redacción de WhatsApp Ultra Ligera
Enrique definió erradicar mensajes robotizados largos. Criterios aplicados en `proposalMessage.ts`:
1. **Saludo Humano:** `"Hola [Nombre], gracias por contactarnos."` (nombre propio capitalizado a Title Case).
2. **Variable Dinámica por Tipo de Inmueble (`formatPropertyPhrase`):**
   - Casa $\rightarrow$ *"de la casa"*
   - Departamento $\rightarrow$ *"del departamento"*
   - Terreno $\rightarrow$ *"del terreno"*
   - Bodega $\rightarrow$ *"de la bodega"*
   - Local $\rightarrow$ *"del local comercial"*
3. **Estructura del Mensaje:**
   ```text
   Hola Enrique, gracias por contactarnos.
   Te comparto la información de la casa que te interesó:

   https://matchhome.vercel.app/propuesta/EB-RR8135?c=12345

   Quedo al pendiente para cuando desees conocerla.
   ```
4. **Link al Final para Previsualización Interactiva:** La URL pública se coloca al final para que la API de WhatsApp despliegue la tarjeta rica (foto de portada de la casa, título truncado y dominio `matchhome.vercel.app`).
5. **Privacidad del Link (`getProposalUrl`):**
   - **Contacto Existente:** Se envía únicamente `?c={contactId}` para no exponer nombre ni teléfono en la URL.
   - **Contacto Nuevo:** Se envía con parámetros codificados de nombre y teléfono para precargar en el sitio público.

---

## 6. Catálogo Móvil de Propiedades (`/properties` y `/property/[id]`) (Paso 3)

### A. Normalizador Universal (`normalizeProperty.ts`)
- Las propiedades en Firestore provienen de múltiples fuentes históricas (EasyBroker, Sinergias S1-S3, Captura Directa, manuales) con campos en inglés (`price`, `bedrooms`, `property_images`) o español (`precio`, `recamaras`, `fotos`).
- `normalizeProperty()` unifica cualquier documento en la interfaz canónica `Property` sin romper la UI.
- Mapea zonas geográficas canónicas de Chihuahua (`Centronorte`, `Centrosur`, `Norte`, `Sur`).

### B. Ficha con Generador de Propuesta en 1 Clic
- Permite seleccionar cualquier contacto de la cartera del asesor (o ingresar un número nuevo).
- Genera en tiempo real el enlace público y el mensaje ligero de WhatsApp listo para enviar.
- Registra automáticamente en la bitácora (`binnacles`) que la propuesta fue enviada.

---

## 7. Agenda Móvil & Compromisos en Tiempo Real (`/agenda`) (Paso 4)

### A. Agrupación Cronológica Táctil
En lugar de una tabla estática de escritorio, los compromisos se dividen automáticamente en 4 bloques:
1. 🚨 **Vencidas / Urgentes:** Fecha anterior a hoy sin completar.
2. 🟢 **Hoy:** Ruta de trabajo del día.
3. 🔵 **Mañana:** Compromisos del día siguiente.
4. ⚪ **Próximos:** Citas a futuro.

### B. Operación en 1 Toque
- **Check Circular:** Actualiza de inmediato el estado en Firestore (`updateDoc`) tachando visualmente la tarea sin recargar la página.
- **Acciones Rápidas de Contacto:** Botón verde de WhatsApp y botón de llamada directa si la tarea tiene un cliente vinculado.
- **Modal con Presets:** Botones de fecha rápida (*Hoy*, *Mañana*) y hora (*10:00 AM*, *04:30 PM*) para agendar en <10 segundos.

---

## 8. Dashboard Inteligente en Tiempo Real (`/`)

### A. Reactividad con Firestore
- Conectado con `onSnapshot` a `contacts` y `properties`.
- Si el usuario es Administrador: muestra total de leads en cartera matriz y desglose de compradores vs arrendatarios.
- Si el usuario es Asociada: muestra sus prospectos asignados y tareas por atender en SLA D1.
- **Acceso Rápido:** Bloque de "Últimos Prospectos Captados" con llamada y WhatsApp directo.

---

## 9. Matriz de Archivos Clave del Ecosistema ATAIR CRM

| Archivo | Responsabilidad / Criterio |
| :--- | :--- |
| `src/hooks.server.ts` | Guardián server-side que rechaza peticiones no autorizadas (401 en `/api/*`). |
| `src/lib/firebase/config.ts` | Conexión dual de Firebase (Sandbox `curso-svelte-58c5d` vs Prod `matchhome-crm-46de4`). |
| `src/lib/firebase/authManager.ts` | Manejador de roles (`admin` vs `asociado`), perfil y sesión. |
| `src/lib/functions/phoneUtils.ts` | Regla telefónica universal `### ### ####` y extractor de 10 dígitos. |
| `src/lib/functions/proposalMessage.ts` | Generador canónico del mensaje ligero y dinámico de WhatsApp. |
| `src/lib/functions/urlUtils.ts` | Generador del enlace oficial de propuesta pública (`matchhome.vercel.app`). |
| `src/lib/functions/normalizeProperty.ts` | Normalizador tolerante de esquemas híbridos de propiedades. |
| `src/lib/functions/contactBadge.ts` | Badges cromáticos oficiales para E1-E5, A1-A2 y sinergias (S1-S3/MH). |
| `src/routes/ingesta-lead/+page.svelte` | PWA de captura de leads en 15 segundos para asociadas. |
| `src/routes/contacts/+page.svelte` | Cartera con aislamiento estricto por asociada o vista 360° admin. |
| `src/routes/contact/[id]/+page.svelte` | Ficha de prospecto con progresión de etapas en 1 clic y bitácora. |
| `src/routes/properties/+page.svelte` | Catálogo móvil de propiedades con filtros rápidos. |
| `src/routes/property/[id]/+page.svelte` | Ficha técnica completa con generador de propuesta en 1 clic. |
| `src/routes/agenda/+page.svelte` | Agenda móvil agrupada cronológicamente con check interactivo en vivo. |
| `src/routes/admin/asociados/+page.svelte` | Panel de supervisión de asociadas: altas, asignación de plaza, split comisional y conteo de leads. |
| `src/routes/+page.svelte` | Dashboard reactivo con métricas vivas y prospectos recientes. |

---

## 8.1. Gestión de Asociados Comerciales (Paso 5)

### A. Reglas de Negocio del Panel Admin (`/admin/asociados`)
- **Acceso Exclusivo:** Solo accesible para usuarios con rol `admin` (`role === 'admin'`). Si una asociada ingresa directamente, la interfaz restringe el acceso con aviso de seguridad y redirección.
- **Métricas Globales de Red:**
  - Total de asociadas registradas.
  - Asociadas con estatus **Activa** vs **Inactiva**.
  - Distribución por Plaza: **Chihuahua (CUU)** y **Delicias (DEL)**.
- **Esquema Comisionista Paramétrico:**
  - Split predeterminado canónico del modelo: **42.5%** para la Asociada Comercial / **57.5%** para MatchHome Matriz.
  - El administrador puede personalizar el porcentaje comisional por asociada según su nivel de producción.
- **Conteo Dinámico de Cartera por Asociada:**
  - Cruce reactivo en tiempo real con la colección `contacts`.
  - Calcula automáticamente cuántos prospectos tiene asignados cada asociada (`where('associate_id', '==', user.uid)`).
- **Acciones Táctiles en 1 Toque:**
  - Cambio instantáneo de estatus (Activar / Suspender).
  - Apertura directa de chat de WhatsApp con la asesora formateando el teléfono en regla `### ### ####`.
  - Modal de alta y edición con validación de correo, nombre, teléfono y plaza.

---

## 10. Paquete Documental Comprometido al Cierre del Proyecto
*(Acuerdo con Enrique Marines — Asiento #282)*

Al finalizar los módulos de ATAIR CRM, se generará y entregará formalmente el expediente ejecutivo que contendrá:

1. **Descripción General del Funcionamiento Integral:**
   - Mapa de la arquitectura funcional de punta a punta.
   - Detalle de cómo interactúan la PWA, la cartera aislada, el catálogo comercial, la agenda y el dashboard sin requerir software externo.
2. **Diagrama de Flujo Canónico (Mermaid & Gráfico):**
   - Recorrido completo del prospecto y la asesora:
     $$\text{Llamada por Lona} \longrightarrow \text{Ingesta PWA 15s} \longrightarrow \text{Protección Autoría (associate\_id)} \longrightarrow \text{Propuesta Ligera WhatsApp} \longrightarrow \text{Agenda Cita/D1} \longrightarrow \text{Pipeline E1-E5} \longrightarrow \text{Cierre / Split 57.5-42.5}$$
3. **Instructivo Institucional de Operación:**
   - **Alcances:** Límites operativos de la PWA, cobertura de plazas (Chihuahua / Delicias) y roles (`admin` vs `asociado`).
   - **Objetivos:** Productividad de campo, cero fuga de prospectos, velocidad de respuesta en <24h.
   - **Métodos:** Estándares de captura, etiqueta telefónica `### ### ####`, y mensaje ligero no invasivo.
   - **Metas Cuantitativas:** SLAs de atención (D1 <24h), ratio de conversión y pipeline de la red comercial.

