<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  export let files: File[] = [];
  
  let isDragging = false;
  let dragOverIndex = -1;
  let draggingIndex = -1;
  let pasteFeedback = '';
  let pasteTimeout: any = null;

  // Lista sincronizada de URLs para las vistas previas con ID estable
  let fileUrls: { file: File; url: string; id: string }[] = [];
  let nextId = 0;

  $: if (browser && files) {
    const existingMap = new Map(fileUrls.map(item => [item.file, item]));
    const updated: { file: File; url: string; id: string }[] = [];

    for (const file of files) {
      if (existingMap.has(file)) {
        updated.push(existingMap.get(file)!);
      } else {
        updated.push({
          file,
          url: URL.createObjectURL(file),
          id: `f_${++nextId}_${Math.random().toString(36).slice(2, 7)}`
        });
      }
    }

    // Revocar las URLs de archivos que ya no existen
    for (const [file, item] of existingMap.entries()) {
      if (!files.includes(file)) {
        URL.revokeObjectURL(item.url);
      }
    }

    fileUrls = updated;
  }

  onDestroy(() => {
    if (browser) {
      fileUrls.forEach(item => URL.revokeObjectURL(item.url));
      fileUrls = [];
      if (pasteTimeout) clearTimeout(pasteTimeout);
    }
  });

  function extractImageFiles(dataTransfer: DataTransfer | null): File[] {
    if (!dataTransfer) return [];
    const result: File[] = [];

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (const item of Array.from(dataTransfer.items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && isImageFile(file)) {
            result.push(file);
          }
        }
      }
    }

    if (result.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
      for (const file of Array.from(dataTransfer.files)) {
        if (isImageFile(file)) {
          result.push(file);
        }
      }
    }

    return result;
  }

  function isImageFile(file: File): boolean {
    if (!file) return false;
    if (file.type && file.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|webp|avif|gif|bmp|heic|tiff|svg)$/i.test(file.name || '');
  }

  function showPasteNotification(count: number) {
    pasteFeedback = `📋✨ ¡${count} imagen${count === 1 ? '' : 'es'} pegada${count === 1 ? '' : 's'} con éxito!`;
    if (pasteTimeout) clearTimeout(pasteTimeout);
    pasteTimeout = setTimeout(() => {
      pasteFeedback = '';
    }, 4000);
  }

  async function pasteFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        const pastedFiles: File[] = [];

        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const ext = type.split('/')[1] || 'png';
              const file = new File(
                [blob],
                `foto_pegada_${Date.now()}_${pastedFiles.length + 1}.${ext}`,
                { type }
              );
              pastedFiles.push(file);
            }
          }
        }

        if (pastedFiles.length > 0) {
          addFiles(pastedFiles);
          showPasteNotification(pastedFiles.length);
          return;
        }
      }

      pasteFeedback = '💡 Haz clic en este recuadro y presiona Ctrl + V en tu teclado para vaciar las fotos copiadas.';
      if (pasteTimeout) clearTimeout(pasteTimeout);
      pasteTimeout = setTimeout(() => {
        pasteFeedback = '';
      }, 5000);
    } catch (err) {
      console.warn('Clipboard read permission/error:', err);
      pasteFeedback = '💡 Presiona Ctrl + V en tu teclado para pegar las fotos copiadas.';
      if (pasteTimeout) clearTimeout(pasteTimeout);
      pasteTimeout = setTimeout(() => {
        pasteFeedback = '';
      }, 5000);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) return;

    // Si el usuario está escribiendo dentro de un input o textarea y no pegó archivos de imagen, no intervenir
    const target = e.target as HTMLElement | null;
    const isTextInput = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    const imgFiles = extractImageFiles(e.clipboardData);
    if (imgFiles.length > 0) {
      e.preventDefault();
      addFiles(imgFiles);
      showPasteNotification(imgFiles.length);
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const items = extractImageFiles(e.dataTransfer);
    if (items.length > 0) {
      addFiles(items);
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const fls = Array.from(target.files).filter(isImageFile);
      addFiles(fls);
      target.value = '';
    }
  }

  function addFiles(newFiles: File[]) {
    files = [...files, ...newFiles];
  }

  function removeFile(index: number) {
    if (index < 0 || index >= files.length) return;
    const newFiles = [...files];
    newFiles.splice(index, 1);
    const newUrls = [...fileUrls];
    const [removedUrl] = newUrls.splice(index, 1);
    if (removedUrl) URL.revokeObjectURL(removedUrl.url);
    fileUrls = newUrls;
    files = newFiles;
  }

  function moveFile(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= files.length || toIndex < 0 || toIndex >= files.length || fromIndex === toIndex) {
      return;
    }
    const newFiles = [...files];
    const [movedFile] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, movedFile);

    const newUrls = [...fileUrls];
    const [movedUrl] = newUrls.splice(fromIndex, 1);
    newUrls.splice(toIndex, 0, movedUrl);

    fileUrls = newUrls;
    files = newFiles;
  }

  function makePrincipal(index: number) {
    moveFile(index, 0);
  }

  // --- Drag to reorder ---
  function handleItemDragStart(e: DragEvent, index: number) {
    draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.setData('application/x-img-index', String(index));
    }
  }

  function handleItemDragEnter(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggingIndex !== -1 && draggingIndex !== index) {
      dragOverIndex = index;
    }
  }

  function handleItemDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (draggingIndex !== -1 && draggingIndex !== index) {
      dragOverIndex = index;
    }
  }

  function handleItemDragLeave(e: DragEvent, index: number) {
    if (dragOverIndex === index) {
      dragOverIndex = -1;
    }
  }

  function handleItemDrop(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    
    let fromIndex = draggingIndex;
    if (e.dataTransfer) {
      const dtData = e.dataTransfer.getData('application/x-img-index') || e.dataTransfer.getData('text/plain');
      if (dtData && !isNaN(Number(dtData))) {
        fromIndex = parseInt(dtData, 10);
      }
    }

    if (fromIndex !== -1 && fromIndex !== index && fromIndex >= 0 && fromIndex < files.length && index >= 0 && index < files.length) {
      moveFile(fromIndex, index);
    }
    draggingIndex = -1;
    dragOverIndex = -1;
  }

  function handleItemDragEnd() {
    draggingIndex = -1;
    dragOverIndex = -1;
  }
