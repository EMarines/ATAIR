import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export function mapEasyBrokerToFirestore(eb: any) {
  // 1. Extract operations
  const saleOp = eb.operations?.find((o: any) => o.type === 'sale');
  const rentalOp = eb.operations?.find((o: any) => o.type === 'rental');
  const primaryOp = saleOp ?? rentalOp ?? eb.operations?.[0] ?? null;

  const rawOperations = Array.isArray(eb.operations) && eb.operations.length > 0
    ? eb.operations
    : primaryOp
      ? [primaryOp]
      : [];

  // 2. Extract full photo gallery
  const rawImages = eb.property_images || eb.images || [];
  const imageUrls = rawImages
    .map((img: any) => (typeof img === 'string' ? img : img?.url))
    .filter(Boolean);

  if (imageUrls.length === 0 && eb.title_image_full) {
    imageUrls.push(eb.title_image_full);
  }

  const primaryImage = imageUrls[0] ?? eb.title_image_full ?? '';
  const thumbImage = eb.title_image_thumb ?? (imageUrls[0] ? `${imageUrls[0]}&width=200` : '') ?? '';

  // 3. Extract location
  let locationStr = '';
  let locationObj = null;
  if (typeof eb.location === 'object' && eb.location !== null) {
    locationObj = eb.location;
    locationStr = eb.location.name || [eb.location.street, eb.location.city, eb.location.region].filter(Boolean).join(', ');
  } else if (typeof eb.location === 'string') {
    locationStr = eb.location;
    locationObj = { name: eb.location };
  }

  // 4. Extract amenities, features and tags
  const featuresList = Array.isArray(eb.features)
    ? eb.features.map((f: any) => (typeof f === 'string' ? f : f?.name)).filter(Boolean)
    : [];
  const tagsList = Array.isArray(eb.tags) ? eb.tags : [];
  const combinedAmenities = Array.from(new Set([...featuresList, ...tagsList]));

  // 5. Operation type normalization
  const opTypeRaw = primaryOp?.type ?? '';
  const tipoOperacionEs = opTypeRaw === 'sale' ? 'Venta' : opTypeRaw === 'rental' ? 'Renta' : (opTypeRaw || '');

  // 6. Price formatting
  const priceAmount = primaryOp?.amount ?? null;
  const currencyVal = primaryOp?.currency ?? 'MXN';
  const formattedPrice = primaryOp?.formatted_amount || (priceAmount ? `$${Number(priceAmount).toLocaleString('es-MX')} ${currencyVal}` : '');

  // 7. Agent normalization
  const agentName = typeof eb.agent === 'object' && eb.agent !== null ? (eb.agent.name ?? '') : (eb.agent ?? '');

  return {
    // === IDENTIFIERS ===
    id: eb.public_id ?? '',
    public_id: eb.public_id ?? '',
    clavePropiedad: eb.public_id ?? '',
    easybroker_id: eb.public_id ?? '',
    source: 'easybroker',
    sourceName: 'MatchHome (EasyBroker)',

    // === TITLE & DESCRIPTION ===
    title: eb.title ?? '',
    titulo: eb.title ?? '',
    description: eb.description ?? '',
    descripcion: eb.description ?? '',

    // === PROPERTY TYPE & OPERATIONS ===
    property_type: eb.property_type ?? '',
    tipoPropiedad: eb.property_type ?? '',
    operation_type: opTypeRaw,
    tipoOperacion: tipoOperacionEs,
    operations: rawOperations,
    operaciones: rawOperations,

    // === SPECS & DIMENSIONS ===
    bedrooms: eb.bedrooms ?? null,
    recamaras: eb.bedrooms ?? null,
    bathrooms: eb.bathrooms ?? null,
    banos: eb.bathrooms ?? null,
    half_bathrooms: eb.half_bathrooms ?? null,
    mediosBanos: eb.half_bathrooms ?? null,
    parking_spaces: eb.parking_spaces ?? null,
    estacionamientos: eb.parking_spaces ?? null,
    lot_size: eb.lot_size ?? null,
    terreno: eb.lot_size ?? null,
    construction_size: eb.construction_size ?? null,
    construccion: eb.construction_size ?? null,
    floors: eb.floors ?? null,
    age: eb.age ?? null,

    // === PRICE & CURRENCY ===
    price: priceAmount,
    precio: priceAmount,
    currency: currencyVal,
    moneda: currencyVal,
    formatted_amount: formattedPrice,
    precioFormateado: formattedPrice,
    unit: primaryOp?.unit ?? 'total',
    unidadPrecio: primaryOp?.unit ?? 'total',

    // === LOCATION ===
    location: locationObj || locationStr,
    colonia: locationStr,
    ubicacion: locationStr,

    // === AGENT ===
    agent: eb.agent ?? agentName,
    agente: agentName,

    // === IMAGES & MEDIA ===
    title_image_full: primaryImage,
    title_image_thumb: thumbImage,
    imagenPrincipal: primaryImage,
    imagenMiniatura: thumbImage,
    images: imageUrls,
    property_images: rawImages.length > 0 ? rawImages : imageUrls.map((url: string) => ({ title: '', url })),

    // === TAGS & AMENITIES ===
    tags: tagsList,
    features: featuresList,
    amenidades: combinedAmenities,

    // === EASYBROKER METADATA ===
    show_prices: eb.show_prices ?? true,
    share_commission: eb.share_commission ?? false,
    public_url: eb.public_url ?? '',
    created_at: eb.created_at ?? null,
    updated_at: eb.updated_at ?? null,
    createdAtEasybroker: eb.created_at ?? null,
    updatedAtEasybroker: eb.updated_at ?? null,

    // === TIMESTAMPS ===
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    syncedAt: serverTimestamp(),
  };
}

