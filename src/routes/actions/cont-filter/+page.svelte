<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { collection, getDocs } from 'firebase/firestore';
    import { db, currentProjectId, isSandbox } from '$lib/firebase_toggle';
    import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';    
    import { InputOptions, InputOptionsMultiple, InputNumber, Button } from '$components';
    import { formatDate } from '$lib/functions/dateFunctions';
    import { filterContactsByCriteria } from '$lib/functions/propertyMatching';
    import {
        AUDIT_BUCKET_LABELS,
        buildAuditCsv,
        filterAuditedContacts,
        normalizeRawContactForAudit,
        runContactsPortfolioAudit,
        type AuditBucketKey,
        type AuditedContact,
        type ColdSubFilter,
        type ContactsPortfolioAudit,
        type ProtectedSubFilter
    } from '$lib/functions/contactAudit';
    import type { Contact } from '$lib/types';

    type ExtendedContact = Contact & { tags?: string[] };

    // Estado de la Radiografía de Cartera (100% Solo Lectura sobre Firestore real)
    let auditLoading = false;
    let auditError = '';
    let audit: ContactsPortfolioAudit | null = null;
    let selectedAuditBucket: AuditBucketKey | 'all' = 'cold_over_2y_buyers';
    let coldSubFilter: ColdSubFilter = 'all';
    let protectedSubFilter: ProtectedSubFilter = 'all';
    let auditSearchTerm = '';
    let previewLimit = 50;

    async function runFirestoreAudit() {
        if (!browser) return;
        if (!db) {
            auditError = 'Firestore aún no está inicializado. Intenta recargar la página.';
            return;
        }

        auditLoading = true;
        auditError = '';

        try {
            const snapshot = await getDocs(collection(db, 'contacts'));
            const rawContacts = snapshot.docs.map((docSnap) =>
                normalizeRawContactForAudit(docSnap.id, docSnap.data() as Record<string, any>)
            );
            audit = runContactsPortfolioAudit(rawContacts);
            previewLimit = 50;
        } catch (err: any) {
            console.error('[Radiografía] Error consultando Firestore:', err);
            auditError = err?.message || 'No se pudo consultar la colección contacts en Firestore.';
        } finally {
            auditLoading = false;
        }
    }

    onMount(() => {
        void runFirestoreAudit();
    });

    function selectAuditBucket(bucket: AuditBucketKey | 'all') {
        selectedAuditBucket = bucket;
        previewLimit = 50;
    }

    function selectColdSubFilter(sub: ColdSubFilter) {
        selectedAuditBucket = 'cold_over_2y_buyers';
        coldSubFilter = sub;
        previewLimit = 50;
    }

    function selectProtectedSubFilter(sub: ProtectedSubFilter) {
        selectedAuditBucket = 'protected_non_buyer';
        protectedSubFilter = sub;
        previewLimit = 50;
    }

    function formatAuditDate(ms: number | null): string {
        if (!ms) return '⚠️ Sin fecha en Firestore';
        return formatDate(ms);
    }

    function downloadAuditCsv() {
        if (!browser || filteredAuditItems.length === 0) return;
        const csvContent = '\uFEFF' + buildAuditCsv(filteredAuditItems);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `radiografia_atair_${selectedAuditBucket}_${dateStamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    $: filteredAuditItems = audit
        ? filterAuditedContacts(
              audit.items,
              selectedAuditBucket,
              coldSubFilter,
              protectedSubFilter,
              auditSearchTerm
          )
        : [];

    $: visibleAuditItems = filteredAuditItems.slice(0, previewLimit);
    
    let filteredContacts: ExtendedContact[] = [];
    let contacts: ExtendedContact[] = [];
    $: contacts = $contactsStore as ExtendedContact[];
    let selectedBedrooms: string = '';
    let selectedBathrooms: string = ''; 
    let selectedParking: string = '';
    let selectedtypeContact: string = '';
    let selectedtypeProperty: string = '';
    let selectedlocaProperty: string = '';
    let selectedcontactStage: string = '';
    let selectedrangeProp: string = '';
    let selectedtagsProperty: string[] = [];
    let budget: number = 0;
    let startDate: string = '';
    let endDate: string = '';

    import { typeContacts, contStage } from '$lib/parameters';

    const contactStage = {
        operation: {
            name: "Etapa",
            choices: [...contStage, "OW"]
        }
    };

    const typeContact = {
        operation: {
            name: "Tipo de Contacto",
            choices: typeContacts
        }
    };

    const selectTP = {
        operation: {
            name: "Tipo de Propiedad",
            choices: ["Casa", "Departamento", "Terreno", "Terreno Comercial", "Terreno Industrial", "Local", "Bodega", "Rancho", "Granja"]
        }
    };

    const locaProperty = {
        operation: {
            name: "Ubicación de la Propiedad",
            choices: ["Norte", "Noroeste", "Noreste", "Oeste", "Centronorte", "Este", "Centrosur", "Suroeste", "Sureste", "Sur"]
        }
    };

    const tagsProperty = {
        operation: {
            name: "Preferencias",
            choices: ["Fracc. Privado", "Frente a Parque", "Una Planta", "Recamara en P.B.", "Patio Amplio", "Lista para Habitarse", "Nueva", "En Avenida", "Alberca"]
        }
    };

    const propertyOptions = {
        bedrooms: {
            name: "Recámaras",
            choices: ["1", "2", "3", "4", "5+"]
        },
        bathrooms: {
            name: "Baños",
            choices: ["1", "2", "3", "4+"]
        },
        parking: {
            name: "Estacionamientos",
            choices: ["1", "2", "3", "4+"]
        }
    };

    // Eliminar todas las funciones handle individuales y reemplazar por una sola
    function handleFilterChange(event: CustomEvent<string | string[]>, filterType: string) {
        console.log(event.detail);
        switch(filterType) {
            case 'typeContact':
                selectedtypeContact = event.detail as string;
                break;
            case 'typeProperty':
                selectedtypeProperty = event.detail as string;
                break;
            case 'contactStage':
                selectedcontactStage = event.detail as string;
                break;
            case 'budget':
                budget = Number(event.detail as string);
                break;
            case 'bedrooms':
                selectedBedrooms = event.detail as string;
                break;
            case 'bathrooms':
                selectedBathrooms = event.detail as string;
                break;
            case 'parking':
                selectedParking = event.detail as string;
                break;
            case 'locaProperty':
                selectedlocaProperty = event.detail as string;
                break;
            case 'tagsProperty':
                selectedtagsProperty = event.detail as string[];
                break;
            case 'startDate':
                startDate = event.detail as string;
                break;
            case 'endDate':
                endDate = event.detail as string;
                break;
        }
    }

    // Lógica unificada de filtrado multicriterio (#036: corrige tags/tagsProperty, etapas, zonas y rangos)
    $: filteredContacts = filterContactsByCriteria(contacts, {
        startDate,
        endDate,
        typeContact: selectedtypeContact,
        typeProperty: selectedtypeProperty,
        contactStage: selectedcontactStage,
        budget,
        rangeProp: selectedrangeProp,
        bedrooms: selectedBedrooms,
        bathrooms: selectedBathrooms,
        parking: selectedParking,
        locaProperty: selectedlocaProperty,
        tagsProperty: selectedtagsProperty
    }) as ExtendedContact[];

    // function handleFilter() {
    //     const filters = {
    //         operation: selectedtypeContact,
    //         typeProperty: selectedtypeProperty,
    //         budget,
    //         bedrooms: selectedBedrooms,
    //         bathrooms: selectedBathrooms,
    //         parking: selectedParking
    //     };
    //     console.log('Aplicando filtros:', filters);
    //     // Aquí puedes agregar la lógica para filtrar
    // }

    function handleClearFilters() {
        // Resetear todos los valores a su estado inicial
        selectedBedrooms = '';
        selectedBathrooms = '';
        selectedParking = '';
        selectedtypeContact = '';
        selectedtypeProperty = '';
        selectedcontactStage = '';
        budget = 0;
        selectedlocaProperty = '';
        selectedtagsProperty = [];
        startDate = '';
        endDate = '';
    }

    // Agregar variable reactiva para controlar visibilidad del botón
    $: showClearButton = selectedBedrooms !== '' || 
                        selectedBathrooms !== '' || 
                        selectedParking !== '' || 
                        selectedtypeContact !== '' || 
                        selectedtypeProperty !== '' ||
                        selectedcontactStage !== '' ||
                        selectedlocaProperty !== '' ||
                        selectedtagsProperty.length > 0 ||
                        budget !== 0 ||
                        startDate !== '' ||
                        endDate !== '';

    $: hasActiveFilters = showClearButton || selectedrangeProp !== '';
</script>

<h1 class="title">Radiografía y Filtro de Contactos</h1>

<section class="audit-shell" aria-label="Radiografía de cartera solo lectura">
    <div class="audit-header">
        <div class="audit-header-left">
            <div class="audit-title-row">
                <h2>🔬 Radiografía de Cartera · +2 Años vs ≤ 2 Años</h2>
                <span class="readonly-pill">🔒 100% Solo Lectura (No modifica ni borra datos)</span>
            </div>
            <p class="audit-subtitle">
                Escanea directamente los documentos crudos de Firestore en
                <strong>{isSandbox ? 'Sandbox' : 'Producción'} ({currentProjectId})</strong>
                para detectar la fecha real <code>createdAt</code> (sin el fallback de hoy en memoria).
            </p>
        </div>

        <div class="audit-header-actions">
            <button
                type="button"
                class="audit-action-btn"
                on:click={runFirestoreAudit}
                disabled={auditLoading}
            >
                {auditLoading ? '⏳ Escaneando Firestore...' : '🔄 Re-escanear Base Real'}
            </button>
        </div>
    </div>

    {#if auditError}
        <div class="audit-alert error">
            ⚠️ Error al consultar Firestore: {auditError}
        </div>
    {:else if auditLoading && !audit}
        <div class="audit-loading">
            ⏳ Analizando colección <code>contacts</code> en modo solo lectura...
        </div>
    {:else if audit}
        <div class="audit-meta-strip">
            <span>
                📦 Total real en Firestore: <strong>{audit.total}</strong> contactos
            </span>
            <span>
                🧠 En memoria (<code>contactsStore</code>): <strong>{$contactsStore.length}</strong>
            </span>
            <span>
                🕒 Escaneado: <strong>{new Date(audit.generatedAt).toLocaleTimeString('es-MX')}</strong>
            </span>
        </div>

        <div class="audit-cards-grid">
            <button
                type="button"
                class="audit-card card-green"
                class:selected={selectedAuditBucket === 'active_e4_eligible'}
                on:click={() => selectAuditBucket('active_e4_eligible')}
            >
                <div class="card-top">
                    <span class="card-label">📱 Cajón 1A · E4 (≤ 2 años)</span>
                    <span class="card-count">{audit.counts.active_e4_eligible}</span>
                </div>
                <p class="card-desc">
                    Listos hoy para difusión WA: <strong>{audit.e4Breakdown.validPhoneReadyForWa}</strong>
                    {#if audit.e4Breakdown.missingOrShortPhone > 0}
                        · Sin tel. 10 dígitos: <strong>{audit.e4Breakdown.missingOrShortPhone}</strong>
                    {/if}
                </p>
            </button>

            <button
                type="button"
                class="audit-card card-blue"
                class:selected={selectedAuditBucket === 'active_calls_recent'}
                on:click={() => selectAuditBucket('active_calls_recent')}
            >
                <div class="card-top">
                    <span class="card-label">📞 Cajón 1B · Llamadas (≤ 2 años)</span>
                    <span class="card-count">{audit.counts.active_calls_recent}</span>
                </div>
                <p class="card-desc">
                    E1: <strong>{audit.recentCallsBreakdown.e1}</strong> · E2:
                    <strong>{audit.recentCallsBreakdown.e2}</strong> · E3 (form):
                    <strong>{audit.recentCallsBreakdown.e3}</strong>
                    {#if audit.recentCallsBreakdown.na > 0}
                        · NA: <strong>{audit.recentCallsBreakdown.na}</strong>
                    {/if}
                </p>
            </button>

            <button
                type="button"
                class="audit-card card-amber"
                class:selected={selectedAuditBucket === 'cold_over_2y_buyers'}
                on:click={() => selectAuditBucket('cold_over_2y_buyers')}
            >
                <div class="card-top">
                    <span class="card-label">🧊 Cajón 2 · Fríos +2 años (Lote E3)</span>
                    <span class="card-count">{audit.counts.cold_over_2y_buyers}</span>
                </div>
                <p class="card-desc">
                    Por pasar a E3: <strong>{audit.coldOver2yBreakdown.toMoveToE3}</strong> (E1:{audit.coldOver2yBreakdown.e1},
                    E2:{audit.coldOver2yBreakdown.e2}, E4:{audit.coldOver2yBreakdown.e4}{#if audit.coldOver2yBreakdown.na > 0}, NA:{audit.coldOver2yBreakdown.na}{/if})
                    · Ya en E3: <strong>{audit.coldOver2yBreakdown.alreadyE3}</strong>
                </p>
                {#if audit.coldOver2yBreakdown.withRecentActivity1y > 0}
                    <p class="card-warn">
                        ⚠️ {audit.coldOver2yBreakdown.withRecentActivity1y} con actividad &lt; 1 año (revisar antes)
                    </p>
                {/if}
            </button>

            <button
                type="button"
                class="audit-card card-purple"
                class:selected={selectedAuditBucket === 'protected_non_buyer'}
                on:click={() => selectAuditBucket('protected_non_buyer')}
            >
                <div class="card-top">
                    <span class="card-label">🛡️ Intocables (No pasar a E3)</span>
                    <span class="card-count">{audit.counts.protected_non_buyer}</span>
                </div>
                <p class="card-desc">
                    Vend/Arr: <strong>{audit.protectedBreakdown.sellersAndLandlords}</strong> · Agentes:
                    <strong>{audit.protectedBreakdown.agents}</strong> · Inq:
                    <strong>{audit.protectedBreakdown.tenants}</strong> · E5/E6:
                    <strong>{audit.protectedBreakdown.closedOrPostSale}</strong>
                </p>
                <p class="card-subnote">
                    {audit.protectedBreakdown.over2yCount} tienen +2 años y quedan protegidos
                </p>
            </button>

            <button
                type="button"
                class="audit-card card-coral"
                class:selected={selectedAuditBucket === 'missing_created_at'}
                on:click={() => selectAuditBucket('missing_created_at')}
            >
                <div class="card-top">
                    <span class="card-label">⚠️ Sin createdAt en Firestore</span>
                    <span class="card-count">{audit.counts.missing_created_at}</span>
                </div>
                <p class="card-desc">
                    En +layout.svelte aparecen como "hoy" · E4: <strong>{audit.missingDateBreakdown.inE4}</strong>
                    · E1-E3: <strong>{audit.missingDateBreakdown.inE1E2E3}</strong>
                </p>
            </button>

            <button
                type="button"
                class="audit-card card-gray"
                class:selected={selectedAuditBucket === 'inactive'}
                on:click={() => selectAuditBucket('inactive')}
            >
                <div class="card-top">
                    <span class="card-label">🗄️ Ya Inactivos (isActive=false)</span>
                    <span class="card-count">{audit.counts.inactive}</span>
                </div>
                <p class="card-desc">
                    Contactos apagados actualmente en la base (excluidos del matching).
                </p>
            </button>
        </div>

        <div class="audit-preview">
            <div class="audit-preview-toolbar">
                <div class="preview-title-group">
                    <h3>
                        {selectedAuditBucket === 'all'
                            ? 'Todos los contactos analizados'
                            : AUDIT_BUCKET_LABELS[selectedAuditBucket]}
                        <span class="count-pill">{filteredAuditItems.length}</span>
                    </h3>
                    {#if selectedAuditBucket !== 'all'}
                        <button
                            type="button"
                            class="sub-pill"
                            on:click={() => selectAuditBucket('all')}
                        >
                            Ver todos ({audit.total})
                        </button>
                    {/if}
                </div>

                <div class="preview-controls">
                    <input
                        type="search"
                        class="audit-search-input"
                        placeholder="Buscar nombre, teléfono, tipo o etapa..."
                        bind:value={auditSearchTerm}
                    />
                    <button
                        type="button"
                        class="audit-action-btn secondary"
                        on:click={downloadAuditCsv}
                        disabled={filteredAuditItems.length === 0}
                    >
                        📥 Descargar CSV ({filteredAuditItems.length})
                    </button>
                </div>
            </div>

            {#if selectedAuditBucket === 'cold_over_2y_buyers'}
                <div class="sub-pills-row">
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={coldSubFilter === 'all'}
                        on:click={() => selectColdSubFilter('all')}
                    >
                        Todos +2 años ({audit.coldOver2yBreakdown.total})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={coldSubFilter === 'to_move_e3'}
                        on:click={() => selectColdSubFilter('to_move_e3')}
                    >
                        Por pasar a E3 ({audit.coldOver2yBreakdown.toMoveToE3})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={coldSubFilter === 'already_e3'}
                        on:click={() => selectColdSubFilter('already_e3')}
                    >
                        Ya en E3 ({audit.coldOver2yBreakdown.alreadyE3})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={coldSubFilter === 'recent_activity_1y'}
                        on:click={() => selectColdSubFilter('recent_activity_1y')}
                    >
                        Con actividad &lt; 1 año ({audit.coldOver2yBreakdown.withRecentActivity1y})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={coldSubFilter === 'no_recent_activity'}
                        on:click={() => selectColdSubFilter('no_recent_activity')}
                    >
                        Sin actividad reciente ({audit.coldOver2yBreakdown.noRecentActivity})
                    </button>
                </div>
            {:else if selectedAuditBucket === 'protected_non_buyer'}
                <div class="sub-pills-row">
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={protectedSubFilter === 'all'}
                        on:click={() => selectProtectedSubFilter('all')}
                    >
                        Todos ({audit.protectedBreakdown.total})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={protectedSubFilter === 'over_2y_only'}
                        on:click={() => selectProtectedSubFilter('over_2y_only')}
                    >
                        Solo +2 años ({audit.protectedBreakdown.over2yCount})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={protectedSubFilter === 'sellers_landlords'}
                        on:click={() => selectProtectedSubFilter('sellers_landlords')}
                    >
                        Vendedores/Arrendadores ({audit.protectedBreakdown.sellersAndLandlords})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={protectedSubFilter === 'agents'}
                        on:click={() => selectProtectedSubFilter('agents')}
                    >
                        Agentes S1-MH ({audit.protectedBreakdown.agents})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={protectedSubFilter === 'tenants'}
                        on:click={() => selectProtectedSubFilter('tenants')}
                    >
                        Arrendatarios ({audit.protectedBreakdown.tenants})
                    </button>
                    <button
                        type="button"
                        class="sub-pill"
                        class:active={protectedSubFilter === 'e5_e6'}
                        on:click={() => selectProtectedSubFilter('e5_e6')}
                    >
                        Cierre E5 / Post-Venta E6 ({audit.protectedBreakdown.closedOrPostSale})
                    </button>
                </div>
            {/if}

            {#if visibleAuditItems.length > 0}
                <div class="audit-table-wrap">
                    <table class="audit-table">
                        <thead>
                            <tr>
                                <th>Contacto</th>
                                <th>Teléfono</th>
                                <th>Tipo</th>
                                <th>Etapa</th>
                                <th>Alta Real (Firestore)</th>
                                <th>Última Actividad</th>
                                <th>Ficha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each visibleAuditItems as item (item.contact.id || `${item.contact.name}-${item.contact.telephon}`)}
                                <tr>
                                    <td>
                                        <div class="contact-name-cell">
                                            <strong>{item.contact.name} {item.contact.lastname}</strong>
                                            {#if item.contact.isActive === false}
                                                <span class="mini-tag muted">Inactivo</span>
                                            {:else if item.bucket === 'cold_over_2y_buyers' && item.hasRecentActivity1y}
                                                <span class="mini-tag warn">Actividad &lt;1a</span>
                                            {/if}
                                        </div>
                                    </td>
                                    <td class="mono">{item.contact.telephon || 'Sin teléfono'}</td>
                                    <td>{item.contact.typeContact || '—'}</td>
                                    <td>
                                        <span
                                            class="stage-badge"
                                            style="background-color: {item.badge.color};"
                                            title={item.badge.tooltip}
                                        >
                                            {item.badge.text}
                                        </span>
                                    </td>
                                    <td class:missing-date={!item.createdMs}>
                                        {formatAuditDate(item.createdMs)}
                                    </td>
                                    <td>
                                        {item.lastActivityMs ? formatDate(item.lastActivityMs) : '—'}
                                    </td>
                                    <td>
                                        {#if item.contact.id}
                                            <a
                                                class="ficha-link"
                                                href={`/contact/${item.contact.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Abrir ↗
                                            </a>
                                        {:else}
                                            —
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                {#if filteredAuditItems.length > previewLimit}
                    <div class="audit-pagination">
                        <span>Mostrando {visibleAuditItems.length} de {filteredAuditItems.length}</span>
                        <div class="pagination-btns">
                            <button
                                type="button"
                                class="sub-pill"
                                on:click={() => (previewLimit += 50)}
                            >
                                Mostrar 50 más
                            </button>
                            <button
                                type="button"
                                class="sub-pill"
                                on:click={() => (previewLimit = filteredAuditItems.length)}
                            >
                                Ver todos ({filteredAuditItems.length})
                            </button>
                        </div>
                    </div>
                {/if}
            {:else}
                <p class="audit-empty">No hay contactos en este filtro de auditoría.</p>
            {/if}
        </div>
    {/if}
</section>

<h2 class="legacy-filter-heading">🔍 Filtro Avanzado por Criterios</h2>

<div class="operation-filters">
    <h3 class="title">Rango de Fechas</h3>
    
    <div class="filters-grid">
        <div class="input-container">
            <label class="input-label" for="startDate">Fecha Inicial</label>
            <input 
                type="date" 
                id="startDate"
                class="input-select"
                value={startDate}
                on:change={(e) => handleFilterChange(new CustomEvent('change', {
                    detail: e.currentTarget.value
                }), 'startDate')}
            />
        </div>

        <div class="input-container">
            <label class="input-label" for="endDate">Fecha Final</label>
            <input 
                type="date" 
                id="endDate"
                class="input-select"
                value={endDate}
                min={startDate}
                on:change={(e) => handleFilterChange(new CustomEvent('change', {
                    detail: e.currentTarget.value
                }), 'endDate')}
            />
        </div>
    </div>

    <h3 class="title">Tipo de Operación y Presupuesto</h3>
    
    <div class="filters-grid">
        <InputOptions 
            name={typeContact.operation.name}
            identificador="typeContact"
            value={selectedtypeContact}
            choices={typeContact.operation.choices}
            on:change={(event) => handleFilterChange(event, 'typeContact')}
        />
        <InputOptions 
            name={selectTP.operation.name}
            identificador="typeProperty"
            value={selectedtypeProperty}
            choices={selectTP.operation.choices}
            on:change={(event) => handleFilterChange(event, 'typeProperty')}
        />
        <InputOptions 
            name={contactStage.operation.name}
            identificador="contactStage"
            value={selectedcontactStage}
            choices={contactStage.operation.choices}
            on:change={(event) => handleFilterChange(event, 'contactStage')}
        />

        <InputNumber 
            name="Presupuesto Máximo"
            identifier="budget"
            value={budget}
           
            on:change={(event) => handleFilterChange(event, 'budget')}
        />
    </div>

   
<!-- </div> -->
<!-- 
<div class="property-filters">
    <h2>Características de la Propiedad</h2> -->
    
    <div class="filters-grid">
        <InputOptions 
            name={propertyOptions.bedrooms.name}
            identificador="bedrooms"
            value={selectedBedrooms}
            choices={propertyOptions.bedrooms.choices}
            on:change={(event) => handleFilterChange(event, 'bedrooms')}
        />
        
        <InputOptions 
            name={propertyOptions.bathrooms.name}
            identificador="bathrooms"
            value={selectedBathrooms}
            choices={propertyOptions.bathrooms.choices}
            on:change={(event) => handleFilterChange(event, 'bathrooms')}
        />

        <InputOptions 
            name={propertyOptions.parking.name}
            identificador="parking"
            value={selectedParking}
            choices={propertyOptions.parking.choices}
            on:change={(event) => handleFilterChange(event, 'parking')}
        />
    </div>

    <div class="filters-grid">

        <InputOptions 
            name={locaProperty.operation.name}
            identificador="locaProperty"
            value={selectedlocaProperty}
            choices={locaProperty.operation.choices}
            on:change={(event) => handleFilterChange(event, 'locaProperty')}
        />

        <InputOptionsMultiple 
            name={tagsProperty.operation.name}
            identificador="tagsProperty"
            value={selectedtagsProperty}
            choices={tagsProperty.operation.choices}
            on:change={(event) => handleFilterChange(event, 'tagsProperty')}
        />

    </div>
    
    {#if showClearButton}
        <Button 
            element="button" 
            variant="solid" 
            on:click={handleClearFilters}
        >
            Limpiar Filtros
        </Button>
    {/if}
</div>

<!-- Agregar sección para mostrar los resultados -->
<div class="results-section">
    {#if hasActiveFilters}
        <h2>Resultados ({filteredContacts.length})</h2>
        
        {#if filteredContacts.length > 0}
            <div class="contacts-grid">
                {#each filteredContacts as contact}
                    <div class="contact-card">
                        <h5>{contact.name} {contact.lastname}</h5>
                        <p>Teléfono: {contact.telephon} Presupuesto: {contact.budget}</p>
                        <p>Recámaras: {contact.numBeds}</p>
                        <p>Ubicación: {contact.locaProperty}</p>
                    </div>
                {/each}
            </div>
        {:else}
            <p>No se encontraron contactos con los filtros seleccionados</p>
        {/if}
    {:else}
        <p>Selecciona al menos un filtro para ver resultados</p>
    {/if}
</div>

<style>
    :global(body) {
        background-color: #111827;
    }

    .title {
        font-size: 1.5rem;
        font-weight: 600;
        color: white;
        margin-bottom: 2rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #374151;
    }

    .operation-filters {
        background-color: #1f2937;
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .operation-filters h3.title {
        font-size: 1.2rem;
        color: #e5e7eb;
        margin-bottom: 1.5rem;
        border-bottom: none;
    }

    .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .results-section {
        background-color: #1f2937;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .results-section h2 {
        font-size: 1.2rem;
        color: #e5e7eb;
        margin-bottom: 1.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #374151;
    }

    .contacts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .contact-card {
        background-color: #111827;
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 1.5rem;
        transition: all 0.2s ease;
    }

    .contact-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        background-color: #1f2937;
    }

    .contact-card h5 {
        font-size: 1.1rem;
        font-weight: 600;
        color: #e5e7eb;
        margin-bottom: 1rem;
    }

    .contact-card p {
        color: #9ca3af;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        line-height: 1.4;
    }

    /* Estilos globales para inputs y selects */
    :global(.input-container) {
        background-color: #111827;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        transition: all 0.2s ease;
    }

    :global(.input-container:hover) {
        background-color: #1f2937;
        border-color: #4b5563;
    }

    :global(.input-label) {
        font-size: 0.9rem;
        font-weight: 500;
        color: #e5e7eb;
        margin-bottom: 0.5rem;
        display: block;
    }

    :global(.input-select) {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #374151;
        border-radius: 6px;
        background-color: #111827;
        color: #e5e7eb;
        font-size: 0.95rem;
    }

    :global(.input-select:focus) {
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        outline: none;
    }

    /* Estilo para el botón */
    :global(button) {
        background-color: #3b82f6;
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 500;
        font-size: 0.95rem;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
    }

    :global(button:hover) {
        background-color: #2563eb;
        transform: translateY(-1px);
    }

    :global(button:active) {
        transform: translateY(0);
    }

    /* Agregar estos estilos específicos para los inputs de fecha */
    :global(input[type="date"]) {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #374151;
        border-radius: 6px;
        background-color: #111827;
        color: #e5e7eb;
        font-size: 0.95rem;
    }

    :global(input[type="date"]::-webkit-calendar-picker-indicator) {
        filter: invert(1);
        cursor: pointer;
    }

    :global(input[type="date"]:focus) {
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        outline: none;
    }

    /* Radiografía de Cartera (Solo Lectura) */
    .audit-shell {
        background-color: #1f2937;
        border: 1px solid #374151;
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        color: #f3f4f6;
    }

    .audit-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .audit-title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.4rem;
    }

    .audit-title-row h2 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
        color: #f9fafb;
    }

    .readonly-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.65rem;
        border-radius: 9999px;
        background: rgba(16, 185, 129, 0.16);
        border: 1px solid rgba(16, 185, 129, 0.45);
        color: #6ee7b7;
        font-size: 0.78rem;
        font-weight: 600;
    }

    .audit-subtitle {
        margin: 0;
        font-size: 0.88rem;
        color: #9ca3af;
        line-height: 1.45;
    }

    .audit-subtitle code,
    .audit-meta-strip code,
    .audit-loading code {
        background: rgba(17, 24, 39, 0.85);
        color: #93c5fd;
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        font-size: 0.82rem;
    }

    .audit-meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        padding: 0.65rem 1rem;
        background: #111827;
        border: 1px solid #374151;
        border-radius: 10px;
        font-size: 0.85rem;
        color: #d1d5db;
        margin-bottom: 1.25rem;
    }

    .audit-alert.error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.5);
        color: #fca5a5;
        padding: 0.9rem 1rem;
        border-radius: 10px;
        font-size: 0.9rem;
    }

    .audit-loading {
        padding: 1.5rem;
        text-align: center;
        color: #93c5fd;
        background: #111827;
        border-radius: 10px;
    }

    .audit-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 0.9rem;
        margin-bottom: 1.5rem;
    }

    .audit-shell button.audit-card {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        text-align: left;
        background-color: #111827;
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 1rem;
        color: #f3f4f6;
        cursor: pointer;
        transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        width: 100%;
    }

    .audit-shell button.audit-card:hover {
        background-color: #182234;
        border-color: #60a5fa;
        transform: translateY(-2px);
    }

    .audit-shell button.audit-card.selected {
        background-color: #172554;
        border-color: #60a5fa;
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.35);
    }

    .audit-shell button.audit-card.card-green { border-left: 4px solid #10b981; }
    .audit-shell button.audit-card.card-blue { border-left: 4px solid #3b82f6; }
    .audit-shell button.audit-card.card-amber { border-left: 4px solid #f59e0b; }
    .audit-shell button.audit-card.card-purple { border-left: 4px solid #8b5cf6; }
    .audit-shell button.audit-card.card-coral { border-left: 4px solid #ef4444; }
    .audit-shell button.audit-card.card-gray { border-left: 4px solid #6b7280; }

    .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.45rem;
    }

    .card-label {
        font-size: 0.88rem;
        font-weight: 600;
        color: #e5e7eb;
    }

    .card-count {
        font-size: 1.45rem;
        font-weight: 800;
        color: #ffffff;
        font-variant-numeric: tabular-nums;
    }

    .card-desc {
        margin: 0;
        font-size: 0.8rem;
        color: #9ca3af;
        line-height: 1.4;
    }

    .card-warn {
        margin: 0.4rem 0 0;
        font-size: 0.78rem;
        color: #fbbf24;
        font-weight: 600;
    }

    .card-subnote {
        margin: 0.35rem 0 0;
        font-size: 0.76rem;
        color: #c4b5fd;
    }

    .audit-preview {
        background: #111827;
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 1rem 1.15rem;
    }

    .audit-preview-toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.85rem;
        margin-bottom: 0.9rem;
    }

    .preview-title-group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem;
    }

    .preview-title-group h3 {
        margin: 0;
        font-size: 1rem;
        color: #f9fafb;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .count-pill {
        background: #1d4ed8;
        color: #eff6ff;
        padding: 0.12rem 0.55rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 700;
    }

    .preview-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.65rem;
    }

    .audit-search-input {
        background: #1f2937;
        border: 1px solid #374151;
        color: #f9fafb;
        border-radius: 8px;
        padding: 0.48rem 0.75rem;
        font-size: 0.86rem;
        min-width: 230px;
    }

    .audit-search-input:focus {
        outline: none;
        border-color: #60a5fa;
    }

    .audit-shell button.audit-action-btn {
        background-color: #2563eb;
        color: #ffffff;
        padding: 0.52rem 0.95rem;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        border: 1px solid #3b82f6;
    }

    .audit-shell button.audit-action-btn.secondary {
        background-color: #065f46;
        border-color: #10b981;
    }

    .audit-shell button.audit-action-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
    }

    .sub-pills-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-bottom: 0.9rem;
    }

    .audit-shell button.sub-pill {
        background-color: #1f2937;
        color: #d1d5db;
        border: 1px solid #374151;
        border-radius: 9999px;
        padding: 0.3rem 0.75rem;
        font-size: 0.78rem;
        font-weight: 600;
    }

    .audit-shell button.sub-pill:hover {
        background-color: #374151;
        color: #ffffff;
    }

    .audit-shell button.sub-pill.active {
        background-color: #2563eb;
        border-color: #60a5fa;
        color: #ffffff;
    }

    .audit-table-wrap {
        overflow-x: auto;
        border: 1px solid #374151;
        border-radius: 8px;
    }

    .audit-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.84rem;
    }

    .audit-table th,
    .audit-table td {
        padding: 0.6rem 0.75rem;
        text-align: left;
        border-bottom: 1px solid #1f2937;
        white-space: nowrap;
    }

    .audit-table th {
        background: #1f2937;
        color: #9ca3af;
        font-weight: 600;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .audit-table tbody tr:hover {
        background: rgba(55, 65, 81, 0.35);
    }

    .contact-name-cell {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #f3f4f6;
    }

    .mini-tag {
        padding: 0.1rem 0.45rem;
        border-radius: 9999px;
        font-size: 0.7rem;
        font-weight: 700;
    }

    .mini-tag.warn {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
    }

    .mini-tag.muted {
        background: rgba(107, 114, 128, 0.25);
        color: #d1d5db;
    }

    .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #d1d5db;
    }

    .stage-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 30px;
        padding: 0.14rem 0.45rem;
        border-radius: 9999px;
        color: #ffffff;
        font-weight: 700;
        font-size: 0.74rem;
    }

    .missing-date {
        color: #f87171;
        font-weight: 600;
    }

    .ficha-link {
        color: #60a5fa;
        text-decoration: none;
        font-weight: 600;
    }

    .ficha-link:hover {
        text-decoration: underline;
    }

    .audit-pagination {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.85rem;
        font-size: 0.82rem;
        color: #9ca3af;
    }

    .pagination-btns {
        display: flex;
        gap: 0.5rem;
    }

    .audit-empty {
        margin: 0;
        padding: 1rem;
        color: #9ca3af;
        text-align: center;
    }

    .legacy-filter-heading {
        font-size: 1.25rem;
        font-weight: 600;
        color: #e5e7eb;
        margin: 0 0 1rem;
    }
</style>
