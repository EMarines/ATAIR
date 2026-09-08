<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { db, storage, prodStorage, isSandbox } from '$lib/firebase_toggle';
  import {
    collection,
    addDoc,
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
          amenidades: tagToFeatures(Array.isArray(foundDoc.tags) ? foundDoc.tags : (Array.isArray(foundDoc.features) ? foundDoc.features : (Array.isArray(foundDoc.amenidades) ? foundDoc.amenidades : []))),
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

  onMount(() => {
    const editId = $page.url.searchParams.get('edit');
    if (editId) {
      loadPropertyToEdit(editId);
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
      const telefonoContactoCaptador = formData.telefonoContactoCaptador ? String(formData.telefonoContactoCaptador).replace(/\D/g, '').trim() : '';
      const nombreContactoCaptador = formData.nombreContactoCaptador ? String(formData.nombreContactoCaptador).trim() : '';
      const companiaCaptadora = formData.companiaCaptadora ? String(formData.companiaCaptadora).trim() : idCompaniaCaptadora;
      const clavePropiedad = await generatePropertyKey(procedenciaCode);

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

      const primaryImg = imageUrls[0] ?? '';
      const opType = formData.tipoOperacion ?? 'Venta';
      const isSale = String(opType).toLowerCase().includes('venta') || String(opType).toLowerCase() === 'sale';
      const numPrice = formData.precio ? Number(formData.precio) : null;
      const cur = formData.moneda || 'MXN';

      if (isEditMode && editingDocId) {
        uploadStatus = 'Actualizando cambios de la propiedad...';
        const finalImages = [...existingImages, ...imageUrls];
        const primaryImg = finalImages[0] ?? '';

        await updateDoc(doc(db, 'properties', editingDocId), {
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

        existingImages = finalImages;
        selectedImages = [];
        lastSavedProperty = {
          clavePropiedad: editingClave || 'Propiedad',
          titulo: formData.titulo || 'Sin título',
          procedenciaNombre,
          idCompaniaCaptadora: companiaCaptadora || idCompaniaCaptadora,
          telefonoContactoCaptador,
        };
        uploadStatus = `¡Propiedad ${editingClave} actualizada exitosamente!`;
      } else {
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
          ubicacion: formData.ubicacion ?? '',
          zona: formData.ubicacion ?? '',
          locaProperty: formData.ubicacion ? [formData.ubicacion] : [],

          imagenPrincipal: primaryImg,
          imagenMiniatura: primaryImg,
          title_image_full: primaryImg,
          title_image_thumb: primaryImg,
          images: imageUrls,
          property_images: imageUrls.map(url => ({ title: '', url })),

          tags: formData.ubicacion ? [...(formData.amenidades ?? []), formData.ubicacion] : (formData.amenidades ?? []),
          features: formData.amenidades ?? [],

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          created_at: Date.now(),
          updated_at: Date.now(),
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
                {#if idx === 0}
                  <span class="badge-principal">⭐ Principal</span>
                {/if}

                <!-- Quick Move Controls on Hover -->
                <div class="quick-reorder-bar">
                  {#if idx > 0}
                    <button
                      type="button"
                      class="btn-nav-img"
                      title="Mover a la izquierda"
                      on:click|stopPropagation={() => moveExistingImage(idx, idx - 1)}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      class="btn-nav-img star-btn"
                      title="Hacer foto principal"
                      on:click|stopPropagation={() => moveExistingImage(idx, 0)}
                    >
                      ⭐
                    </button>
                  {/if}
                  {#if idx < existingImages.length - 1}
                    <button
                      type="button"
                      class="btn-nav-img"
                      title="Mover a la derecha"
                      on:click|stopPropagation={() => moveExistingImage(idx, idx + 1)}
                    >
                      ▶
                    </button>
                  {/if}
                </div>

                <button
                  type="button"
                  class="btn-remove-existing"
                  on:click|stopPropagation={() => existingImages = existingImages.filter((_, i) => i !== idx)}
                  title="Eliminar esta foto"
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

  .existing-item .badge-principal {
    position: absolute;
    top: 0.3rem;
    left: 0.3rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 0.62rem;
    font-weight: 700;
    padding: 0.18rem 0.45rem;
    border-radius: 0.3rem;
    letter-spacing: 0.04em;
    pointer-events: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    z-index: 5;
  }

  .existing-item .quick-reorder-bar {
    position: absolute;
    bottom: 0.35rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 0.18rem 0.35rem;
    border-radius: 9999px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .existing-item:hover .quick-reorder-bar {
    opacity: 1;
  }

  .existing-item .btn-nav-img {
    background: rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    border: none;
    border-radius: 4px;
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.15s ease;
  }

  .existing-item .btn-nav-img:hover {
    background: #6366f1;
    color: #ffffff;
    transform: scale(1.15);
  }

  .existing-item .btn-nav-img.star-btn {
    font-size: 0.72rem;
  }

  .existing-item .btn-nav-img.star-btn:hover {
    background: #eab308;
  }

  .btn-remove-existing {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease;
    z-index: 10;
  }

  .btn-remove-existing:hover {
    background-color: #ef4444;
    transform: scale(1.1);
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