export async function syncEasyBrokerProperties(
  db: Firestore, 
  onProgress?: (progress: { phase: 'fetching' | 'reading' | 'writing'; saved?: number; total?: number }) => void
) {
  onProgress?.({ phase: 'fetching' });
  const res = await fetch('/api/sync-easybroker');
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `Error al consultar EasyBroker: ${res.status}`);
  }
  const data = await res.json();
  const ebProperties: any[] = data.properties ?? [];

  onProgress?.({ phase: 'reading' });
  const snap = await getDocs(collection(db, 'properties'));
  
  const existingDocsMap = new Map<string, any>();
  snap.docs.forEach((d) => {
    existingDocsMap.set(d.id, { docId: d.id, ref: d.ref, ...d.data() });
  });

  const currentEBIds = new Set(ebProperties.map((p) => p.public_id).filter(Boolean));

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let deleted = 0;

  const operations: Array<{ type: 'set'; ref: any; data: any } | { type: 'delete'; ref: any }> = [];

  for (const eb of ebProperties) {
    if (!eb.public_id) continue;
    const docRef = doc(collection(db, 'properties'), eb.public_id);
    const existing = existingDocsMap.get(eb.public_id);

    if (!existing) {
      added++;
      operations.push({
        type: 'set',
        ref: docRef,
        data: mapEasyBrokerToFirestore(eb),
      });
    } else {
      const ebUpdated = eb.updated_at ?? null;
      const dbUpdated = existing.updatedAtEasybroker ?? existing.updated_at ?? null;
      const existingImagesCount = Array.isArray(existing.images) ? existing.images.length : 0;
      const ebImagesCount = (eb.property_images || eb.images || []).length;

      const needsGalleryUpgrade = ebImagesCount > 1 && existingImagesCount <= 1;
      const isMissingDualFields = !existing.public_id || !existing.operations || !existing.title || !existing.createdAt;

      if (!dbUpdated || dbUpdated !== ebUpdated || existing.source !== 'easybroker' || needsGalleryUpgrade || isMissingDualFields) {
        updated++;
        operations.push({
          type: 'set',
          ref: docRef,
          data: mapEasyBrokerToFirestore(eb),
        });
      } else {
        unchanged++;
      }
    }
  }

  snap.docs.forEach((d) => {
    const data = d.data();
    const isEasyBrokerDoc = data.source === 'easybroker' || d.id.startsWith('EB-') || Boolean(data.easybroker_id);
    
    if (isEasyBrokerDoc && !currentEBIds.has(d.id) && !currentEBIds.has(data.easybroker_id) && !currentEBIds.has(data.clavePropiedad) && !currentEBIds.has(data.public_id)) {
      deleted++;
      operations.push({
        type: 'delete',
        ref: d.ref,
      });
    }
  });

  onProgress?.({ phase: 'writing', saved: 0, total: operations.length });
  const BATCH_SIZE = 400;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + BATCH_SIZE);
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data, { merge: true });
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
    onProgress?.({ phase: 'writing', saved: Math.min(i + chunk.length, operations.length), total: operations.length });
  }

  return {
    totalFetched: ebProperties.length,
    added,
    updated,
    deleted,
    unchanged,
    totalInDb: snap.size + added - deleted,
  };
}
