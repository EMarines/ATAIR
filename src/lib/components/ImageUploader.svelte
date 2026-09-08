<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy } from 'svelte';
  export let files: File[] = [];
  
  let isDragging = false;
  let dragOverIndex = -1;
  let draggingIndex = -1;

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
    }
  });

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
    if (e.dataTransfer && e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items)
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null && f.type.startsWith('image/'));
      addFiles(items);
    } else if (e.dataTransfer && e.dataTransfer.files) {
      const fls = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      addFiles(fls);
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const fls = Array.from(target.files).filter(f => f.type.startsWith('image/'));
      addFiles(fls);
      target.value = '';
    }
  }

  function addFiles(newFiles: File[]) {
    files = [...files, ...newFiles];
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  function moveFile(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= files.length || toIndex < 0 || toIndex >= files.length || fromIndex === toIndex) {
      return;
    }
    const newFiles = [...files];
    const [moved] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, moved);
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
    // Solo limpiar si salimos del elemento actual
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

<div class="uploader-container">
  <label for="file-input">Subir Imágenes de la Propiedad</label>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="dropzone {isDragging ? 'dragging' : ''}"
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:dragover={handleDragOver}
    on:drop={handleDrop}
  >
    <div class="dropzone-content">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <p>Arrastra y suelta imágenes aquí</p>
      <p class="text-small">o</p>
      <button type="button" class="btn-secondary" on:click={() => document.getElementById('file-input')?.click()}>
        Explorar Archivos
      </button>
      <input id="file-input" type="file" multiple accept="image/*" on:change={handleFileInput} style="display: none;" />
    </div>
  </div>

  {#if files.length > 0}
    <div class="reorder-header">
      <p class="reorder-hint">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line></svg>
        <span>Arrastra las imágenes para reordenarlas ({files.length} fotos) · La primera será la <strong>Foto Principal</strong></span>
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

          {#if i === 0}
            <span class="badge-principal">⭐ Principal</span>
          {/if}

          <!-- Quick Move Controls on Hover -->
          <div class="quick-reorder-bar">
            {#if i > 0}
              <button
                type="button"
                class="btn-nav-img"
                title="Mover a la izquierda"
                on:click|stopPropagation={() => moveFile(i, i - 1)}
              >
                ◀
              </button>
              <button
                type="button"
                class="btn-nav-img star-btn"
                title="Hacer foto principal"
                on:click|stopPropagation={() => makePrincipal(i)}
              >
                ⭐
              </button>
            {/if}
            {#if i < files.length - 1}
              <button
                type="button"
                class="btn-nav-img"
                title="Mover a la derecha"
                on:click|stopPropagation={() => moveFile(i, i + 1)}
              >
                ▶
              </button>
            {/if}
          </div>

          <button
            type="button"
            class="remove-btn"
            aria-label="Remover"
            on:click|stopPropagation={() => removeFile(i)}
            title="Eliminar foto"
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
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-secondary, #cbd5e1);
  }

  .dropzone {
    border: 2px dashed var(--border-color, rgba(99, 102, 241, 0.3));
    border-radius: 1rem;
    padding: 2.5rem 1.5rem;
    text-align: center;
    background-color: rgba(15, 23, 42, 0.4);
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .dropzone.dragging {
    border-color: var(--primary, #6366f1);
    background-color: rgba(79, 70, 229, 0.15);
  }

  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary, #94a3b8);
  }

  .text-small {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .btn-secondary {
    background-color: transparent;
    border: 1px solid var(--primary, #6366f1);
    color: var(--primary, #818cf8);
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease;
  }

  .btn-secondary:hover {
    background-color: rgba(99, 102, 241, 0.15);
    transform: translateY(-1px);
  }

  .reorder-hint {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-secondary, #94a3b8);
    opacity: 0.75;
    margin-top: 1rem;
    margin-bottom: 0.25rem;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.85rem;
    margin-top: 0.5rem;
  }

  .preview-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 2px solid transparent;
    cursor: grab;
    transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
    user-select: none;
    background: #111827;
  }

  .preview-item:hover {
    border-color: var(--primary, #6366f1);
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.25);
  }

  .preview-item:active {
    cursor: grabbing;
  }

  .preview-item.dragging-item {
    opacity: 0.35;
    transform: scale(0.96);
    border-color: var(--primary, #6366f1);
  }

  .preview-item.drop-target {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.6), 0 0 20px rgba(99, 102, 241, 0.4);
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
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .reorder-hint {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.82rem;
    color: #cbd5e1;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.25);
    padding: 0.4rem 0.85rem;
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

  .quick-reorder-bar {
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

  .preview-item:hover .quick-reorder-bar {
    opacity: 1;
  }

  .btn-nav-img {
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

  .btn-nav-img:hover {
    background: #6366f1;
    color: #ffffff;
    transform: scale(1.15);
  }

  .btn-nav-img.star-btn {
    font-size: 0.72rem;
  }

  .btn-nav-img.star-btn:hover {
    background: #eab308;
  }

  .badge-principal {
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

  .remove-btn {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
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

  .remove-btn:hover {
    background-color: #ef4444;
    transform: scale(1.1);
  }

</style>