</script>

<svelte:window on:paste={handlePaste} />

<div class="uploader-container">
  <div class="uploader-header-row">
    <label for="file-input">Subir Imágenes de la Propiedad</label>
    <div class="header-action-buttons">
      <button type="button" class="btn-quick-paste" on:click={pasteFromClipboard} title="Pegar fotos copiadas del portapapeles">
        📋 Pegar Fotos (<kbd>Ctrl+V</kbd>)
      </button>
    </div>
  </div>

  {#if pasteFeedback}
    <div class="paste-toast" transition:fade={{ duration: 150 }}>
      {pasteFeedback}
    </div>
  {/if}

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="dropzone {isDragging ? 'dragging' : ''}"
    tabindex="0"
    role="region"
    aria-label="Zona para arrastrar, soltar o pegar imágenes"
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:dragover={handleDragOver}
    on:drop={handleDrop}
    on:paste={handlePaste}
  >
    <div class="dropzone-content">
      <div class="dropzone-icon-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>

      <p class="dropzone-title">Arrastra y suelta imágenes aquí, o copia y pega</p>
      <p class="text-small">Puedes copiar fotos desde cualquier carpeta de tu computadora y pegarlas aquí</p>

      <div class="dropzone-buttons-row">
        <button type="button" class="btn-browse" on:click={() => document.getElementById('file-input')?.click()}>
          📁 Explorar Archivos
        </button>

        <button type="button" class="btn-paste-cta" on:click={pasteFromClipboard}>
          📋 Pegar Fotos (<kbd>Ctrl+V</kbd>)
        </button>
      </div>

      <input id="file-input" type="file" multiple accept="image/*" on:change={handleFileInput} style="display: none;" />
    </div>
  </div>

  {#if files.length > 0}
    <div class="reorder-header">
      <p class="reorder-hint">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line></svg>
        <span><strong>{files.length} fotos cargadas:</strong> Usa las flechas ◀ ▶ para mover o ⭐ para hacerla Principal · La #1 es la <strong>Foto Principal</strong></span>
      </p>
    </div>

    <div class="preview-grid">
      {#each fileUrls as item, i (item.id)}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="preview-item {draggingIndex === i ? 'dragging-item' : ''} {dragOverIndex === i && draggingIndex !== i ? 'drop-target' : ''}"
          draggable="true"
          on:dragstart={(e) => handleItemDragStart(e, i)}
          on:dragenter={(e) => handleItemDragEnter(e, i)}
          on:dragover={(e) => handleItemDragOver(e, i)}
          on:dragleave={(e) => handleItemDragLeave(e, i)}
          on:drop={(e) => handleItemDrop(e, i)}
          on:dragend={handleItemDragEnd}
        >
          <img
            src={item.url}
            alt="Vista previa {i + 1}"
            draggable="false"
          />

          <span class="badge-index">#{i + 1}</span>

          {#if i === 0}
            <span class="badge-principal">⭐ Principal</span>
          {/if}

          <!-- Quick Move Controls (Con protección contra intercepción de drag) -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="quick-reorder-bar"
            draggable="false"
            on:pointerdown|stopPropagation
            on:mousedown|stopPropagation
            on:click|stopPropagation
          >
            {#if i > 0}
              <button
                type="button"
                class="btn-nav-img"
                title="Mover a la izquierda"
                draggable="false"
                on:pointerdown|stopPropagation
                on:mousedown|stopPropagation
                on:click|stopPropagation|preventDefault={() => moveFile(i, i - 1)}
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
                on:click|stopPropagation|preventDefault={() => makePrincipal(i)}
              >
                ⭐
              </button>
            {/if}
            {#if i < files.length - 1}
              <button
                type="button"
                class="btn-nav-img"
                title="Mover a la derecha"
                draggable="false"
                on:pointerdown|stopPropagation
                on:mousedown|stopPropagation
                on:click|stopPropagation|preventDefault={() => moveFile(i, i + 1)}
              >
                ▶
              </button>
            {/if}
          </div>

          <button
            type="button"
            class="remove-btn"
            aria-label="Eliminar foto"
            title="Eliminar foto"
            draggable="false"
            on:pointerdown|stopPropagation
            on:mousedown|stopPropagation
            on:click|stopPropagation|preventDefault={() => removeFile(i)}
          >
            ✕
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .uploader-container {
    margin-bottom: 2rem;
  }

  .uploader-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  label {
    margin-bottom: 0;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-secondary, #cbd5e1);
  }

  .header-action-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-quick-paste {
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #c7d2fe;
    padding: 0.35rem 0.8rem;
    border-radius: 0.5rem;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    transition: all 0.2s ease;
  }

  .btn-quick-paste:hover {
    background: rgba(99, 102, 241, 0.3);
    border-color: #818cf8;
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-quick-paste kbd,
  .btn-paste-cta kbd {
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    font-size: 0.72rem;
    font-family: monospace;
    color: #ffffff;
  }

  .paste-toast {
    background: rgba(16, 185, 129, 0.18);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: #34d399;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  }

  .dropzone {
    border: 2px dashed rgba(99, 102, 241, 0.35);
    border-radius: 1rem;
    padding: 2.25rem 1.5rem;
    text-align: center;
    background-color: rgba(15, 23, 42, 0.45);
    transition: all 0.25s ease;
    cursor: pointer;
    outline: none;
  }

  .dropzone:focus,
  .dropzone:hover {
    border-color: #818cf8;
    background-color: rgba(30, 27, 75, 0.35);
  }

  .dropzone.dragging {
    border-color: #a855f7;
    background-color: rgba(168, 85, 247, 0.18);
    box-shadow: 0 0 24px rgba(168, 85, 247, 0.25);
  }

  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary, #94a3b8);
  }

  .dropzone-icon-badge {
    width: 56px;
    height: 56px;
    border-radius: 1rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #818cf8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dropzone-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .text-small {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .dropzone-buttons-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .btn-browse {
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #f1f5f9;
    padding: 0.6rem 1.35rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s ease;
  }

  .btn-browse:hover {
    background-color: rgba(255, 255, 255, 0.16);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-paste-cta {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
    border: 1px solid rgba(168, 85, 247, 0.45);
    color: #e9d5ff;
    padding: 0.6rem 1.35rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s ease;
  }

  .btn-paste-cta:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(168, 85, 247, 0.5));
    border-color: #c084fc;
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(168, 85, 247, 0.25);
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 1rem;
    margin-top: 0.75rem;
  }

  .preview-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 0.6rem;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.12);
    cursor: grab;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    user-select: none;
    background: #111827;
  }

  .preview-item:hover {
    border-color: #818cf8;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    transform: translateY(-2px);
  }

  .preview-item:active {
    cursor: grabbing;
  }

  .preview-item.dragging-item {
    opacity: 0.35;
    transform: scale(0.94);
    border-color: #6366f1;
  }

  .preview-item.drop-target {
    border-color: #a855f7;
    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.6), 0 0 20px rgba(168, 85, 247, 0.4);
    transform: scale(1.06);
  }

  .preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .reorder-header {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .reorder-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #e2e8f0;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    margin: 0;
  }

  .reorder-hint svg {
    color: #818cf8;
    flex-shrink: 0;
  }

  .reorder-hint strong {
    color: #a5b4fc;
  }

  .badge-index {
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

  .quick-reorder-bar {
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

  .preview-item:hover .quick-reorder-bar {
    opacity: 1;
    transform: scale(1.04);
  }

  .btn-nav-img {
    background: rgba(255, 255, 255, 0.14);
    color: #f8fafc;
    border: none;
    border-radius: 3px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.15s ease;
  }

  .btn-nav-img:hover {
    background: #6366f1;
    color: #ffffff;
    transform: scale(1.18);
  }

  .btn-nav-img.star-btn {
    font-size: 0.8rem;
  }

  .btn-nav-img.star-btn:hover {
    background: #eab308;
    color: #111827;
  }

  .badge-principal {
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

  .remove-btn {
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

  .remove-btn:hover {
    background-color: #ef4444;
    color: #ffffff;
    border-color: #ef4444;
    transform: scale(1.15);
  }
</style>
