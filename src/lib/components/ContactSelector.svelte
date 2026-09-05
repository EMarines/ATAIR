<script lang="ts">
  import { db } from '$lib/firebase_toggle';
  import { collection, getDocs } from 'firebase/firestore';
  import { onMount } from 'svelte';

  export let value: string = '';
  export let contactId: string = '';
  export let contactPhone: string = '';
  export let contactName: string = '';
  export let companyName: string = '';
  export let procedencia: string = 'MH';
  export let placeholder: string = 'Buscar agente o inmobiliaria...';
  export let onSelectContact: ((contact: any) => void) | undefined = undefined;
  export let onSelectProcedencia: ((proc: string) => void) | undefined = undefined;

  const PINNED_COMPANIES = [
    {
      id: 'pinned-mh',
      _fullName: 'Match Home',
      _company: 'Match Home',
      _notes: 'Procedencia directa Match Home',
      _procedencia: 'MH',
      _phone: '',
      _isAgent: true
    },
    {
      id: 'pinned-jgcapital',
      _fullName: 'JGCapital',
      _company: 'JGCapital',
      _notes: 'Alianza Sinergia 1 (S1)',
      _procedencia: 'S1',
      _phone: '',
      _isAgent: true
    },
    {
      id: 'pinned-agh',
      _fullName: 'AGH Inmobiliaria',
      _company: 'AGH Inmobiliaria',
      _notes: 'Alianza Sinergia 1 (S1)',
      _procedencia: 'S1',
      _phone: '',
      _isAgent: true
    }
  ];

  let contacts: any[] = [...PINNED_COMPANIES];
  let isLoading = false;
  let searchTerm = '';
  let isOpen = false;
  let selectedContact: any = null;
  let inputElement: HTMLInputElement | null = null;

  $: isSynergyMode = procedencia === 'S1' || procedencia === 'S2' || procedencia === 'S3';

  $: {
    if (value && (!selectedContact || getContactLabel(selectedContact) !== value)) {
      const match = contacts.find(c => getContactLabel(c) === value || c._fullName === value || c.id === value);
      if (match) {
        selectedContact = match;
        contactId = match.id || '';
        contactPhone = match._phone || '';
        contactName = match._fullName || '';
        companyName = match._company || '';
        if (match._procedencia && onSelectProcedencia) {
          onSelectProcedencia(match._procedencia);
        }
      } else if (!selectedContact) {
        selectedContact = {
          id: contactId || '',
          _fullName: value,
          _company: companyName || '',
          _phone: contactPhone || '',
          _procedencia: procedencia || 'MH',
          _notes: 'Captador inicial'
        };
      }
    }
  }

  $: filteredContacts = (() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) {
      // SOLO proponer a los que sean Agente Inmobiliario, inmobiliarias o aliados fijados
      return contacts.filter(c => c._isAgent || c._procedencia || (c.id && c.id.startsWith('pinned-'))).slice(0, 25);
    }
    // Pero si usas el input de buscar, buscar en TODO el universo de contactos
    return contacts.filter(c => {
      const name = (c._fullName || '').toLowerCase();
      const comp = (c._company || '').toLowerCase();
      const notes = (c._notes || '').toLowerCase();
      const proc = (c._procedencia || '').toLowerCase();
      const phone = (c._phone || '').toLowerCase();
      const type = (c.typeContact || c.tipo || '').toLowerCase();
      return name.includes(q) || comp.includes(q) || notes.includes(q) || proc.includes(q) || phone.includes(q) || type.includes(q);
    }).slice(0, 35);
  })();

  onMount(() => {
    loadContacts();

    // Auto-recargar catálogo de contactos cuando el usuario regresa a esta pestaña tras dar de alta un contacto
    const handleFocus = () => {
      loadContacts();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  });

  function handleCreateContact(nameToCreate: string) {
    const clean = nameToCreate.trim();
    const url = `/contacts/new?name=${encodeURIComponent(clean)}&typeContact=${encodeURIComponent('Agente Inmobiliario')}`;
    // Abrir en nueva pestaña para no interrumpir ni perder el formulario de propiedad actual
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  async function loadContacts() {
    if (!db) return;
    isLoading = true;
    try {
      const snap = await getDocs(collection(db, 'contacts'));
      const firestoreList = snap.docs.map(d => {
        const data = d.data();
        const fullName = `${data.name || ''} ${data.lastname || ''}`.trim() || data.nombre || data.company || 'Sin nombre';
        const notes = data.notes || data.comContact || data.notas || '';
        const procedenciaExtracted = extractProcedenciaFromNotes(notes);
        const phone = data.telephon || data.telefono || data.phone || (Array.isArray(data.phoneNumbers) ? data.phoneNumbers[0]?.value : '') || '';
        return {
          id: d.id,
          ...data,
          _fullName: fullName,
          _company: data.company || data.inmobiliaria || '',
          _phone: phone,
          _notes: notes,
          _procedencia: procedenciaExtracted,
          _isAgent: isAgentContact(data)
        };
      });

      const combined = [...PINNED_COMPANIES];
      for (const fc of firestoreList) {
        const norm = (fc._company || fc._fullName || '').toLowerCase().replace(/\s+/g, '');
        const pinnedMatch = combined.find(p => norm.includes(p._fullName.toLowerCase().replace(/\s+/g, '')));
        if (pinnedMatch) {
          if (fc._phone && !pinnedMatch._phone) {
            pinnedMatch._phone = fc._phone;
          }
          if (fc.id && !fc.id.startsWith('pinned-')) {
            pinnedMatch.id = fc.id;
          }
          if (fc._company && !pinnedMatch._company) {
            pinnedMatch._company = fc._company;
          }
        } else {
          combined.push(fc);
        }
      }

      contacts = combined;
    } catch (e) {
      console.error('Error al cargar contactos:', e);
    } finally {
      isLoading = false;
    }
  }

  function isAgentContact(data: any) {
    const type = (data.typeContact || data.tipo || '').toLowerCase();
    const notes = (data.notes || data.comContact || data.notas || '').toLowerCase();
    const company = (data.company || data.inmobiliaria || '').toLowerCase();

    // Si explícitamente es otro perfil de cliente (Comprador, Vendedor, Arrendatario, Arrendador, Inversionista)
    if (
      type.includes('comprador') ||
      type.includes('vendedor') ||
      type.includes('arrendador') ||
      type.includes('arrendatario') ||
      type.includes('inversionista')
    ) {
      return false;
    }

    return (
      type.includes('agente') ||
      type.includes('inmobiliaria') ||
      type.includes('colaborador') ||
      type.includes('asesor') ||
      notes.includes('sinergia') ||
      notes.includes('agente') ||
      notes.includes('inmobiliaria') ||
      company.length > 0 ||
      Boolean(data.id && data.id.startsWith('pinned-'))
    );
  }

  function extractProcedenciaFromNotes(notes: string) {
    if (!notes || typeof notes !== 'string') return null;
    const n = notes.toLowerCase();
    if (n.includes('sinergia 1') || /\b(s1)\b/i.test(n)) return 'S1';
    if (n.includes('sinergia 2') || /\b(s2)\b/i.test(n)) return 'S2';
    if (n.includes('sinergia 3') || /\b(s3)\b/i.test(n)) return 'S3';
    if (n.includes('match home') || /\b(mh)\b/i.test(n)) return 'MH';
    return null;
  }

  function getContactLabel(contact: any) {
    if (!contact) return '';
    if (contact._company && contact._fullName && contact._company !== contact._fullName) {
      return `${contact._company} (${contact._fullName})`;
    }
    return contact._company || contact._fullName || '';
  }

  function selectContact(contact: any) {
    selectedContact = contact;
    value = getContactLabel(contact);
    contactId = contact.id || '';
    contactPhone = contact._phone || '';
    contactName = contact._fullName || '';
    companyName = contact._company || '';

    if (onSelectContact) {
      onSelectContact(contact);
    }
    if (onSelectProcedencia) {
      onSelectProcedencia(contact._procedencia || 'MH');
    }
    searchTerm = '';
    isOpen = false;
  }

  function setCustomValue(text: string) {
    const clean = text.trim();
    if (clean) {
      selectedContact = {
        id: '',
        _fullName: clean,
        _company: '',
        _phone: '',
        _procedencia: 'MH',
        _notes: 'Captador externo'
      };
      value = clean;
      contactId = '';
      contactPhone = '';
      contactName = clean;
      companyName = '';
      if (onSelectContact) {
        onSelectContact(selectedContact);
      }
      if (onSelectProcedencia) {
        onSelectProcedencia('MH');
      }
    }
    searchTerm = '';
    isOpen = false;
  }

  function clearSelection() {
    selectedContact = null;
    value = '';
    contactId = '';
    contactPhone = '';
    contactName = '';
    companyName = '';
    searchTerm = '';
    isOpen = true;
    setTimeout(() => inputElement?.focus(), 50);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredContacts.length > 0 && searchTerm) {
        selectContact(filteredContacts[0]);
      } else if (searchTerm.trim() && !isSynergyMode) {
        setCustomValue(searchTerm);
      }
    } else if (e.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.contact-selector-container')) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="contact-selector-container">
  {#if selectedContact && !isOpen}
    <!-- Vista de Contacto Seleccionado -->
    <div class="selected-display">
      <div class="selected-avatar">
        {(getContactLabel(selectedContact) || 'C').charAt(0).toUpperCase()}
      </div>

      <div class="selected-info">
        <div class="selected-main-line">
          <span class="selected-title">{getContactLabel(selectedContact)}</span>
          {#if selectedContact._procedencia}
            <span class="proc-badge proc-{selectedContact._procedencia.toLowerCase()}">
              {selectedContact._procedencia}
            </span>
          {/if}
          {#if selectedContact._phone || contactPhone}
            <span class="selected-phone">📞 {selectedContact._phone || contactPhone}</span>
          {/if}
        </div>
        {#if selectedContact._notes}
          <span class="selected-sub">📝 {selectedContact._notes}</span>
        {/if}
      </div>

      <button
        type="button"
        class="btn-clear"
        on:click={clearSelection}
        aria-label="Cambiar captador"
        title="Cambiar captador"
      >
        ✕
      </button>
    </div>

    <!-- Input / Editor de teléfono del captador -->
    <div class="selected-phone-editor">
      <div class="phone-label-row">
        <span class="phone-label-text">
          Teléfono / WhatsApp del captador:
          {#if isSynergyMode}
            <span class="phone-required-tag">* Obligatorio para {procedencia}</span>
          {/if}
        </span>
      </div>
      <div class="phone-input-box" class:has-error={isSynergyMode && (!contactPhone || !contactPhone.trim())}>
        <span class="phone-addon">📞</span>
        <input
          type="tel"
          class="phone-input"
          placeholder="Ingresa número de teléfono (ej. 6141234567)..."
          bind:value={contactPhone}
        />
        {#if contactPhone && contactPhone.trim()}
          <a
            href="https://wa.me/52{String(contactPhone).replace(/\D/g, '')}"
            target="_blank"
            rel="noopener noreferrer"
            class="whatsapp-preview-link"
            title="Abrir chat de WhatsApp para verificar"
          >
            💬 Probar WhatsApp
          </a>
        {/if}
      </div>
      {#if isSynergyMode && (!contactPhone || !contactPhone.trim())}
        <span class="phone-error-msg">⚠️ Debes registrar un teléfono o WhatsApp para contactar a este captador de sinergia.</span>
      {/if}
    </div>
  {:else}
    <!-- Input buscador -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="selector-box"
      class:focused={isOpen}
      on:click={() => { isOpen = true; inputElement?.focus(); }}
    >
      <input
        bind:this={inputElement}
        type="text"
        class="search-input"
        bind:value={searchTerm}
        placeholder={placeholder}
        on:focus={() => isOpen = true}
        on:keydown={handleKeyDown}
      />

      {#if isLoading}
        <span class="loading-indicator">⏳</span>
      {:else}
        <span class="search-indicator">🔍</span>
      {/if}
    </div>

    <!-- Menú Desplegable con Resultados -->
    {#if isOpen}
      <div class="dropdown-menu">
        {#if isLoading}
          <div class="dropdown-empty">Cargando agentes inmobiliarios...</div>
        {:else if filteredContacts.length === 0}
          <div class="dropdown-empty">
            <p class="empty-title">No se encontraron contactos para "{searchTerm.trim()}".</p>
            
            <button
              type="button"
              class="btn-create-agent-contact"
              on:click={() => handleCreateContact(searchTerm)}
            >
              <span class="btn-create-icon">👤➕</span>
              <span class="btn-create-text">
                Dar de alta a <strong>"{searchTerm.trim()}"</strong> como <strong>Agente Inmobiliario</strong> ↗
              </span>
            </button>

            {#if isSynergyMode}
              <div class="synergy-warning">
                ⚠️ Las sinergias ({procedencia}) requieren que el contacto esté registrado con su teléfono. Da de alta al agente arriba para vincularlo.
              </div>
            {:else if searchTerm.trim()}
              <button
                type="button"
                class="btn-add-custom-fallback"
                on:click={() => setCustomValue(searchTerm)}
              >
                o usar "{searchTerm.trim()}" como texto temporal
              </button>
            {/if}
          </div>
        {:else}
          <div class="contacts-list">
            <div class="list-header">
              <span>{searchTerm.trim() ? 'Resultados de Búsqueda' : 'Agentes Inmobiliarios'} ({filteredContacts.length})</span>
              <button
                type="button"
                class="btn-quick-create-link"
                on:click={() => handleCreateContact(searchTerm)}
                title="Dar de alta como nuevo Agente Inmobiliario"
              >
                👤➕ Alta Agente ↗
              </button>
            </div>

            {#each filteredContacts as contact, i}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="contact-item"
                class:pinned-item={i < 3 && !searchTerm}
                on:click={() => selectContact(contact)}
              >
                <div class="contact-avatar">
                  {(contact._fullName || 'C').charAt(0).toUpperCase()}
                </div>

                <div class="contact-info">
                  <div class="contact-main-row">
                    <span class="contact-name">{contact._fullName}</span>
                    {#if contact._company && contact._company !== contact._fullName}
                      <span class="contact-company">🏢 {contact._company}</span>
                    {/if}
                    {#if contact._phone}
                      <span class="contact-phone">📞 {contact._phone}</span>
                    {/if}
                    {#if contact._procedencia}
                      <span class="proc-badge proc-{contact._procedencia.toLowerCase()}">
                        {contact._procedencia}
                      </span>
                    {/if}
                  </div>

                  {#if contact._notes}
                    <div class="contact-notes" title={contact._notes}>
                      📝 {contact._notes}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .contact-selector-container {
    position: relative;
    width: 100%;
  }

  .selected-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background-color: #1e1e35;
    border: 1px solid var(--border-color, rgba(99, 102, 241, 0.2));
    border-radius: var(--radius-sm, 0.5rem);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .selected-display:hover {
    border-color: rgba(99, 102, 241, 0.45);
  }

  .selected-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .selected-info {
    flex: 1;
    min-width: 0;
  }

  .selected-main-line {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .selected-title {
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--text-secondary, #94a3b8);
  }

  .selected-sub {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.1rem;
  }

  .btn-clear {
    background: transparent;
    border: none;
    color: var(--text-muted, #64748b);
    cursor: pointer;
    font-size: 0.95rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .btn-clear:hover {
    color: var(--error, #f87171);
    background: rgba(248, 113, 113, 0.1);
  }

  .selected-phone-editor {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .phone-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .phone-label-text {
    font-size: 0.78rem;
    color: var(--text-secondary, #94a3b8);
    font-weight: 500;
  }

  .phone-required-tag {
    color: #f59e0b;
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: 0.35rem;
  }

  .phone-input-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #18182b;
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: var(--radius-sm, 0.45rem);
    padding: 0.45rem 0.75rem;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .phone-input-box:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .phone-input-box.has-error {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.05);
  }

  .phone-addon {
    font-size: 0.85rem;
    color: #a5b4fc;
    user-select: none;
  }

  .phone-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary, #f1f5f9);
    font-size: 0.88rem;
    font-family: inherit;
  }

  .whatsapp-preview-link {
    font-size: 0.78rem;
    color: #22c55e;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.25);
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    text-decoration: none;
    font-weight: 600;
    white-space: nowrap;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .whatsapp-preview-link:hover {
    background: rgba(34, 197, 94, 0.25);
    transform: translateY(-1px);
  }

  .phone-error-msg {
    font-size: 0.74rem;
    color: #f87171;
    line-height: 1.3;
  }

  .selector-box {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: #1e1e35;
    border: 1px solid var(--border-color, rgba(99, 102, 241, 0.2));
    border-radius: var(--radius-sm, 0.5rem);
    cursor: text;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .selector-box:hover {
    border-color: rgba(99, 102, 241, 0.45);
  }

  .selector-box.focused {
    border-color: var(--primary, #6366f1);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  .search-input {
    width: 100%;
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    color: var(--text-secondary, #94a3b8) !important;
    font-size: 0.92rem;
    outline: none !important;
    box-shadow: none !important;
  }

  .search-input::placeholder {
    color: var(--text-secondary, #94a3b8);
    opacity: 0.85;
  }

  .search-indicator, .loading-indicator {
    font-size: 0.85rem;
    opacity: 0.6;
    margin-left: auto;
    padding-left: 0.5rem;
    user-select: none;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.35rem;
    background-color: #1e1e35;
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: var(--radius-md, 0.75rem);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 60;
    overflow: hidden;
    backdrop-filter: blur(12px);
  }

  .dropdown-empty {
    padding: 1.25rem;
    text-align: center;
    color: var(--text-muted, #64748b);
    font-size: 0.88rem;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.85rem;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .contacts-list {
    max-height: 270px;
    overflow-y: auto;
  }

  .contacts-list::-webkit-scrollbar {
    width: 6px;
  }
  .contacts-list::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.35);
    border-radius: 4px;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    transition: background-color 0.15s ease;
  }

  .contact-item:hover {
    background-color: rgba(99, 102, 241, 0.12);
  }

  .contact-item.pinned-item {
    background: rgba(99, 102, 241, 0.05);
  }

  .contact-item.pinned-item:hover {
    background: rgba(99, 102, 241, 0.15);
  }

  .contact-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .contact-info {
    flex: 1;
    min-width: 0;
  }

  .contact-main-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .contact-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary, #94a3b8);
  }

  .contact-company {
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
  }

  .proc-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
    letter-spacing: 0.03em;
  }

  .proc-mh {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.35);
  }

  .proc-s1 {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .proc-s2 {
    background: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.35);
  }

  .proc-s3 {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .contact-notes {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.15rem;
  }

  .selected-phone {
    font-size: 0.75rem;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    font-family: monospace;
  }

  .contact-phone {
    font-size: 0.75rem;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
    padding: 0.08rem 0.35rem;
    border-radius: 0.2rem;
    font-family: monospace;
  }

  .synergy-warning {
    margin-top: 0.5rem;
    padding: 0.6rem 0.8rem;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 0.35rem;
    color: #fbbf24;
    font-size: 0.8rem;
    line-height: 1.4;
    text-align: left;
  }

  .btn-add-custom, .btn-quick-add {
    background: transparent;
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
    padding: 0.3rem 0.6rem;
    border-radius: 0.35rem;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-add-custom:hover, .btn-quick-add:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: var(--primary, #6366f1);
  }

  .empty-title {
    margin: 0 0 0.75rem 0;
    color: var(--text-secondary, #cbd5e1);
    font-size: 0.88rem;
  }

  .btn-create-agent-contact {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    width: 100%;
    margin: 0.5rem 0 0.35rem;
    padding: 0.8rem 1rem;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #ffffff;
    font-size: 0.88rem;
    font-weight: 500;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--radius-sm, 0.5rem);
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
  }

  .btn-create-agent-contact:hover {
    background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.55);
    transform: translateY(-1.5px);
  }

  .btn-create-agent-contact strong {
    color: #fde047;
    font-weight: 700;
  }

  .btn-create-icon {
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .btn-create-text {
    line-height: 1.3;
  }

  .btn-add-custom-fallback {
    display: block;
    width: 100%;
    margin-top: 0.6rem;
    background: transparent;
    border: none;
    color: var(--text-muted, #64748b);
    font-size: 0.76rem;
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.15s ease;
    padding: 0.25rem;
  }

  .btn-add-custom-fallback:hover {
    color: var(--text-secondary, #94a3b8);
  }

  .btn-quick-create-link {
    background: rgba(99, 102, 241, 0.18);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #c7d2fe;
    padding: 0.25rem 0.6rem;
    border-radius: 0.35rem;
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-quick-create-link:hover {
    background: rgba(99, 102, 241, 0.35);
    color: #ffffff;
    border-color: #818cf8;
  }
</style>
