<script lang="ts">
  export let files: File[] = [];
  
  let isDragging = false;
  let dragOverIndex = -1;
  let draggingIndex = -1;

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
    }
  }

  function addFiles(newFiles: File[]) {
    files = [...files, ...newFiles];
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  // --- Drag to reorder ---
  function handleItemDragStart(e: DragEvent, index: number) {
    draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleItemDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (index !== draggingIndex) {
      dragOverIndex = index;
    }
  }

  function handleItemDrop(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggingIndex !== -1 && draggingIndex !== index) {
      const newFiles = [...files];
      const [moved] = newFiles.splice(draggingIndex, 1);
      newFiles.splice(index, 0, moved);
      files = newFiles;
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
    <p class="reorder-hint">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line></svg>
      Arrastra las imágenes para reordenarlas
    </p>
    <div class="preview-grid">
      {#each files as file, i}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="preview-item {draggingIndex === i ? 'dragging-item' : ''} {dragOverIndex === i && draggingIndex !== i ? 'drop-target' : ''}"
          draggable="true"
          on:dragstart={(e) => handleItemDragStart(e, i)}
          on:dragover={(e) => handleItemDragOver(e, i)}
          on:drop={(e) => handleItemDrop(e, i)}
          on:dragend={handleItemDragEnd}
        >
          <img src={URL.createObjectURL(file)} alt="Preview {i}" draggable="false" />
          <div class="drag-handle" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
          </div>
          {#if i === 0}
            <span class="badge-principal">Principal</span>
          {/if}
          <button type="button" class="remove-btn" aria-label="Remover" on:click={() => removeFile(i)}>×</button>
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
    border-color: var(--primary, #6366f1);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.5);
    transform: scale(1.04);
  }

  .preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .drag-handle {
    position: absolute;
    bottom: 0.3rem;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    opacity: 0;
    transition: opacity 0.2s;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
    pointer-events: none;
  }

  .preview-item:hover .drag-handle {
    opacity: 1;
  }

  .badge-principal {
    position: absolute;
    top: 0.3rem;
    left: 0.3rem;
    background-color: var(--primary, #6366f1);
    color: white;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    pointer-events: none;
  }

  .remove-btn {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background-color: rgba(0, 0, 0, 0.65);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .remove-btn:hover {
    background-color: var(--error, #ef4444);
  }
</style>
