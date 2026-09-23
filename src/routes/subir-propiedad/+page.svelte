<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { db, storage, prodStorage, isSandbox } from '$lib/firebase_toggle';
  import {
    collection,
    addDoc,
    setDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    limit
  } from 'firebase/firestore';
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import ImageUploader from '$lib/components/ImageUploader.svelte';
  import DropdownSelect from '$lib/components/DropdownSelect.svelte';
  import ContactSelector from '$lib/components/ContactSelector.svelte';
  import PropertyNavActions from '$lib/components/PropertyNavActions.svelte';
  import { formatZona, tagToUbicacion, tagToFeatures } from '$lib/functions/tagConverters';
  import { detectCatalogAmenities } from '$lib/parameters';

  let isSubmitting = false;
  let uploadStatus: string | null = null;
  let uploadError: string | null = null;
  let lastSavedProperty: { clavePropiedad: string; titulo: string; procedenciaNombre: string; idCompaniaCaptadora?: string; telefonoContactoCaptador?: string } | null = null;
  let selectedImages: File[] = [];
  let formElement: HTMLFormElement | null = null;

  // Estados para Modo Edición
  let isEditMode = false;
  let editingDocId: string | null = null;
  let editingClave: string | null = null;
  let existingImages: string[] = [];
  let existingDraggingIndex = -1;
  let existingDragOverIndex = -1;
  let isLoadingEditData = false;

  function moveExistingImage(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= existingImages.length || toIndex < 0 || toIndex >= existingImages.length || fromIndex === toIndex) {
      return;
    }
    const newImgs = [...existingImages];
    const [moved] = newImgs.splice(fromIndex, 1);
    newImgs.splice(toIndex, 0, moved);
    existingImages = newImgs;
  }

  function handleExistingDragStart(e: DragEvent, idx: number) {
    existingDraggingIndex = idx;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      e.dataTransfer.setData('application/x-existing-img', String(idx));
    }
  }

  function handleExistingDragEnter(e: DragEvent, idx: number) {
    e.preventDefault();
    e.stopPropagation();
    if (existingDraggingIndex !== -1 && existingDraggingIndex !== idx) {
      existingDragOverIndex = idx;
    }
  }

  function handleExistingDragOver(e: DragEvent, idx: number) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (existingDraggingIndex !== -1 && existingDraggingIndex !== idx) {
      existingDragOverIndex = idx;
    }
  }

  function handleExistingDragLeave(e: DragEvent, idx: number) {
    if (existingDragOverIndex === idx) {
      existingDragOverIndex = -1;
    }
  }

  function handleExistingDrop(e: DragEvent, idx: number) {
    e.preventDefault();
    e.stopPropagation();
    let fromIdx = existingDraggingIndex;
    if (e.dataTransfer) {
      const dtData = e.dataTransfer.getData('application/x-existing-img') || e.dataTransfer.getData('text/plain');
      if (dtData && !isNaN(Number(dtData))) {
        fromIdx = parseInt(dtData, 10);
      }
    }
    if (fromIdx !== -1 && fromIdx !== idx && fromIdx >= 0 && fromIdx < existingImages.length && idx >= 0 && idx < existingImages.length) {
      moveExistingImage(fromIdx, idx);
    }
    existingDraggingIndex = -1;
    existingDragOverIndex = -1;
  }

  function handleExistingDragEnd() {
    existingDraggingIndex = -1;
    existingDragOverIndex = -1;
  }

  // Estados para Generación con IA
  let isGeneratingAI = false;
  let aiGenerationStatus: string | null = null;
  let aiError: string | null = null;

  // Estados para Ingesta Rápida (Tabs: 'whatsapp', 'easybroker' o 'link')
  let activeIngestaTab: 'whatsapp' | 'easybroker' | 'link' = 'whatsapp';
  let rawWhatsAppText = '';
  let isParsingWhatsApp = false;
  let waParseError: string | null = null;
  let waParseSuccess: string | null = null;

  // Estados para Importación por Clave EasyBroker (EB-)
  let easybrokerKey = '';
  let isFetchingEB = false;
  let ebError: string | null = null;
  let ebSuccess: string | null = null;
  let importedEbId: string | null = null;

  // Estados para Ingesta por Enlace Externo (Robot n8n)
  let linkUrl = '';
  let isSendingLink = false;
  let linkError: string | null = null;
  let linkSuccess: string | null = null;
  let lastSentLink = '';

  // Estados para Modal de Ingesta Asistida
  let activeModal: 'texto' | 'easybroker' | 'link' | null = null;
  let modalPhotos: File[] = [];
  let isModalDragging = false;
  let isImportedViaLink = false;

  function openIngestaModal(method: 'texto' | 'easybroker' | 'link') {
    activeModal = method;
    activeIngestaTab = method === 'texto' ? 'whatsapp' : method;
  }

  function closeIngestaModal() {
    activeModal = null;
    isModalDragging = false;
  }

  function handleModalDropPhotos(e: DragEvent) {
    isModalDragging = false;
    if (!e.dataTransfer) return;

    // Si se arrastró texto, volcarlo al input de WhatsApp
    const draggedText = e.dataTransfer.getData('text/plain');
    if (draggedText && !rawWhatsAppText) {
      rawWhatsAppText = draggedText;
    }

    // Si se arrastraron fotos
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) {
        modalPhotos = [...modalPhotos, ...files];
      }
    }
  }

  function handleModalFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const files = Array.from(target.files).filter(f => f.type.startsWith('image/'));
      modalPhotos = [...modalPhotos, ...files];
    }
  }

  function handleModalPastePhotos(e: ClipboardEvent) {
    if (!e.clipboardData) return;
    const imgFiles: File[] = [];
    if (e.clipboardData.items && e.clipboardData.items.length > 0) {
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && (file.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|heic|tiff)$/i.test(file.name))) {
            imgFiles.push(file);
          }
        }
      }
    }
    if (imgFiles.length === 0 && e.clipboardData.files && e.clipboardData.files.length > 0) {
      for (const file of Array.from(e.clipboardData.files)) {
        if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|heic|tiff)$/i.test(file.name)) {
          imgFiles.push(file);
        }
      }
    }
    if (imgFiles.length > 0) {
      e.preventDefault();
      modalPhotos = [...modalPhotos, ...imgFiles];
    }
  }

  let formData: Record<string, any> = {
    procedencia: '',
    idCompaniaCaptadora: '',
    idContactoCaptador: '',
    nombreContactoCaptador: '',
    companiaCaptadora: '',
    telefonoContactoCaptador: '',
    tipoOperacion: '',
    tipoPropiedad: '',
    amenidades: []
  };

  const formSchema = {
    fields: [
      {
        name: 'idCompaniaCaptadora',
        label: 'Contacto / Inmobiliaria Captadora',
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
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '6', value: 6 },
          { label: '7', value: 7 }, { label: '8', value: 8 }, { label: '9', value: 9 },
          { label: '10+', value: 10 },
        ],
      },
      {
        name: 'banos',
        label: 'Baños',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '6', value: 6 },
          { label: '7', value: 7 }, { label: '8', value: 8 }, { label: '9', value: 9 },
          { label: '10+', value: 10 },
        ],
      },
      {
        name: 'mediosBanos',
        label: 'Medios baños',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '6+', value: 6 },
        ],
      },
      {
        name: 'estacionamientos',
        label: 'Estacionamientos',
        type: 'radio',
        required: false,
        options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
          { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '6', value: 6 },
          { label: '7', value: 7 }, { label: '8', value: 8 }, { label: '9', value: 9 },
          { label: '10+', value: 10 },
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
      { name: 'colonia', label: 'Colonia', type: 'text', required: false },
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
        required: false,
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
        tituloPrevio: formData.titulo || '',
        descripcionPrevia: formData.descripcion || '',
        companiaCaptadora: formData.idCompaniaCaptadora || ''
      };

      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let result: any = null;
      if (res.ok) {
        result = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        try {
          result = JSON.parse(text);
        } catch {
          result = { success: false, error: `Error del servidor (${res.status})` };
        }
      }

      if (!result || !result.success) {
        throw new Error(result?.error || 'No se pudo generar la descripción.');
      }

      if (result.title) {
        formData.titulo = result.title;
      }
      formData.descripcion = result.description;

      // Auto-enriquecer checkboxes de amenidades si la descripción o título generados contienen amenidades del catálogo
      formData.amenidades = detectCatalogAmenities(
        `${formData.titulo || ''} ${formData.descripcion || ''}`,
        formData.amenidades || []
      );

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

  async function loadPropertyToEdit(idOrKey: string) {
    if (!db || !idOrKey) return;
    isLoadingEditData = true;
    uploadStatus = `Cargando datos de la propiedad (${idOrKey})...`;

    try {
      let foundDoc: any = null;
      let foundDocId: string | null = null;

      // 1. Búsqueda directa por docId
      try {
        const docRef = doc(db, 'properties', idOrKey);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          foundDoc = docSnap.data();
          foundDocId = docSnap.id;
        }
      } catch (e) {
        // no es docId directo
      }

      // 2. Búsqueda por clavePropiedad / public_id / id
      if (!foundDoc) {
        const fields = ['clavePropiedad', 'public_id', 'id', 'easybroker_id'];
        for (const field of fields) {
          try {
            const q = query(collection(db, 'properties'), where(field, '==', idOrKey), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              foundDoc = qSnap.docs[0].data();
              foundDocId = qSnap.docs[0].id;
              break;
            }
          } catch (e) {
            console.warn(`Error buscando por ${field}:`, e);
          }
        }
      }

      if (foundDoc && foundDocId) {
        isEditMode = true;
        editingDocId = foundDocId;
        editingClave = foundDoc.clavePropiedad || foundDoc.public_id || idOrKey;

        // Extraer fotos existentes
        const rawImgs = foundDoc.images || foundDoc.imageUrls || [];
        const rawPropImgs = (foundDoc.property_images || []).map((p: any) => typeof p === 'string' ? p : p?.url);
        const primary = foundDoc.imagenPrincipal || foundDoc.title_image_thumb || foundDoc.title_image_full;
        const allImgs = [...rawImgs, ...rawPropImgs, primary].filter((u: any): u is string => typeof u === 'string' && u.trim() !== '' && !u.includes('placeholder'));
        existingImages = Array.from(new Set(allImgs));

        // Precargar formData
        const proc = foundDoc.procedencia || (editingClave && editingClave.startsWith('S1') ? 'S1' : editingClave && editingClave.startsWith('S2') ? 'S2' : editingClave && editingClave.startsWith('S3') ? 'S3' : 'MH');
        const isSale = foundDoc.operation_type === 'rental' || foundDoc.tipoOperacion === 'Renta' ? 'Renta' : 'Venta';

        formData = {
          procedencia: proc,
          idCompaniaCaptadora: foundDoc.idCompaniaCaptadora || foundDoc.companiaCaptadora || (proc === 'MH' ? 'Match Home' : ''),
          companiaCaptadora: foundDoc.companiaCaptadora || foundDoc.idCompaniaCaptadora || '',
          idContactoCaptador: foundDoc.idContactoCaptador || foundDoc.contactId || '',
          nombreContactoCaptador: foundDoc.nombreContactoCaptador || '',
          telefonoContactoCaptador: foundDoc.telefonoContactoCaptador || foundDoc.telefono || foundDoc.telephon || '',
          tipoOperacion: isSale,
          tipoPropiedad: foundDoc.property_type || foundDoc.tipoPropiedad || 'Casa',
          precio: foundDoc.price ?? foundDoc.precio ?? (foundDoc.operations?.[0]?.amount || ''),
          moneda: foundDoc.currency || foundDoc.moneda || 'MXN',
          recamaras: foundDoc.bedrooms ?? foundDoc.recamaras ?? '',
          banos: foundDoc.bathrooms ?? foundDoc.banos ?? '',
          mediosBanos: foundDoc.half_bathrooms ?? foundDoc.mediosBanos ?? '',
          estacionamientos: foundDoc.parking_spaces ?? foundDoc.estacionamientos ?? '',
          terreno: foundDoc.lot_size ?? foundDoc.terreno ?? '',
          construccion: foundDoc.construction_size ?? foundDoc.construccion ?? '',
          condicion: foundDoc.condicion ?? '',
          colonia: foundDoc.colonia || (typeof foundDoc.location === 'object' ? foundDoc.location?.name : (typeof foundDoc.location === 'string' && !tagToUbicacion(foundDoc.location) ? foundDoc.location : '')),
          ubicacion: formatZona(foundDoc) || foundDoc.ubicacion || foundDoc.zona || '',
          amenidades: detectCatalogAmenities(
            `${foundDoc.title || foundDoc.titulo || ''} ${foundDoc.description || foundDoc.descripcion || ''}`,
            tagToFeatures(Array.isArray(foundDoc.tags) ? foundDoc.tags : (Array.isArray(foundDoc.features) ? foundDoc.features : (Array.isArray(foundDoc.amenidades) ? foundDoc.amenidades : [])))
          ),
          titulo: foundDoc.title || foundDoc.titulo || '',
          descripcion: foundDoc.description || foundDoc.descripcion || ''
        };

        uploadStatus = null;
      } else {
        uploadError = `No se encontró la propiedad "${idOrKey}" en la base de datos para editar.`;
      }
    } catch (err: any) {
      console.error('Error cargando propiedad para editar:', err);
      uploadError = 'Error al cargar propiedad: ' + err.message;
    } finally {
      isLoadingEditData = false;
    }
  }

  function cleanNumber(val: any): number | '' {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') return isNaN(val) ? '' : val;
    const str = String(val).replace(/,/g, '').trim();
    const match = str.match(/[\d]+(\.[\d]+)?/);
    if (!match) return '';
    const num = parseFloat(match[0]);
    return isNaN(num) ? '' : num;
  }

  async function fetchEasyBrokerProperty() {
    ebError = null;
    ebSuccess = null;
    const raw = easybrokerKey.trim();
    if (!raw) {
      ebError = 'Ingresa una clave válida de EasyBroker (ej. EB-C0123) o enlace del inmueble.';
      return;
    }

    // Si pegaron un enlace completo de EasyBroker, redirigir al extractor inteligente
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      rawWhatsAppText = raw;
      activeIngestaTab = 'whatsapp';
      await parseWhatsAppText();
      return;
    }

    // Sanitizar clave asegurando prefijo EB-
    let cleanKey = raw.toUpperCase();
    if (!cleanKey.startsWith('EB-')) {
      if (cleanKey.startsWith('EB')) {
        cleanKey = 'EB-' + cleanKey.slice(2);
      } else {
        cleanKey = 'EB-' + cleanKey;
      }
    }
    easybrokerKey = cleanKey;

    isFetchingEB = true;
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(cleanKey)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          throw new Error(errData.error);
        }
        if (res.status === 404) {
          throw new Error(`La clave "${cleanKey}" no se encuentra en tu cuenta directa de EasyBroker. Si es una propiedad compartida/MLS de otra inmobiliaria, pega el enlace web del inmueble (ej. easybroker.com/listing/...) para descargarla automáticamente con fotos.`);
        }
        throw new Error(`Error al consultar EasyBroker (${res.status})`);
      }

      const data = await res.json();
      importedEbId = data.public_id || cleanKey;

      // Volcar Título y Descripción (permitiendo mejorarla luego con el botón IA)
      formData.titulo = data.title || '';
      formData.descripcion = data.description || '';

      // Volcar Operación y Precio
      if (Array.isArray(data.operations) && data.operations.length > 0) {
        const op = data.operations[0];
        formData.tipoOperacion = op.type === 'rental' ? 'Renta' : 'Venta';
        formData.precio = cleanNumber(op.amount);
        formData.moneda = op.currency || 'MXN';
      }

      // Normalizar Tipo de Propiedad al catálogo de ATAIR
      const rawType = (data.property_type || '').toLowerCase();
      if (rawType.includes('casa') && !rawType.includes('campo')) formData.tipoPropiedad = 'Casa';
      else if (rawType.includes('departamento') || rawType.includes('apartment') || rawType.includes('depto')) formData.tipoPropiedad = 'Departamento';
      else if (rawType.includes('terreno') || rawType.includes('land') || rawType.includes('lote')) formData.tipoPropiedad = 'Terreno';
      else if (rawType.includes('local') || rawType.includes('comercial')) formData.tipoPropiedad = 'Local Comercial';
      else if (rawType.includes('oficina') || rawType.includes('office')) formData.tipoPropiedad = 'Oficina';
      else if (rawType.includes('bodega') || rawType.includes('warehouse') || rawType.includes('nave')) formData.tipoPropiedad = 'Bodega';
      else if (rawType.includes('edificio') || rawType.includes('building')) formData.tipoPropiedad = 'Edificio';
      else if (rawType.includes('campo') || rawType.includes('quinta')) formData.tipoPropiedad = 'Casa de Campo';
      else if (rawType.includes('rancho')) formData.tipoPropiedad = 'Rancho';
      else if (rawType.includes('huerta')) formData.tipoPropiedad = 'Huerta';
      else formData.tipoPropiedad = data.property_type || 'Casa';

      // Recámaras, Baños, Medios Baños, Estacionamientos
      formData.recamaras = data.bedrooms ? Math.min(Number(data.bedrooms), 6) : '';
      formData.banos = data.bathrooms ? Math.min(Number(data.bathrooms), 6) : '';
      formData.mediosBanos = data.half_bathrooms ? Math.min(Number(data.half_bathrooms), 6) : '';
      formData.estacionamientos = data.parking_spaces ? Math.min(Number(data.parking_spaces), 6) : '';

      // Metros de Construcción y Terreno
      formData.construccion = cleanNumber(data.construction_size);
      formData.terreno = cleanNumber(data.lot_size);

      // Colonia
      let col = (typeof data.location === 'object' ? data.location?.name : data.location) || '';
      col = col
        .replace(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)(,?\s?y?\s?(I|II|III|IV|V|VI|VII|VIII|IX|X))*\b/gi, '')
        .replace(/Chihuahua,?\s*Chihuahua/gi, '')
        .replace(/,\s*Chihuahua/gi, '')
        .replace(/,\s*$/, '')
        .trim();
      formData.colonia = col;

      // Zona de la ciudad detectada
      const detectedZona = tagToUbicacion(data.tags || data.features || col);
      if (detectedZona) {
        formData.ubicacion = detectedZona;
      }

      // Detección automática de amenidades desde título, descripción, características y etiquetas
      const allEbText = `${data.title || ''} ${data.description || ''} ${(data.features || []).join(' ')} ${(data.tags || []).join(' ')}`;
      formData.amenidades = detectCatalogAmenities(allEbText, formData.amenidades || []);

      // Fotos de la galería precargadas en el visor interactivo
      if (Array.isArray(data.property_images) && data.property_images.length > 0) {
        existingImages = data.property_images
          .map((img: any) => (typeof img === 'string' ? img : img?.url))
          .filter((u: any): u is string => typeof u === 'string' && u.trim() !== '');
      } else if (data.title_image_full) {
        existingImages = [data.title_image_full];
      }

      const numFotos = existingImages.length;
      ebSuccess = `¡Propiedad ${cleanKey} descargada con éxito! Se precargaron ${numFotos} foto${numFotos === 1 ? '' : 's'} y todos los campos técnicos. Puedes revisar y mejorar los datos abajo.`;

      // Cerrar modal automáticamente y enviar al formulario lleno
      activeModal = null;

      // Desplazamiento suave al formulario
      setTimeout(() => {
        const formEl = document.querySelector('.form-wrapper');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (err: any) {
      console.error('Error al descargar propiedad EB:', err);
      ebError = err.message || 'Error al conectar con EasyBroker';
    } finally {
      isFetchingEB = false;
    }
  }

  function applyExtractedPropertyData(p: any, rawSource: string, isFromLink: boolean = false) {
    if (p.titulo) formData.titulo = p.titulo;
    if (p.descripcion) formData.descripcion = p.descripcion;
    if (p.tipoOperacion) formData.tipoOperacion = p.tipoOperacion;
    if (p.precio !== undefined && p.precio !== null && p.precio !== '') formData.precio = cleanNumber(p.precio);
    if (p.moneda) formData.moneda = p.moneda;
    if (p.tipoPropiedad) formData.tipoPropiedad = p.tipoPropiedad;

    if (p.recamaras !== null && p.recamaras !== undefined && p.recamaras !== '') {
      formData.recamaras = Number(p.recamaras);
    }
    if (p.banos !== null && p.banos !== undefined && p.banos !== '') {
      formData.banos = Number(p.banos);
    }
    if (p.mediosBanos !== null && p.mediosBanos !== undefined && p.mediosBanos !== '') {
      formData.mediosBanos = Number(p.mediosBanos);
    }
    if (p.estacionamientos !== null && p.estacionamientos !== undefined && p.estacionamientos !== '') {
      formData.estacionamientos = Number(p.estacionamientos);
    }

    if (p.construccion !== undefined && p.construccion !== null && p.construccion !== '') formData.construccion = cleanNumber(p.construccion);
    if (p.terreno !== undefined && p.terreno !== null && p.terreno !== '') formData.terreno = cleanNumber(p.terreno);
    if (p.anioConstruccion !== undefined && p.anioConstruccion !== null && p.anioConstruccion !== '') formData.anioConstruccion = cleanNumber(p.anioConstruccion);
    else if (p.anoConstruccion !== undefined && p.anoConstruccion !== null && p.anoConstruccion !== '') formData.anioConstruccion = cleanNumber(p.anoConstruccion);

    if (p.colonia) formData.colonia = p.colonia;
    if (p.codigoPostal) formData.codigoPostal = String(p.codigoPostal).trim();
    if (p.ubicacion) {
      formData.ubicacion = p.ubicacion;
    } else if (p.colonia) {
      const detectedZona = tagToUbicacion(p.colonia);
      if (detectedZona) formData.ubicacion = detectedZona;
    }

    const combinedText = `${p.titulo || ''} ${p.descripcion || ''} ${rawSource}`;
    formData.amenidades = detectCatalogAmenities(
      combinedText,
      Array.isArray(p.amenidades) ? p.amenidades : (formData.amenidades || [])
    );

    if (Array.isArray(p.fotos) && p.fotos.length > 0) {
      existingImages = p.fotos.map((u: string) => String(u).replace(/&amp;/g, '&'));
    }

    if (p.easybrokerId) {
      importedEbId = p.easybrokerId;
    }

    if (isFromLink) {
      isImportedViaLink = true;
      formData.procedencia = ''; // El usuario selecciona manualmente el tipo de sinergia
    } else {
      isImportedViaLink = false;
    }
  }

  async function submitPropertyLink() {
    linkError = null;
    linkSuccess = null;
    const cleanUrl = (linkUrl || '').trim();
    if (!cleanUrl) {
      linkError = 'Por favor ingresa la URL de la propiedad a importar.';
      return;
    }

    isSendingLink = true;
    lastSentLink = cleanUrl;

    try {
      // 1. Extracción directa inteligente con el parser de ATAIR (soporta enlaces de EasyBroker y portales)
      const parseRes = await fetch('/api/parse-property-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: cleanUrl })
      });

      const parseData = await parseRes.json().catch(() => ({}));

      if (parseRes.ok && parseData.success && parseData.data) {
        applyExtractedPropertyData(parseData.data, cleanUrl, true);
        const numFotos = existingImages.length;
        const fotosMsg = numFotos > 0 ? ` Se precargaron ${numFotos} fotos originales.` : '';
        linkSuccess = `¡Propiedad extraída con éxito desde el enlace!${fotosMsg} Asigna el contacto captador y la sinergia abajo.`;
        linkUrl = '';
        activeModal = null;

        setTimeout(() => {
          const formEl = document.querySelector('.form-wrapper');
          if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        return;
      }

      // 2. Si no es enlace directo procesable por el parser nativo, enviar a n8n
      const n8nWebhook = import.meta.env.VITE_N8N_WEBHOOK_LINK || 'https://n8n-atair.duckdns.org/webhook/ingest-property';
      const res = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, link: cleanUrl })
      });

      if (!res.ok) throw new Error(`El robot extractor n8n respondió con código ${res.status}`);

      linkSuccess = `¡Enlace enviado al robot extractor n8n con éxito! Se procesará en segundo plano.`;
      linkUrl = '';
      activeModal = null;

      setTimeout(() => {
        const formEl = document.querySelector('.form-wrapper');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (err: any) {
      console.error('Error al procesar enlace de propiedad:', err);
      linkError = err.message || 'Error al procesar el enlace de la propiedad';
    } finally {
      isSendingLink = false;
    }
  }

  async function parseWhatsAppText() {
    waParseError = null;
    waParseSuccess = null;
    const cleanText = (rawWhatsAppText || '').trim();
    if (!cleanText) {
      waParseError = 'Por favor pega el texto de la propiedad copiado de WhatsApp o redes.';
      return;
    }

    const isLinkSource = cleanText.startsWith('http://') || cleanText.startsWith('https://');
    isParsingWhatsApp = true;
    try {
      const res = await fetch('/api/parse-property-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: cleanText })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error al procesar el texto (${res.status})`);
      }

      const p = data.data;
      applyExtractedPropertyData(p, cleanText, isLinkSource);

      const numFotosDescargadas = Array.isArray(p.fotos) && p.fotos.length > 0 ? p.fotos.length : 0;
      const fotosMsg = numFotosDescargadas > 0
        ? ` Además se descargaron ${numFotosDescargadas} fotos originales listas en la galería.`
        : ' Revisa los campos y arrastra las fotos abajo.';

      waParseSuccess = `¡Datos extraídos con éxito! Se autollenaron: ${p.tipoPropiedad || 'Propiedad'} en ${p.tipoOperacion || 'Venta'}, Col. ${p.colonia || 'N/D'}${p.precio ? `, $${Number(p.precio).toLocaleString('es-MX')} ${p.moneda || 'MXN'}` : ''}.${fotosMsg}`;

      // Transferir fotos cargadas en el modal si existen
      if (modalPhotos.length > 0) {
        selectedImages = [...selectedImages, ...modalPhotos];
        modalPhotos = [];
      }
      activeModal = null;

      // Desplazamiento suave al formulario
      setTimeout(() => {
        const formEl = document.querySelector('.form-wrapper');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (err: any) {
      console.error('Error al parsear texto de WhatsApp:', err);
      waParseError = err.message || 'Error al procesar el texto con la IA';
    } finally {
      isParsingWhatsApp = false;
    }
  }

  onMount(() => {
    const editId = $page.url.searchParams.get('edit');
    if (editId) {
      loadPropertyToEdit(editId);
    }

    const importParam = $page.url.searchParams.get('import');
    if (importParam === 'easybroker' || importParam === 'eb') {
      activeModal = 'easybroker';
      activeIngestaTab = 'easybroker';
    } else if (importParam === 'whatsapp' || importParam === 'wa' || importParam === 'texto') {
      activeModal = 'texto';
      activeIngestaTab = 'whatsapp';
    } else if (importParam === 'link' || importParam === 'url') {
      activeModal = 'link';
      activeIngestaTab = 'link';
    }
  });

  function resetForm() {
    isEditMode = false;
    editingDocId = null;
    editingClave = null;
    existingImages = [];
    lastSavedProperty = null;
    uploadStatus = null;
    uploadError = null;
    easybrokerKey = '';
    importedEbId = null;
    ebError = null;
    ebSuccess = null;
    linkUrl = '';
    linkError = null;
    linkSuccess = null;
    rawWhatsAppText = '';
    waParseError = null;
    waParseSuccess = null;
    if (formElement) formElement.reset();
    formData = {
      procedencia: '',
      idCompaniaCaptadora: '',
      idContactoCaptador: '',
      nombreContactoCaptador: '',
      companiaCaptadora: '',
      telefonoContactoCaptador: '',
      tipoOperacion: '',
      tipoPropiedad: '',
      amenidades: []
    };
    selectedImages = [];
  }

  function compressImage(file: File, maxDim = 900, quality = 0.72): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target!.result as string);
          reader.readAsDataURL(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = e => resolve(e.target!.result as string);
        reader.readAsDataURL(file);
      };
      img.src = url;
    });
  }

  function scrollToForm() {
    const formEl = document.querySelector('.form-wrapper');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submitDirectly() {
    if (formElement) {
      if (typeof formElement.requestSubmit === 'function') {
        formElement.requestSubmit();
      } else {
        formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  }

  function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date || typeof obj.toMillis === 'function') return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore).filter((item) => item !== undefined);
    }
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!db) {
      uploadError = 'Error: Base de datos no conectada.';
      return;
    }

    if (!formData.tipoOperacion) {
      uploadError = 'Por favor selecciona el tipo de operación (Venta o Renta).';
      return;
    }
    if (!formData.tipoPropiedad) {
      uploadError = 'Por favor selecciona el tipo de propiedad.';
      return;
    }
    if (!formData.titulo || !formData.titulo.trim()) {
      uploadError = 'Por favor ingresa un título para la propiedad.';
      return;
    }
    if (!formData.procedencia) {
      uploadError = 'Por favor selecciona el Tipo de Procedencia / Sinergia (S1, S2, S3 o Directa MH).';
      const formEl = document.querySelector('.form-wrapper');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    isSubmitting = true;
    uploadStatus = 'Iniciando subida...';
    uploadError = null;

    try {
      const procedenciaCode = formData.procedencia || 'S1';
      const procedenciaLabels: Record<string, string> = {
        'MH': 'Match Home (MH)',
        'EB': 'EasyBroker (EB)',
        'S1': 'Sinergia 1 (S1)',
        'S2': 'Sinergia 2 (S2)',
        'S3': 'Sinergia 3 (S3)',
      };
      const procedenciaNombre = procedenciaLabels[procedenciaCode] ?? procedenciaCode;
      const isSynergy = procedenciaCode === 'S1' || procedenciaCode === 'S2' || procedenciaCode === 'S3';

      uploadStatus = 'Generando clave con procedencia...';
      const idCompaniaCaptadora = formData.idCompaniaCaptadora ? String(formData.idCompaniaCaptadora).trim() : '';
      const idContactoCaptador = formData.idContactoCaptador ? String(formData.idContactoCaptador).trim() : '';
      const telefonoContactoCaptador = formData.telefonoContactoCaptador ? String(formData.telefonoContactoCaptador).replace(/\D/g, '').trim() : '';
      const nombreContactoCaptador = formData.nombreContactoCaptador ? String(formData.nombreContactoCaptador).trim() : '';
      const companiaCaptadora = formData.companiaCaptadora ? String(formData.companiaCaptadora).trim() : idCompaniaCaptadora;
      
      let clavePropiedad = '';
      if (importedEbId && importedEbId.toUpperCase().startsWith('EB-') && !isSynergy) {
        clavePropiedad = importedEbId.toUpperCase().trim();
      } else {
        clavePropiedad = await generatePropertyKey(procedenciaCode);
      }

      const imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        let uploadedToStorage = false;
        const imageStorage = prodStorage || storage;

        // Si no estamos en sandbox, intentar primero Firebase Storage
        if (!isSandbox && imageStorage) {
          try {
            uploadStatus = `Subiendo imágenes a Firebase Storage (0/${selectedImages.length})...`;
            for (let i = 0; i < selectedImages.length; i++) {
              const file = selectedImages[i];
              const fileRef = ref(imageStorage, `properties/${Date.now()}_${file.name}`);
              const snapshot = await uploadBytes(fileRef, file);
              const url = await getDownloadURL(snapshot.ref);
              imageUrls.push(url);
              uploadStatus = `Subiendo imágenes (${i + 1}/${selectedImages.length})...`;
            }
            uploadedToStorage = true;
          } catch (storageErr) {
            console.warn('Firebase Storage no disponible o rechazado, optimizando directamente:', storageErr);
            imageUrls.length = 0;
          }
        }

        // Si es Sandbox o si Storage rechazó (ej. reglas sin permisos), optimizar imágenes y guardarlas directamente
        if (!uploadedToStorage) {
          uploadStatus = `Optimizando imágenes para el catálogo (0/${selectedImages.length})...`;
          for (let i = 0; i < selectedImages.length; i++) {
            const file = selectedImages[i];
            const dataUrl = await compressImage(file, 900, 0.72);
            imageUrls.push(dataUrl);
            uploadStatus = `Optimizando imágenes (${i + 1}/${selectedImages.length})...`;
          }
        }
      }

      const primaryImg = imageUrls[0] ?? (existingImages[0] ?? '');
      const opType = formData.tipoOperacion ?? 'Venta';
      const isSale = String(opType).toLowerCase().includes('venta') || String(opType).toLowerCase() === 'sale';
      const numPrice = formData.precio ? Number(formData.precio) : null;
      const cur = formData.moneda || 'MXN';

      if (isEditMode && editingDocId) {
        uploadStatus = 'Actualizando cambios de la propiedad...';
        const finalImages = [...existingImages, ...imageUrls];
        const primaryImg = finalImages[0] ?? '';

        const rawUpdateData = {
          ...formData,
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
          ubicacion: formData.ubicacion ?? '',
          zona: formData.ubicacion ?? '',
          locaProperty: formData.ubicacion ? [formData.ubicacion] : [],

          imagenPrincipal: primaryImg,
          imagenMiniatura: primaryImg,
          title_image_full: primaryImg,
          title_image_thumb: primaryImg,
          images: finalImages,
          property_images: finalImages.map(url => ({ title: '', url })),

          tags: formData.ubicacion ? [...(formData.amenidades ?? []), formData.ubicacion] : (formData.amenidades ?? []),
          features: formData.amenidades ?? [],

          updatedAt: serverTimestamp(),
          updated_at: Date.now(),
        };

        await updateDoc(doc(db, 'properties', editingDocId), sanitizeForFirestore(rawUpdateData));

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

        existingImages = finalImages;
        selectedImages = [];
        lastSavedProperty = {
          clavePropiedad: editingClave || 'Propiedad',
          titulo: formData.titulo || 'Sin título',
          procedenciaNombre,
          idCompaniaCaptadora: companiaCaptadora || idCompaniaCaptadora,
          telefonoContactoCaptador,
        };
        uploadStatus = `¡Propiedad ${editingClave} actualizada exitosamente! Redirigiendo al detalle...`;
        const redirectKey = editingClave || editingDocId;
        setTimeout(() => {
          goto(`/property/${encodeURIComponent(redirectKey)}`);
        }, 500);
      } else {
        uploadStatus = 'Guardando datos de la propiedad...';
        const finalImages = [...existingImages, ...imageUrls];
        const primaryImg = finalImages[0] ?? '';

        const rawDocData = {
          ...formData,
          clavePropiedad,
          public_id: clavePropiedad,
          easybroker_id: importedEbId || null,
          source: importedEbId ? 'easybroker' : (isSynergy ? 'synergy' : 'manual'),
          sourceName: importedEbId
            ? `Match Home (EasyBroker ${importedEbId})`
            : (isSynergy ? `Sinergia (${procedenciaCode}) - ${companiaCaptadora || nombreContactoCaptador}` : 'Match Home (Captura Manual)'),

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
          ubicacion: formData.ubicacion ?? '',
          zona: formData.ubicacion ?? '',
          locaProperty: formData.ubicacion ? [formData.ubicacion] : [],

          imagenPrincipal: primaryImg,
          imagenMiniatura: primaryImg,
          title_image_full: primaryImg,
          title_image_thumb: primaryImg,
          images: finalImages,
          property_images: finalImages.map(url => ({ title: '', url })),

          tags: formData.ubicacion ? [...(formData.amenidades ?? []), formData.ubicacion] : (formData.amenidades ?? []),
          features: formData.amenidades ?? [],

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          created_at: Date.now(),
          updated_at: Date.now(),
          syncedAt: serverTimestamp(),
        };

        const cleanDocData = sanitizeForFirestore(rawDocData);

        let savedDocId = clavePropiedad;
        if (clavePropiedad.toUpperCase().startsWith('EB-')) {
          await setDoc(doc(db, 'properties', clavePropiedad), cleanDocData);
        } else {
          const newDocRef = await addDoc(collection(db, 'properties'), cleanDocData);
          savedDocId = newDocRef.id;
        }

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
        uploadStatus = `¡Propiedad subida exitosamente! Clave: ${clavePropiedad}. Redirigiendo al detalle...`;

        if (formElement) formElement.reset();
        formData = {
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
        selectedImages = [];
        existingImages = [];
        importedEbId = null;
        easybrokerKey = '';

        const redirectKey = clavePropiedad || savedDocId;
        setTimeout(() => {
          goto(`/property/${encodeURIComponent(redirectKey)}`);
        }, 800);
      }
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
  <title>{isEditMode ? `Editar Propiedad (${editingClave || ''})` : 'Subir Propiedad'} – ATAIR SGI</title>
  <meta name="description" content="Sube o edita propiedades manualmente en el catálogo de ATAIR CRM." />
</svelte:head>

<div class="page-container">
  <div class="page-header-row">
    <div class="page-header">
      <div class="header-badge-row">
        <span class="module-tag">Catálogo & Inventario</span>
        {#if isSandbox}
          <span class="sandbox-tag">🧪 Entorno de Pruebas (Sandbox)</span>
        {/if}
        {#if isEditMode}
          <span class="edit-tag">✏️ Modo Edición ({editingClave})</span>
          <a href="/property/{encodeURIComponent(editingClave || '')}" class="btn-cancel-edit">✕ Cancelar edición</a>
        {/if}
      </div>
      {#if isEditMode}
        <h1>Editar Propiedad ({editingClave})</h1>
        <p>Modifica los datos y fotografías del inmueble registrado en ATAIR CRM.</p>
      {:else}
        <h1>Subir Nueva Propiedad</h1>
        <p>Completa los datos del inmueble para registrarlo en el catálogo y vincularlo con clientes de ATAIR.</p>
      {/if}
    </div>

    <PropertyNavActions current="subir-propiedad" onOpenModal={openIngestaModal} />
  </div>

  {#if uploadStatus}
    <div class="top-alert-banner info glass">
      <span class="btn-spinner"></span>
      <span>{uploadStatus}</span>
    </div>
  {/if}

  {#if uploadError}
    <div class="top-alert-banner error glass">
      <div class="alert-content-row">
        <span>❌ {uploadError}</span>
        <button type="button" class="alert-close" on:click={() => uploadError = null}>✕</button>
      </div>
    </div>
  {/if}

  <!-- Modal Interactivo de Ingesta Asistida -->
  {#if activeModal && !isEditMode}
    <div
      class="modal-backdrop"
      on:click={closeIngestaModal}
      on:keydown={(e) => e.key === 'Escape' && closeIngestaModal()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="modal-dialog glass" on:click|stopPropagation>
        <!-- Cabecera del Modal -->
        <div class="modal-dialog-header">
          <div class="modal-dialog-title">
            <span class="modal-header-icon {activeModal}">
              {#if activeModal === 'texto'}💬{:else if activeModal === 'easybroker'}🔑{:else}🔗{/if}
            </span>
            <div>
              <h3>
                {#if activeModal === 'texto'}
                  Subir con Texto y Fotos
                {:else if activeModal === 'easybroker'}
                  Subir Por Clave EasyBroker
                {:else}
                  Subir Por Enlace Externo
                {/if}
              </h3>
              <p>
                {#if activeModal === 'texto'}
                  Pega el mensaje de WhatsApp y/o arrastra fotos. La IA extraerá los datos técnicos automáticamente.
                {:else if activeModal === 'easybroker'}
                  Ingresa la clave EB para descargar la ficha técnica y fotos originales desde la API de EasyBroker.
                {:else}
                  Pega el enlace de la propiedad para que el robot extractor de n8n la procese automáticamente.
                {/if}
              </p>
            </div>
          </div>
          <button type="button" class="btn-modal-close" on:click={closeIngestaModal} aria-label="Cerrar modal">✕</button>
        </div>

        <!-- Contenido según Método Activo -->
        <div class="modal-dialog-body">
          <!-- Panel 1: Arrastrar Texto y Fotos -->
          {#if activeModal === 'texto'}
            <div class="modal-tab-content" id="whatsapp-parser-section">
              <div class="wa-textarea-wrapper">
                <textarea
                  id="whatsapp-text-input"
                  rows="4"
                  bind:value={rawWhatsAppText}
                  placeholder="Pega o arrastra aquí el mensaje del grupo de WhatsApp (ej: 'En venta bonita casa en Col. Las Granjas, 3 recámaras, 2 baños, 120m² terreno, $1,900,000...')..."
                  disabled={isParsingWhatsApp}
                  on:dragover|preventDefault
                  on:drop|preventDefault={(e) => {
                    const txt = e.dataTransfer?.getData('text/plain');
                    if (txt) rawWhatsAppText = txt;
                  }}
                ></textarea>
              </div>

              <!-- Dropzone de Fotografías en el Modal -->
              <div
                class="modal-dropzone"
                class:dragging={isModalDragging}
                tabindex="0"
                role="region"
                aria-label="Zona para arrastrar o pegar fotos"
                on:dragenter|preventDefault|stopPropagation={() => isModalDragging = true}
                on:dragover|preventDefault|stopPropagation={() => isModalDragging = true}
                on:dragleave|preventDefault|stopPropagation={() => isModalDragging = false}
                on:drop|preventDefault|stopPropagation={handleModalDropPhotos}
                on:paste={handleModalPastePhotos}
              >
                {#if modalPhotos.length === 0}
                  <div class="dropzone-empty">
                    <span class="dropzone-icon">📷</span>
                    <p>Arrastra fotos de la propiedad aquí, <label class="file-browse-link">selecciona archivos<input type="file" multiple accept="image/*" on:change={handleModalFileSelect} hidden /></label> o pega con <kbd>Ctrl+V</kbd></p>
                    <span class="dropzone-hint">Opcional: puedes copiarlas desde una carpeta y pegarlas directamente</span>
                  </div>
                {:else}
                  <div class="dropzone-filled">
                    <div class="dropzone-filled-header">
                      <span>📷 {modalPhotos.length} foto{modalPhotos.length === 1 ? '' : 's'} lista{modalPhotos.length === 1 ? '' : 's'} para cargar</span>
                      <button type="button" class="btn-clear-modal-photos" on:click={() => modalPhotos = []}>Limpiar fotos</button>
                    </div>
                    <div class="modal-photos-strip">
                      {#each modalPhotos as file, i}
                        <div class="modal-thumb-item">
                          <img src={URL.createObjectURL(file)} alt="Foto {i + 1}" />
                          <button type="button" class="btn-remove-thumb" on:click={() => modalPhotos = modalPhotos.filter((_, idx) => idx !== i)}>✕</button>
                        </div>
                      {/each}
                      <label class="modal-add-more-thumb" title="Agregar más fotos">
                        <span>+</span>
                        <input type="file" multiple accept="image/*" on:change={handleModalFileSelect} hidden />
                      </label>
                    </div>
                  </div>
                {/if}
              </div>

              <div class="wa-actions-row">
                <button
                  type="button"
                  class="btn-parse-wa"
                  on:click={parseWhatsAppText}
                  disabled={isParsingWhatsApp || (!rawWhatsAppText.trim() && modalPhotos.length === 0)}
                >
                  {#if isParsingWhatsApp}
                    <span class="btn-spinner"></span>
                    <span>Analizando con IA y Cargando Datos...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                    </svg>
                    <span>⚡ Autollenar Formulario con IA {modalPhotos.length > 0 ? `y ${modalPhotos.length} Fotos` : ''}</span>
                  {/if}
                </button>

                {#if rawWhatsAppText || modalPhotos.length > 0}
                  <button
                    type="button"
                    class="btn-clear-wa"
                    on:click={() => { rawWhatsAppText = ''; modalPhotos = []; waParseError = null; }}
                    disabled={isParsingWhatsApp}
                  >
                    Limpiar
                  </button>
                {/if}
              </div>

              {#if waParseError}
                <div class="eb-alert error">
                  <span>❌ {waParseError}</span>
                  <button type="button" class="alert-close" on:click={() => waParseError = null}>✕</button>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Panel 2: Subir Por Clave EasyBroker (EB-) -->
          {#if activeModal === 'easybroker'}
            <div class="modal-tab-content" id="easybroker-key-section">
              <div class="eb-input-row">
                <div class="eb-input-wrapper">
                  <input
                    type="text"
                    id="easybroker-key-input"
                    bind:value={easybrokerKey}
                    placeholder="EB-XA5895 (o clave directa ej. EB-GW0942)"
                    disabled={isFetchingEB}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        fetchEasyBrokerProperty();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  class="btn-fetch-eb"
                  on:click={fetchEasyBrokerProperty}
                  disabled={isFetchingEB || !easybrokerKey.trim()}
                >
                  {#if isFetchingEB}
                    <span class="btn-spinner"></span>
                    <span>Descargando...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span>Descargar y Llenar</span>
                  {/if}
                </button>
              </div>

              {#if ebError}
                <div class="eb-alert error">
                  <span>❌ {ebError}</span>
                  <button type="button" class="alert-close" on:click={() => ebError = null}>✕</button>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Panel 3: Subir Por Link / URL con n8n -->
          {#if activeModal === 'link'}
            <div class="modal-tab-content" id="link-parser-section">
              <div class="eb-input-row">
                <div class="eb-input-wrapper">
                  <span class="eb-prefix">🔗</span>
                  <input
                    type="url"
                    id="property-link-input"
                    bind:value={linkUrl}
                    placeholder="https://easybroker.com/listing/... o enlace de portal"
                    disabled={isSendingLink}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitPropertyLink();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  class="btn-fetch-eb btn-fetch-link"
                  on:click={submitPropertyLink}
                  disabled={isSendingLink || !linkUrl.trim()}
                >
                  {#if isSendingLink}
                    <span class="btn-spinner"></span>
                    <span>Extrayendo datos...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Extraer y Llenar</span>
                  {/if}
                </button>
              </div>

              {#if linkError}
                <div class="eb-alert error">
                  <span>❌ {linkError}</span>
                  <button type="button" class="alert-close" on:click={() => linkError = null}>✕</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if ebSuccess || waParseSuccess || linkSuccess}
    <div class="eb-alert success enhanced-alert form-top-banner">
      <div class="alert-content-block">
        <span class="alert-text">
          {#if ebSuccess}✅ {ebSuccess}
          {:else if waParseSuccess}✅ {waParseSuccess}
          {:else if linkSuccess}✅ {linkSuccess}
          {/if}
        </span>
        <div class="alert-actions-row">
          <button type="button" class="btn-alert-publish" on:click={submitDirectly} disabled={isSubmitting}>
            {#if isSubmitting}
              <span class="btn-spinner"></span>
              Publicando en CRM...
            {:else}
              🚀 Publicar en Sandbox Ahora
            {/if}
          </button>
          <button type="button" class="btn-alert-scroll" on:click={() => { ebSuccess = null; waParseSuccess = null; linkSuccess = null; }}>
            ✏️ Revisar / Continuar editando campos abajo
          </button>
        </div>
      </div>
      <button type="button" class="alert-close" on:click={() => { ebSuccess = null; waParseSuccess = null; linkSuccess = null; }}>✕</button>
    </div>
  {/if}

  <div class="form-wrapper glass">
    <form bind:this={formElement} on:submit={handleSubmit} novalidate>
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
                step={field.name === 'anioConstruccion' ? '1' : 'any'}
                min="0"
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
                      checked={Array.isArray(formData[field.name]) && formData[field.name].includes(option.value)}
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

      {#if existingImages.length > 0}
        <div class="existing-images-section">
          <div class="existing-header">
            <h3>Fotos Actuales de la Propiedad ({existingImages.length})</h3>
            <span class="existing-hint">Arrastra las imágenes para reordenarlas o usa las flechas · La primera es la <strong>Foto Principal</strong></span>
          </div>
          <div class="existing-grid">
            {#each existingImages as imgUrl, idx (imgUrl)}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="existing-item {existingDraggingIndex === idx ? 'dragging-item' : ''} {existingDragOverIndex === idx && existingDraggingIndex !== idx ? 'drop-target' : ''}"
                draggable="true"
                on:dragstart={(e) => handleExistingDragStart(e, idx)}
                on:dragenter={(e) => handleExistingDragEnter(e, idx)}
                on:dragover={(e) => handleExistingDragOver(e, idx)}
                on:dragleave={(e) => handleExistingDragLeave(e, idx)}
                on:drop={(e) => handleExistingDrop(e, idx)}
                on:dragend={handleExistingDragEnd}
              >
                <img src={imgUrl} alt="Foto {idx + 1}" draggable="false" />
                <span class="badge-index">#{idx + 1}</span>
                {#if idx === 0}
                  <span class="badge-principal">⭐ Principal</span>
                {/if}

                <!-- Quick Move Controls -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  class="quick-reorder-bar"
                  draggable="false"
                  on:pointerdown|stopPropagation
                  on:mousedown|stopPropagation
                  on:click|stopPropagation
                >
                  {#if idx > 0}
                    <button
                      type="button"
                      class="btn-nav-img"
                      title="Mover a la izquierda"
                      draggable="false"
                      on:pointerdown|stopPropagation
                      on:mousedown|stopPropagation
                      on:click|stopPropagation|preventDefault={() => moveExistingImage(idx, idx - 1)}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      class="btn-nav-img star-btn"
                      title="Hacer foto principal"
                      draggable="false"
                      on:pointerdown|stopPropagation
                      on:mousedown|stopPropagation
                      on:click|stopPropagation|preventDefault={() => moveExistingImage(idx, 0)}
                    >
                      ⭐
                    </button>
                  {/if}
                  {#if idx < existingImages.length - 1}
                    <button
                      type="button"
                      class="btn-nav-img"
                      title="Mover a la derecha"
                      draggable="false"
                      on:pointerdown|stopPropagation
                      on:mousedown|stopPropagation
                      on:click|stopPropagation|preventDefault={() => moveExistingImage(idx, idx + 1)}
                    >
                      ▶
                    </button>
                  {/if}
                </div>

                <button
                  type="button"
                  class="btn-remove-existing"
                  aria-label="Eliminar foto"
                  title="Eliminar foto"
                  draggable="false"
                  on:pointerdown|stopPropagation
                  on:mousedown|stopPropagation
                  on:click|stopPropagation|preventDefault={() => existingImages = existingImages.filter((_, i) => i !== idx)}
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <ImageUploader bind:files={selectedImages} />

      {#if uploadError}
        <div class="alert error">{uploadError}</div>
      {/if}

      {#if lastSavedProperty}
        <div class="success-card glass">
          <div class="success-header">
            <span class="success-icon">🎉</span>
            <div>
              <h3>{isEditMode ? '¡Propiedad actualizada con éxito!' : '¡Propiedad publicada con éxito!'}</h3>
              <p class="success-subtitle">{isEditMode ? 'Los cambios se han guardado correctamente en la base de datos.' : 'Registrada correctamente en la base de datos de ATAIR CRM.'}</p>
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
            {#if isEditMode && lastSavedProperty}
              <a href="/property/{encodeURIComponent(lastSavedProperty.clavePropiedad)}" class="btn-primary">
                👁️ Ver Propiedad Editada
              </a>
            {/if}
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
        <button
          type="button"
          class="btn-cancel-form"
          on:click={resetForm}
          disabled={isSubmitting}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Limpiar Formulario
        </button>

        <button type="submit" class="btn-primary" disabled={isSubmitting}>
          {#if isSubmitting}
            <span class="btn-spinner"></span>
            {isEditMode ? 'Guardando cambios...' : 'Subiendo a Firebase...'}
          {:else}
            {isEditMode ? '💾 Guardar Cambios en Propiedad' : '🚀 Publicar Propiedad en CRM'}
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

  .edit-tag {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.55rem;
    border-radius: 0.25rem;
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .btn-cancel-edit {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.15rem 0.55rem;
    border-radius: 0.25rem;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-cancel-edit:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .existing-images-section {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: rgba(17, 24, 39, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
  }

  .existing-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
  }

  .existing-header h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }

  .existing-hint {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .existing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.85rem;
  }

  .existing-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    background: #0f172a;
    border: 2px solid rgba(255, 255, 255, 0.1);
    cursor: grab;
    transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
    user-select: none;
  }

  .existing-item:hover {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
  }

  .existing-item:active {
    cursor: grabbing;
  }

  .existing-item.dragging-item {
    opacity: 0.35;
    transform: scale(0.96);
    border-color: #6366f1;
  }

  .existing-item.drop-target {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.6), 0 0 20px rgba(99, 102, 241, 0.4);
    transform: scale(1.06);
  }

  .existing-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .existing-item .badge-index {
    position: absolute;
    bottom: 0.35rem;
    left: 0.35rem;
    background: rgba(0, 0, 0, 0.75);
    color: #e2e8f0;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    backdrop-filter: blur(4px);
    pointer-events: none;
    z-index: 4;
  }

  .existing-item .badge-principal {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    background: linear-gradient(135deg, #eab308, #ca8a04);
    color: #111827;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 0.2rem 0.5rem;
    border-radius: 0.3rem;
    letter-spacing: 0.03em;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    z-index: 5;
  }

  .existing-item .quick-reorder-bar {
    position: absolute;
    bottom: 0.35rem;
    right: 0.35rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.2rem 0.35rem;
    border-radius: 0.4rem;
    opacity: 0.92;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 10;
  }

  .existing-item:hover .quick-reorder-bar {
    opacity: 1;
    transform: scale(1.04);
  }

  .existing-item .btn-nav-img {
    background: rgba(255, 255, 255, 0.14);
    color: #f8fafc;
    border: none;
    border-radius: 3px;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.15s ease;
  }

  .existing-item .btn-nav-img:hover {
    background: #6366f1;
    color: #ffffff;
    transform: scale(1.18);
  }

  .existing-item .btn-nav-img.star-btn {
    font-size: 0.72rem;
  }

  .existing-item .btn-nav-img.star-btn:hover {
    background: #eab308;
  }

  .btn-remove-existing {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    background-color: rgba(15, 23, 42, 0.82);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
    backdrop-filter: blur(4px);
  }

  .btn-remove-existing:hover {
    background-color: #ef4444;
    color: #ffffff;
    border-color: #ef4444;
    transform: scale(1.15);
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
    color: rgba(148, 163, 184, 0.38);
    font-weight: 300;
    opacity: 1;
  }

  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active,
  textarea:-webkit-autofill,
  textarea:-webkit-autofill:hover,
  textarea:-webkit-autofill:focus,
  textarea:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #1e1e35 inset !important;
    box-shadow: 0 0 0 1000px #1e1e35 inset !important;
    -webkit-text-fill-color: #f1f5f9 !important;
    caret-color: #f1f5f9 !important;
    transition: background-color 5000s ease-in-out 0s;
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
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    flex-wrap: wrap;
  }

  .btn-cancel-form {
    background: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.25);
    padding: 0.85rem 1.4rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel-form:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.45);
    color: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
  }

  .btn-cancel-form:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Modal Interactivo de Ingesta Asistida */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    animation: fadeInModal 0.2s ease-out;
  }

  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes zoomInModal {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .modal-dialog {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 1.25rem;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(99, 102, 241, 0.2);
    animation: zoomInModal 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .modal-dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 1rem;
  }

  .modal-dialog-title {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .modal-header-icon {
    font-size: 1.7rem;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
  }

  .modal-dialog-title h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .modal-dialog-title p {
    margin: 0.2rem 0 0 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .btn-modal-close {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #cbd5e1;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-modal-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .modal-method-tabs {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    background: rgba(15, 23, 42, 0.6);
    padding: 0.35rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-method-tab {
    flex: 1;
    min-width: 140px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: transparent;
    color: #94a3b8;
    border: 1px solid transparent;
    padding: 0.55rem 0.9rem;
    border-radius: 0.55rem;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-method-tab:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f8fafc;
  }

  .modal-method-tab.tab-wa.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.45);
    color: #34d399;
  }

  .modal-method-tab.tab-eb.active {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.45);
    color: #fbbf24;
  }

  .modal-method-tab.tab-link.active {
    background: rgba(99, 102, 241, 0.22);
    border-color: rgba(99, 102, 241, 0.5);
    color: #a5b4fc;
  }

  .modal-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Dropzone de fotos en el Modal */
  .modal-dropzone {
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 0.75rem;
    padding: 1.1rem;
    background: rgba(15, 23, 42, 0.5);
    transition: all 0.2s ease;
  }

  .modal-dropzone.dragging {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.12);
  }

  .dropzone-empty {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .dropzone-icon {
    font-size: 1.8rem;
  }

  .dropzone-empty p {
    margin: 0;
    font-size: 0.88rem;
    color: #cbd5e1;
  }

  .file-browse-link {
    color: #38bdf8;
    text-decoration: underline;
    cursor: pointer;
    font-weight: 600;
  }

  .dropzone-hint {
    font-size: 0.76rem;
    color: #64748b;
  }

  .dropzone-filled-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.65rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #34d399;
  }

  .btn-clear-modal-photos {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 0.78rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .modal-photos-strip {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.3rem 0;
  }

  .modal-thumb-item {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 0.45rem;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modal-thumb-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .btn-remove-thumb {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    font-size: 0.65rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-add-more-thumb {
    width: 60px;
    height: 60px;
    border-radius: 0.45rem;
    border: 1px dashed rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    color: #94a3b8;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .modal-add-more-thumb:hover {
    border-color: #38bdf8;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
  }

  .badge-ia {
    font-size: 0.7rem;
    background: rgba(16, 185, 129, 0.25);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.4);
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge-n8n {
    font-size: 0.7rem;
    background: rgba(147, 51, 234, 0.25);
    color: #c084fc;
    border: 1px solid rgba(147, 51, 234, 0.4);
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ingesta-tab-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: fadeIn 0.25s ease;
  }

  .ingesta-header {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .wa-icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 0.65rem;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .eb-icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 0.65rem;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  .link-icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 0.65rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }

  .btn-fetch-link {
    background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35) !important;
  }

  .btn-fetch-link:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5) !important;
  }


  .wa-textarea-wrapper {
    width: 100%;
  }

  .wa-textarea-wrapper textarea {
    width: 100%;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.65rem;
    padding: 0.75rem 1rem;
    color: #f8fafc;
    font-size: 0.92rem;
    line-height: 1.45;
    outline: none;
    resize: vertical;
    min-height: 90px;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .wa-textarea-wrapper textarea:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }

  .wa-actions-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-parse-wa {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 0.75rem 1.4rem;
    border-radius: 0.6rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-parse-wa:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
    filter: brightness(1.1);
  }

  .btn-parse-wa:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .btn-clear-wa {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    padding: 0.75rem 1rem;
    border-radius: 0.6rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-clear-wa:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .eb-input-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .eb-input-wrapper {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.6rem;
    padding: 0 0.5rem;
    transition: all 0.2s ease;
  }

  .eb-input-wrapper:focus-within {
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
  }

  .eb-input-wrapper input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: #f8fafc;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 0.75rem 0.5rem;
    letter-spacing: 0.5px;
  }

  .btn-fetch-eb {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    border: none;
    padding: 0.75rem 1.4rem;
    border-radius: 0.6rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-fetch-eb:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
    filter: brightness(1.1);
  }

  .btn-fetch-eb:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .eb-alert {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.88rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .eb-alert.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .eb-alert.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .top-alert-banner {
    padding: 0.9rem 1.25rem;
    border-radius: 0.65rem;
    margin-bottom: 1.25rem;
    font-size: 0.92rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }

  .top-alert-banner.info {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #93c5fd;
  }

  .top-alert-banner.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .top-alert-banner .alert-content-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.5rem;
  }

  .eb-alert.enhanced-alert {
    align-items: flex-start;
    padding: 1rem 1.1rem;
  }

  .form-top-banner {
    margin-bottom: 1.25rem;
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.18);
    border-radius: 0.75rem;
  }

  .alert-content-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .alert-text {
    line-height: 1.45;
  }

  .alert-actions-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .btn-alert-publish {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    padding: 0.55rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.35);
    transition: all 0.2s ease;
  }

  .btn-alert-publish:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 5px 14px rgba(99, 102, 241, 0.5);
    filter: brightness(1.1);
  }

  .btn-alert-publish:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-alert-scroll {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 0.55rem 0.9rem;
    border-radius: 0.5rem;
    font-size: 0.83rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-alert-scroll:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .btn-alert-eb-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(245, 158, 11, 0.18);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.45);
    padding: 0.55rem 0.95rem;
    border-radius: 0.5rem;
    font-size: 0.83rem;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-alert-eb-link:hover {
    background: rgba(245, 158, 11, 0.3);
    color: #fff;
    border-color: #f59e0b;
    transform: translateY(-1px);
  }

  .eb-colleague-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(245, 158, 11, 0.08);
    border: 1px dashed rgba(245, 158, 11, 0.35);
    padding: 0.55rem 0.85rem;
    border-radius: 0.55rem;
    margin-bottom: 0.65rem;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .eb-colleague-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.84rem;
    color: #fef3c7;
  }

  .btn-eb-colleague {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: #f59e0b;
    color: #0f172a;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    border-radius: 0.4rem;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-eb-colleague:hover {
    background: #d97706;
    color: #fff;
    transform: translateY(-1px);
  }

  .alert-close {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 1rem;
    cursor: pointer;
    padding: 0 0.25rem;
    opacity: 0.8;
  }

  .alert-close:hover {
    opacity: 1;
  }

  /* Responsive / Mobile Viewport Fixes */
  @media (max-width: 768px) {
    .page-container {
      padding: 1.25rem 0.75rem;
      width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    .page-header {
      min-width: 0;
      width: 100%;
    }

    .page-header h1 {
      font-size: 1.5rem;
    }

    .form-wrapper {
      padding: 1.25rem 0.85rem;
      border-radius: 0.85rem;
      width: 100%;
      box-sizing: border-box;
    }

    .form-grid {
      gap: 1.1rem;
      width: 100%;
    }

    .form-group {
      grid-template-columns: 1fr;
      gap: 0.4rem;
      width: 100%;
      min-width: 0;
    }

    label {
      font-size: 0.85rem;
      word-break: break-word;
    }

    input[type="text"], input[type="number"], textarea {
      font-size: 0.88rem;
      padding: 0.65rem 0.85rem;
    }

    .submit-actions {
      flex-direction: column;
    }

    .btn-primary {
      width: 100%;
      text-align: center;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .page-container {
      padding: 1rem 0.4rem;
    }

    .form-wrapper {
      padding: 1rem 0.6rem;
      border-radius: 0.75rem;
    }

    .existing-images-section {
      padding: 0.75rem 0.5rem;
    }

    .existing-grid {
      grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
      gap: 0.5rem;
    }
  }
</style>
