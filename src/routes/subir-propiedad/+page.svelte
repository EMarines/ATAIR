<script lang="ts">
  import { db, storage, isSandbox } from '$lib/firebase_toggle';
  import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
  } from 'firebase/firestore';
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import ImageUploader from '$lib/components/ImageUploader.svelte';
  import DropdownSelect from '$lib/components/DropdownSelect.svelte';
  import ContactSelector from '$lib/components/ContactSelector.svelte';
  import PropertyNavActions from '$lib/components/PropertyNavActions.svelte';

  let isSubmitting = false;
  let uploadStatus: string | null = null;
  let uploadError: string | null = null;
  let lastSavedProperty: { clavePropiedad: string; titulo: string; procedenciaNombre: string; idCompaniaCaptadora?: string; telefonoContactoCaptador?: string } | null = null;
  let selectedImages: File[] = [];
  let formElement: HTMLFormElement | null = null;

  // Estados para Generación con IA
  let isGeneratingAI = false;
  let aiGenerationStatus: string | null = null;
  let aiError: string | null = null;

  let formData: Record<string, any> = {
    procedencia: 'MH',
    idCompaniaCaptadora: 'Match Home',
    idContactoCaptador: 'pinned-mh',
    nombreContactoCaptador: 'Match Home',
    companiaCaptadora: 'Match Home',
    telefonoContactoCaptador: '',
    tipoOperacion: 'Venta',
    tipoPropiedad: 'Casa',
    amenidades: []
  };

  const formSchema = {
    fields: [
      {
        name: 'idCompaniaCaptadora',
        label: 'ID / Nombre de la Compañía Captadora',
        type: 'contact-select',
        required: false,
        placeholder: 'Buscar agente o inmobiliaria...',
      },
      {
        name: 'tipoOperacion',
        label: 'Tipo de operación',
        type: 'radio',
        options: [
          { label: 'Venta', value: 'Venta' },
          { label: 'Renta', value: 'Renta' },
        ],
      },
      {
        name: 'tipoPropiedad',
        label: 'Tipo de propiedad',
        type: 'radio',
        options: [
          { label: 'Casa', value: 'Casa' },
          { label: 'Departamento', value: 'Departamento' },
          { label: 'Terreno', value: 'Terreno' },
          { label: 'Local Comercial', value: 'Local Comercial' },
          { label: 'Oficina', value: 'Oficina' },
          { label: 'Bodega', value: 'Bodega' },
          { label: 'Edificio', value: 'Edificio' },
          { label: 'Casa de Campo', value: 'Casa de Campo' },
          { label: 'Rancho', value: 'Rancho' },
          { label: 'Huerta', value: 'Huerta' },
        ],
      },
      {
        name: 'recamaras',
        label: 'Recámaras',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '+', value: 6 },
        ],
      },
      {
        name: 'banos',
        label: 'Baños',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '+', value: 6 },
        ],
      },
      {
        name: 'mediosBanos',
        label: 'Medios baños',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '+', value: 6 },
        ],
      },
      {
        name: 'estacionamientos',
        label: 'Estacionamientos',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '+', value: 6 },
        ],
      },
      { name: 'construccion', label: 'Construcción (m²)', type: 'number', required: false },
      { name: 'terreno', label: 'Terreno (m²)', type: 'number', required: false },
      { name: 'anioConstruccion', label: 'Año de construcción', type: 'number', required: false },
      { name: 'precio', label: 'Precio (MXN)', type: 'number', required: false },
      {
        name: 'condicion',
        label: 'Condición',
        type: 'radio',
        required: false,
        options: [
          { label: 'Excelente', value: 'Excelente' },
          { label: 'Bueno', value: 'Bueno' },
          { label: 'Regular', value: 'Regular' },
          { label: 'Para remodelar', value: 'Para remodelar' },
        ],
      },
      { name: 'colonia', label: 'Colonia', type: 'text' },
      { name: 'codigoPostal', label: 'Código postal', type: 'text', required: false },
      {
        name: 'amenidades',
        label: 'Amenidades',
        type: 'checkbox',
        required: false,
        options: [
          { label: 'Una planta', value: 'Una planta' },
          { label: 'Recamara en planta baja', value: 'Recamara en planta baja' },
          { label: 'Frente a parque', value: 'Frente a parque' },
          { label: 'Fraccionamiento privado', value: 'Fraccionamiento privado' },
          { label: 'Nueva', value: 'Nueva' },
          { label: 'Lista para habitar', value: 'Lista para habitar' },
          { label: 'Oportunidad', value: 'Oportunidad' },
          { label: 'Alberca', value: 'Alberca' },
          { label: 'Sobre Avenida Principal', value: 'Sobre Avenida Principal' },
          { label: 'Patio amplio', value: 'Patio amplio' },
        ],
      },
      {
        name: 'ubicacion',
        label: 'Zona de la Ciudad',
        type: 'radio',
        options: [
          { label: 'Norte', value: 'Norte' },
          { label: 'Noroeste', value: 'Noroeste' },
          { label: 'Noreste', value: 'Noreste' },
          { label: 'Este', value: 'Este' },
          { label: 'Oeste', value: 'Oeste' },
          { label: 'Centronorte', value: 'Centronorte' },
          { label: 'Centrosur', value: 'Centrosur' },
          { label: 'Suroeste', value: 'Suroeste' },
          { label: 'Sureste', value: 'Sureste' },
        ],
      },
      { name: 'titulo', label: 'Título', type: 'text', maxLength: 70 },
      { name: 'descripcion', label: 'Descripción', type: 'textarea', maxLength: 3000 },
    ],
  };

  function handleCheckboxChange(field: string, optionValue: string | number, event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      if (!formData[field]) formData[field] = [];
      formData[field] = [...formData[field], optionValue];
    } else {
      formData[field] = formData[field].filter((v: any) => v !== optionValue);
    }
  }

  async function generatePropertyKey(prefix = 'MH'): Promise<string> {
    if (!db) throw new Error('Firestore no está inicializado');
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cleanPrefix = (prefix || 'MH').toUpperCase();
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const l1 = letters[Math.floor(Math.random() * letters.length)];
      const l2 = letters[Math.floor(Math.random() * letters.length)];
      const nums = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const key = `${cleanPrefix}-${l1}${l2}${nums}`;
      const q = query(collection(db, 'properties'), where('clavePropiedad', '==', key));
      const snap = await getDocs(q);
      if (snap.empty) return key;
    }
    throw new Error('No se pudo generar una clave única. Intenta de nuevo.');
  }

  async function generateDescriptionWithAI() {
    isGeneratingAI = true;
    aiError = null;
    aiGenerationStatus = 'Consultando datos del inmueble e investigando la colonia...';

    try {
      const payload = {
        tipoPropiedad: formData.tipoPropiedad || 'Propiedad',
        tipoOperacion: formData.tipoOperacion || 'Venta',
        precio: formData.precio || '',
        moneda: formData.moneda || 'MXN',
        colonia: formData.colonia || '',
        ubicacion: formData.ubicacion || '',
        recamaras: formData.recamaras || '',
        banos: formData.banos || '',
        mediosBanos: formData.mediosBanos || '',
        estacionamientos: formData.estacionamientos || '',
        terreno: formData.terreno || '',
        construccion: formData.construccion || '',
        condicion: formData.condicion || '',
        amenidades: Array.isArray(formData.amenidades) ? formData.amenidades : [],
        descripcionPrevia: formData.descripcion || '',
        companiaCaptadora: formData.idCompaniaCaptadora || ''
      };

      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo generar la descripción.');
      }

      if (result.title) {
        formData.titulo = result.title;
      }
      formData.descripcion = result.description;
      aiGenerationStatus = '¡Título y descripción generados exitosamente con investigación de colonia!';
      setTimeout(() => {
        aiGenerationStatus = null;
      }, 5000);
    } catch (e: any) {
      console.error('Error al generar con IA:', e);
      aiError = e.message || 'Error al conectar con la IA.';
    } finally {
      isGeneratingAI = false;
    }
  }

  function resetForm() {
    lastSavedProperty = null;
    uploadStatus = null;
    uploadError = null;
    if (formElement) formElement.reset();
    Object.keys(formData).forEach((k) => {
      if (k !== 'procedencia' && k !== 'tipoOperacion' && k !== 'tipoPropiedad') {
        formData[k] = undefined;
      }
    });
    formData.procedencia = 'MH';
    formData.idCompaniaCaptadora = 'Match Home';
    formData.idContactoCaptador = 'pinned-mh';
    formData.nombreContactoCaptador = 'Match Home';
    formData.companiaCaptadora = 'Match Home';
    formData.telefonoContactoCaptador = '';
    formData.tipoOperacion = 'Venta';
    formData.tipoPropiedad = 'Casa';
    formData.amenidades = [];
    selectedImages = [];
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!db) {
      uploadError = 'Error: Base de datos no conectada.';
      return;
    }

    isSubmitting = true;
    uploadStatus = 'Iniciando subida...';
    uploadError = null;

    try {
      const procedenciaCode = formData.procedencia || 'MH';
      const procedenciaLabels: Record<string, string> = {
        'MH': 'Match Home (MH)',
        'S1': 'Sinergia 1 (S1)',
        'S2': 'Sinergia 2 (S2)',
        'S3': 'Sinergia 3 (S3)',
      };
      const procedenciaNombre = procedenciaLabels[procedenciaCode] ?? procedenciaCode;
      const isSynergy = procedenciaCode === 'S1' || procedenciaCode === 'S2' || procedenciaCode === 'S3';

      // VALIDACIÓN ESTRICTA DE SINERGIA: Debe tener contacto registrado y teléfono
      if (isSynergy) {
        if (!formData.idContactoCaptador || formData.idContactoCaptador.startsWith('pinned-mh')) {
          throw new Error(`Para una propiedad de sinergia (${procedenciaCode}), debes seleccionar un contacto o inmobiliaria registrada en el catálogo de Contactos.`);
        }
        if (!formData.telefonoContactoCaptador || String(formData.telefonoContactoCaptador).trim() === '') {
          throw new Error(`El contacto o inmobiliaria seleccionada (${formData.idCompaniaCaptadora || formData.nombreContactoCaptador || 'Sinergia'}) no tiene registrado un número de teléfono. Por favor añade su teléfono en Contactos para poder asignarle la propiedad.`);
        }
      }

      uploadStatus = 'Generando clave con procedencia...';
      const idCompaniaCaptadora = formData.idCompaniaCaptadora ? String(formData.idCompaniaCaptadora).trim() : '';
      const idContactoCaptador = formData.idContactoCaptador ? String(formData.idContactoCaptador).trim() : '';
      const telefonoContactoCaptador = formData.telefonoContactoCaptador ? String(formData.telefonoContactoCaptador).trim() : '';
      const nombreContactoCaptador = formData.nombreContactoCaptador ? String(formData.nombreContactoCaptador).trim() : '';
      const companiaCaptadora = formData.companiaCaptadora ? String(formData.companiaCaptadora).trim() : idCompaniaCaptadora;
      const clavePropiedad = await generatePropertyKey(procedenciaCode);

      const imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        if (!storage) throw new Error('Firebase Storage no está disponible');
        uploadStatus = `Subiendo imágenes (0/${selectedImages.length})...`;
        for (let i = 0; i < selectedImages.length; i++) {
          const file = selectedImages[i];
          const fileRef = ref(storage, `properties/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(fileRef, file);
          const url = await getDownloadURL(snapshot.ref);
          imageUrls.push(url);
          uploadStatus = `Subiendo imágenes (${i + 1}/${selectedImages.length})...`;
        }
      }

      const primaryImg = imageUrls[0] ?? '';
      const opType = formData.tipoOperacion ?? 'Venta';
      const isSale = String(opType).toLowerCase().includes('venta') || String(opType).toLowerCase() === 'sale';
      const numPrice = formData.precio ? Number(formData.precio) : null;
      const cur = formData.moneda || 'MXN';

      uploadStatus = 'Guardando datos de la propiedad...';
      await addDoc(collection(db, 'properties'), {
        ...formData,
        clavePropiedad,
        public_id: clavePropiedad,
        easybroker_id: null,
        source: isSynergy ? 'synergy' : 'manual',
        sourceName: isSynergy ? `Sinergia (${procedenciaCode}) - ${companiaCaptadora || nombreContactoCaptador}` : 'Match Home (Captura Manual)',

        procedencia: procedenciaCode,
        procedenciaNombre,
        idCompaniaCaptadora,
        companiaCaptadora,
        idContactoCaptador,
        nombreContactoCaptador,
        telefonoContactoCaptador,
        contactId: idContactoCaptador,

        title: formData.titulo ?? '',
        description: formData.descripcion ?? '',
        property_type: formData.tipoPropiedad ?? '',
        operation_type: isSale ? 'sale' : 'rental',
        operations: numPrice ? [{
          type: isSale ? 'sale' : 'rental',
          amount: numPrice,
          currency: cur,
          formatted_amount: `$${numPrice.toLocaleString('es-MX')} ${cur}`,
          unit: 'total'
        }] : [],
        operaciones: numPrice ? [{
          type: isSale ? 'sale' : 'rental',
          amount: numPrice,
          currency: cur,
          formatted_amount: `$${numPrice.toLocaleString('es-MX')} ${cur}`,
          unit: 'total'
        }] : [],

        bedrooms: formData.recamaras ? Number(formData.recamaras) : null,
        bathrooms: formData.banos ? Number(formData.banos) : null,
        half_bathrooms: formData.mediosBanos ? Number(formData.mediosBanos) : null,
        parking_spaces: formData.estacionamientos ? Number(formData.estacionamientos) : null,
        lot_size: formData.terreno ? Number(formData.terreno) : null,
        construction_size: formData.construccion ? Number(formData.construccion) : null,

        price: numPrice,
        currency: cur,
        precioFormateado: numPrice ? `$${numPrice.toLocaleString('es-MX')} ${cur}` : '',

        location: formData.colonia ? { name: formData.colonia } : '',
        colonia: formData.colonia ?? '',
        ubicacion: formData.ubicacion ?? formData.colonia ?? '',

        imagenPrincipal: primaryImg,
        imagenMiniatura: primaryImg,
        title_image_full: primaryImg,
        title_image_thumb: primaryImg,
        images: imageUrls,
        property_images: imageUrls.map(url => ({ title: '', url })),

        tags: formData.amenidades ?? [],
        features: formData.amenidades ?? [],

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      });

      // Si el contacto existe en Firestore y se capturó teléfono, enriquecer el contacto
      if (idContactoCaptador && !idContactoCaptador.startsWith('pinned-') && telefonoContactoCaptador) {
        try {
          const contactRef = doc(db, 'contacts', idContactoCaptador);
          await updateDoc(contactRef, {
            telephon: telefonoContactoCaptador,
            telefono: telefonoContactoCaptador,
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('No se pudo actualizar el teléfono en el contacto:', e);
        }
      }

      lastSavedProperty = {
        clavePropiedad,
        titulo: formData.titulo || 'Sin título',
        procedenciaNombre,
        idCompaniaCaptadora: companiaCaptadora || idCompaniaCaptadora,
        telefonoContactoCaptador,
      };
      uploadStatus = `¡Propiedad subida exitosamente! Clave: ${clavePropiedad}`;

      if (formElement) formElement.reset();
      Object.keys(formData).forEach((k) => {
        if (k !== 'procedencia' && k !== 'tipoOperacion' && k !== 'tipoPropiedad') {
          formData[k] = undefined;
        }
      });
      formData.procedencia = procedenciaCode;
      formData.tipoOperacion = 'Venta';
      formData.tipoPropiedad = 'Casa';
      formData.amenidades = [];
      selectedImages = [];
    } catch (err: any) {
      console.error(err);
      uploadError = 'Error: ' + err.message;
      uploadStatus = null;
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Subir Propiedad – ATAIR SGI</title>
  <meta name="description" content="Sube una nueva propiedad manualmente al catálogo de ATAIR CRM." />
</svelte:head>

<div class="page-container">
  <div class="page-header-row">
    <div class="page-header">
      <div class="header-badge-row">
        <span class="module-tag">Catálogo & Inventario</span>
        {#if isSandbox}
          <span class="sandbox-tag">🧪 Entorno de Pruebas (Sandbox)</span>
        {/if}
      </div>
      <h1>Subir Nueva Propiedad</h1>
      <p>Completa los datos del inmueble para registrarlo en el catálogo y vincularlo con clientes de ATAIR.</p>
    </div>

    <PropertyNavActions current="subir-propiedad" />
  </div>

  <div class="form-wrapper glass">
    <form bind:this={formElement} on:submit={handleSubmit}>
      <div class="form-grid">
        {#each formSchema.fields as field}
          <div
            class="form-group"
            class:full-width={field.type === 'textarea' || field.type === 'checkbox'}
          >
            <label for={field.name} class:required={field.required !== false}>{field.label}</label>

            {#if field.type === 'contact-select'}
              <ContactSelector
                bind:value={formData[field.name]}
                bind:contactId={formData.idContactoCaptador}
                bind:contactPhone={formData.telefonoContactoCaptador}
                bind:contactName={formData.nombreContactoCaptador}
                bind:companyName={formData.companiaCaptadora}
                procedencia={formData.procedencia}
                placeholder={field.placeholder}
                onSelectProcedencia={(proc) => {
                  formData.procedencia = proc;
                }}
              />
            {:else if field.type === 'number'}
              <input
                type="number"
                id={field.name}
                bind:value={formData[field.name]}
                placeholder={field.label}
                required={field.required !== false}
              />
            {:else if field.type === 'text'}
              <input
                type="text"
                id={field.name}
                bind:value={formData[field.name]}
                maxlength={field.maxLength}
                placeholder={field.label}
                required={field.required !== false}
              />
            {:else if field.type === 'textarea'}
              <div class="textarea-container">
                <div class="textarea-header">
                  <span class="textarea-hint">Puedes ingresar tus notas clave y enriquecerlas con la IA</span>
                  <button
                    type="button"
                    class="btn-generate-ai"
                    disabled={isGeneratingAI}
                    on:click={generateDescriptionWithAI}
                  >
                    {#if isGeneratingAI}
                      <span class="ai-spinner"></span>
                      Analizando colonia y redactando...
                    {:else}
                      ✨ Generar Título y Descripción con IA
                    {/if}
                  </button>
                </div>

                <textarea
                  id={field.name}
                  bind:value={formData[field.name]}
                  maxlength={field.maxLength}
                  rows="7"
                  placeholder={field.label}
                  required={field.required !== false}
                ></textarea>

                <div class="textarea-footer">
                  <span class="char-count">
                    {(formData[field.name]?.length || 0).toLocaleString('es-MX')} / {(field.maxLength || 3000).toLocaleString('es-MX')} caracteres
                  </span>
                </div>

                {#if aiGenerationStatus}
                  <div class="ai-status-msg success">
                    ✅ {aiGenerationStatus}
                  </div>
                {/if}

                {#if aiError}
                  <div class="ai-status-msg error">
                    ⚠️ {aiError}
                  </div>
                {/if}
              </div>
            {:else if field.type === 'radio'}
              <DropdownSelect
                options={field.options || []}
                bind:value={formData[field.name]}
                placeholder="Elige un(a) {field.label.toLowerCase()}"
                name={field.name}
                required={field.required !== false}
              />
            {:else if field.type === 'checkbox'}
              <div class="checkbox-group">
                {#each field.options || [] as option}
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      value={option.value}
                      on:change={(e) => handleCheckboxChange(field.name, option.value, e)}
                    />
                    <span>{option.label}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="divider"></div>

      <ImageUploader bind:files={selectedImages} />

      {#if uploadError}
        <div class="alert error">{uploadError}</div>
      {/if}

      {#if lastSavedProperty}
        <div class="success-card glass">
          <div class="success-header">
            <span class="success-icon">🎉</span>
            <div>
              <h3>¡Propiedad publicada con éxito!</h3>
              <p class="success-subtitle">Registrada correctamente en la base de datos de ATAIR CRM.</p>
            </div>
          </div>

          <div class="success-details">
            <div class="detail-badge-row">
              <span class="badge-clave">{lastSavedProperty.clavePropiedad}</span>
              <span class="badge-procedencia">{lastSavedProperty.procedenciaNombre}</span>
              {#if lastSavedProperty.idCompaniaCaptadora}
                <span class="badge-compania">🏢 {lastSavedProperty.idCompaniaCaptadora}</span>
              {/if}
              {#if lastSavedProperty.telefonoContactoCaptador}
                <span class="badge-telefono">📞 {lastSavedProperty.telefonoContactoCaptador}</span>
              {/if}
            </div>
            <p class="detail-title">{lastSavedProperty.titulo}</p>
          </div>

          <div class="success-actions">
            <a href="/properties" class="btn-secondary">
              📊 Ver en Catálogo de Propiedades
            </a>
            <button type="button" class="btn-primary" on:click={resetForm}>
              ➕ Subir otra propiedad
            </button>
          </div>
        </div>
      {/if}

      <div class="submit-actions">
        <button type="submit" class="btn-primary" disabled={isSubmitting}>
          {#if isSubmitting}
            <span class="btn-spinner"></span>
            Subiendo a Firebase...
          {:else}
            🚀 Publicar Propiedad en CRM
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .page-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
  }

  .header-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .module-tag {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
  }

  .sandbox-tag {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
  }

  .page-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }

  .page-header {
    margin-bottom: 0;
    flex: 1;
    min-width: 280px;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 0.4rem 0;
    background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .page-header p {
    color: #94a3b8;
    font-size: 0.95rem;
    margin: 0;
  }

  .form-wrapper {
    background: rgba(30, 30, 53, 0.65);
    border: 1px solid rgba(99, 102, 241, 0.2);
    backdrop-filter: blur(16px);
    border-radius: 1.25rem;
    padding: 2.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
  }

  .form-group {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  @media (min-width: 768px) {
    .form-group {
      grid-template-columns: 220px 1fr;
      align-items: center;
      gap: 1.75rem;
    }
    .form-group.full-width {
      align-items: flex-start;
    }
  }

  label {
    font-weight: 500;
    font-size: 0.9rem;
    color: #94a3b8;
  }

  label.required:after {
    content: '*';
    color: #f87171;
    margin-left: 4px;
  }

  input[type="text"], input[type="number"] {
    font-family: inherit;
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: #1e1e35;
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.92rem;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-sizing: border-box;
  }

  input[type="text"]:focus, input[type="number"]:focus, textarea:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  input::placeholder, textarea::placeholder {
    color: #94a3b8;
    opacity: 0.85;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    padding: 0.35rem 0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 400;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.04);
    padding: 0.35rem 0.8rem;
    border-radius: 2rem;
    border: 1px solid rgba(99, 102, 241, 0.2);
    font-size: 0.82rem;
    color: #94a3b8;
    transition: all 0.2s;
  }

  .checkbox-label:hover {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.12);
    color: #f1f5f9;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2rem 0;
  }

  .submit-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 0.85rem 1.75rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.07);
    color: #f1f5f9;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(99, 102, 241, 0.3);
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-right: 0.5rem;
    vertical-align: middle;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .alert {
    padding: 1rem 1.25rem;
    border-radius: 0.5rem;
    margin-top: 1.5rem;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .alert.error {
    background-color: rgba(248, 113, 113, 0.12);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.3);
  }

  /* === AI Description Generator Styles === */
  .textarea-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .textarea-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .textarea-hint {
    font-size: 0.78rem;
    color: #64748b;
  }

  .textarea-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-top: -0.25rem;
  }

  .char-count {
    font-size: 0.74rem;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }

  .btn-generate-ai {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.42rem 0.95rem;
    border-radius: 0.5rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25));
    border: 1px solid rgba(168, 85, 247, 0.45);
    color: #e9d5ff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-generate-ai:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(168, 85, 247, 0.45));
    border-color: #c084fc;
    color: #ffffff;
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.35);
    transform: translateY(-1px);
  }

  .btn-generate-ai:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .ai-spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: #c084fc;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .ai-status-msg {
    font-size: 0.82rem;
    padding: 0.5rem 0.85rem;
    border-radius: 0.4rem;
    line-height: 1.4;
  }

  .ai-status-msg.success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .ai-status-msg.error {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  textarea {
    font-family: inherit;
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: #1e1e35;
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.92rem;
    resize: vertical;
    box-sizing: border-box;
  }

  textarea:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  /* Success Card */
  .success-card {
    margin-top: 1.5rem;
    padding: 1.5rem;
    border-radius: 0.75rem;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .success-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .success-icon {
    font-size: 2rem;
  }

  .success-header h3 {
    font-size: 1.15rem;
    color: #34d399;
    margin: 0;
  }

  .success-subtitle {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0.15rem 0 0 0;
  }

  .success-details {
    background: rgba(0, 0, 0, 0.25);
    padding: 0.85rem 1.15rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .detail-badge-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .badge-clave {
    font-family: monospace;
    font-weight: 700;
    font-size: 0.85rem;
    padding: 0.2rem 0.55rem;
    background: rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 0.25rem;
    letter-spacing: 0.05em;
  }

  .badge-procedencia {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 0.25rem;
  }

  .badge-compania {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.2rem 0.55rem;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 0.25rem;
  }

  .badge-telefono {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 0.25rem;
    font-family: monospace;
  }

  .detail-title {
    font-size: 0.95rem;
    font-weight: 500;
    color: #f1f5f9;
    margin: 0;
  }

  .success-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }
</style>
