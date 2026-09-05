<script lang="ts">
  import { db } from '$lib/firebase_toggle';
  import { collection, getDocs } from 'firebase/firestore';
  import { onMount } from 'svelte';

  // ============================================================
  // STATE
  // ============================================================
  let isLoading = true;

  let totalProperties = 0;
  let totalManual = 0;
  let totalSynergy = 0;
  let totalEasyBroker = 0;
  let allProperties: any[] = [];

  // Chart data
  let monthlyData: number[] = Array(12).fill(0);
  let monthlyDataPrev: number[] = Array(12).fill(0);
  let typeData: { label: string; count: number; color: string }[] = [];

  // Tooltip state
  let hoveredBar: number | null = null;
  let hoveredSlice: string | null = null;

  // Table Search & Filter State
  let searchQuery = '';
  let filterSource = 'all'; // 'all' | 'easybroker' | 'manual' | 'synergy'
  let filterProcedencia = 'all'; // 'all' | 'MH' | 'S1' | 'S2' | 'S3'
  let filterOperation = 'all'; // 'all' | 'Venta' | 'Renta'
  let filterType = 'all'; // 'all' | type
  let sortBy = 'newest'; // 'newest' | 'oldest' | 'price_desc' | 'price_asc'
  let currentPage = 1;
  let pageSize = 10;

  // Modal State
  let selectedProperty: any | null = null;
  let activeImageIndex = 0;

  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const TYPE_COLORS: Record<string, string> = {
    'Casa': '#6366f1',
    'Departamento': '#a78bfa',
    'Terreno': '#34d399',
    'Local Comercial': '#f59e0b',
    'Local comercial': '#f59e0b',
    'Oficina': '#60a5fa',
    'Bodega': '#f87171',
    'Edificio': '#c084fc',
    'Casa de Campo': '#2dd4bf',
    'Rancho': '#fb923c',
    'Huerta': '#86efac',
  };

  onMount(() => {
    loadDashboardData();
  });

  async function loadDashboardData() {
    isLoading = true;
    try {
      const snap = await getDocs(collection(db, 'properties'));
      
      const now = new Date();
      const thisYear = now.getFullYear();
      const lastYear = thisYear - 1;

      const monthly = Array(12).fill(0);
      const monthlyPrev = Array(12).fill(0);
      const typeCounts: Record<string, number> = {};

      let manualCount = 0;
      let synergyCount = 0;
      let ebCount = 0;

      const processed = snap.docs.map((d) => {
        const data = d.data();
        const rawKey = String(data.public_id || data.clavePropiedad || d.id || '');
        const ebId = data.easybroker_id ? String(data.easybroker_id) : '';
        
        // Es EasyBroker sólo si tiene clave o ID que comience con EB- o su source explícito sea 'easybroker'
        const isEB = data.source === 'easybroker' || d.id.startsWith('EB-') || rawKey.startsWith('EB-') || ebId.startsWith('EB-');
        
        // Es Sinergia si su source es synergy o su clave / procedencia es S1, S2, S3
        const proc = data.procedencia || (rawKey.startsWith('S1-') ? 'S1' : rawKey.startsWith('S2-') ? 'S2' : rawKey.startsWith('S3-') ? 'S3' : '');
        const isSynergy = !isEB && (data.source === 'synergy' || proc === 'S1' || proc === 'S2' || proc === 'S3');
        
        const docSource = isEB ? 'easybroker' : (isSynergy ? 'synergy' : 'manual');

        if (docSource === 'easybroker') ebCount++;
        else if (docSource === 'synergy') synergyCount++;
        else manualCount++;

        // Resolve the best date object available
        let dateObj: Date | null = null;
        if (data.updatedAtEasybroker) {
          dateObj = new Date(data.updatedAtEasybroker);
        } else if (data.createdAtEasybroker) {
          dateObj = new Date(data.createdAtEasybroker);
        } else if (data.createdAt?.toDate) {
          dateObj = data.createdAt.toDate();
        } else if (data.syncedAt?.toDate) {
          dateObj = data.syncedAt.toDate();
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          const yr = dateObj.getFullYear();
          const mo = dateObj.getMonth();
          if (yr === thisYear) monthly[mo]++;
          else if (yr === lastYear) monthlyPrev[mo]++;
        }

        // Normalize type field
        const t = data.tipoPropiedad ?? data.property_type ?? 'Sin tipo';
        const tNorm = t.charAt(0).toUpperCase() + t.slice(1);
        typeCounts[tNorm] = (typeCounts[tNorm] ?? 0) + 1;

        return {
          id: d.id,
          _source: docSource,
          ...data,
          _sortDate: dateObj && !isNaN(dateObj.getTime()) ? dateObj : new Date(0),
          _displayType: tNorm,
        };
      });

      totalManual = manualCount;
      totalSynergy = synergyCount;
      totalEasyBroker = ebCount;
      totalProperties = processed.length;

      monthlyData = monthly;
      monthlyDataPrev = monthlyPrev;

      // Build sorted type array
      typeData = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
          label,
          count,
          color: TYPE_COLORS[label] ?? '#94a3b8',
        }));

      allProperties = processed;

    } catch (e) {
      console.error('Error cargando datos del dashboard:', e);
    } finally {
      isLoading = false;
    }
  }

  function openPropertyModal(prop: any) {
    selectedProperty = prop;
    activeImageIndex = 0;
  }

  // ============================================================
  // FILTERED & SORTED PROPERTIES
  // ============================================================
  $: filteredProperties = (() => {
    let list = [...allProperties];

    // Filter by query (search clave/id, title, colonia, agent)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const key = (p.easybroker_id ?? p.clavePropiedad ?? p.id ?? '').toLowerCase();
        const title = (p.titulo ?? p.title ?? '').toLowerCase();
        const loc = (p.colonia ?? p.location ?? '').toLowerCase();
        const agent = (p.agente ?? p.agent ?? '').toLowerCase();
        return key.includes(q) || title.includes(q) || loc.includes(q) || agent.includes(q);
      });
    }

    // Filter by source
    if (filterSource !== 'all') {
      list = list.filter((p) => p._source === filterSource);
    }

    // Filter by procedencia
    if (filterProcedencia !== 'all') {
      list = list.filter((p) => {
        const key = p.clavePropiedad || p.easybroker_id || '';
        const proc = p.procedencia || (key.startsWith('S1-') ? 'S1' : key.startsWith('S2-') ? 'S2' : key.startsWith('S3-') ? 'S3' : (key.startsWith('MH-') ? 'MH' : ''));
        return proc === filterProcedencia;
      });
    }

    // Filter by operation
    if (filterOperation !== 'all') {
      list = list.filter((p) => {
        const op = p.tipoOperacion === 'sale' ? 'Venta' : p.tipoOperacion === 'rental' ? 'Renta' : p.tipoOperacion;
        return op === filterOperation;
      });
    }

    // Filter by type
    if (filterType !== 'all') {
      list = list.filter((p) => p._displayType === filterType);
    }

    // Sort
    if (sortBy === 'newest') {
      list.sort((a, b) => b._sortDate.getTime() - a._sortDate.getTime());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => a._sortDate.getTime() - b._sortDate.getTime());
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (Number(b.precio) || 0) - (Number(a.precio) || 0));
    } else if (sortBy === 'price_asc') {
      list.sort((a, b) => (Number(a.precio) || 0) - (Number(b.precio) || 0));
    }

    return list;
  })();

  // Pagination calculation
  $: totalPages = Math.ceil(filteredProperties.length / (pageSize || 1)) || 1;

  $: paginatedProperties = (() => {
    if (pageSize === 0) return filteredProperties;
    const start = (currentPage - 1) * pageSize;
    return filteredProperties.slice(start, start + pageSize);
  })();

  // Reset page when filters change
  $: if (searchQuery || filterSource || filterProcedencia || filterOperation || filterType || sortBy || pageSize) {
    currentPage = 1;
  }

  // ============================================================
  // BAR CHART HELPERS
  // ============================================================
  const CHART_W = 600;
  const CHART_H = 200;
  const BAR_GROUP_W = CHART_W / 12;
  const BAR_W = BAR_GROUP_W * 0.3;
  const BAR_GAP = BAR_GROUP_W * 0.04;

  $: maxBarVal = Math.max(...monthlyData, ...monthlyDataPrev, 1);

  function barHeight(val: number) {
    return (val / maxBarVal) * CHART_H;
  }

  // ============================================================
  // PIE/DONUT CHART HELPERS
  // ============================================================
  const PIE_CX = 130;
  const PIE_CY = 130;
  const PIE_R = 90;
  const PIE_INNER_R = 54;

  $: totalTypeCount = typeData.reduce((s, t) => s + t.count, 0);

  $: pieSlices = (() => {
    if (typeData.length === 0) return [];
    const total = typeData.reduce((s, t) => s + t.count, 0);
    let startAngle = -Math.PI / 2;
    return typeData.map((t) => {
      const angle = (t.count / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const midAngle = startAngle + angle / 2;
      const x1 = PIE_CX + PIE_R * Math.cos(startAngle);
      const y1 = PIE_CY + PIE_R * Math.sin(startAngle);
      const x2 = PIE_CX + PIE_R * Math.cos(endAngle);
      const y2 = PIE_CY + PIE_R * Math.sin(endAngle);
      const xi1 = PIE_CX + PIE_INNER_R * Math.cos(startAngle);
      const yi1 = PIE_CY + PIE_INNER_R * Math.sin(startAngle);
      const xi2 = PIE_CX + PIE_INNER_R * Math.cos(endAngle);
      const yi2 = PIE_CY + PIE_INNER_R * Math.sin(endAngle);
      const large = angle > Math.PI ? 1 : 0;
      const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${PIE_R} ${PIE_R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${PIE_INNER_R} ${PIE_INNER_R} 0 ${large} 0 ${xi1} ${yi1} Z`;
      startAngle = endAngle;
      return { path, label: t.label, count: t.count, color: t.color, midAngle };
    });
  })();

  // ============================================================
  // HELPERS
  // ============================================================
  function formatDate(doc: any) {
    const d = doc._sortDate ?? null;
    if (!d || d.getTime() === 0) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatPrice(price: number | string | null | undefined) {
    if (!price) return '—';
    const num = Number(price);
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num);
  }

  const now = new Date();
</script>

<svelte:head>
  <title>Dashboard – ATAIR CRM</title>
  <meta name="description" content="Panel de control y métricas de propiedades de ATAIR CRM." />
</svelte:head>

<div class="page-container">
  <div class="page-header-row">
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Resumen del portafolio de propiedades · {now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  </div>


  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Cargando catálogo de propiedades...</p>
    </div>
  {:else}
    <!-- ===== STAT CARDS ===== -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🏠</div>
        <div class="stat-value">{totalProperties}</div>
        <div class="stat-label">Total Propiedades</div>
        <div class="stat-sub">
          <span class="badge-eb">EasyBroker {totalEasyBroker}</span>
          <span class="badge-manual">Manual Directa {totalManual}</span>
          {#if totalSynergy > 0}
            <span class="badge-synergy">Sinergias {totalSynergy}</span>
          {/if}
        </div>
      </div>
      <div class="stat-card" style="--card-color: #34d399;">
        <div class="stat-icon" style="background: rgba(52,211,153,0.12);">📅</div>
        <div class="stat-value" style="color: #34d399;">
          {monthlyData[now.getMonth()]}
        </div>
        <div class="stat-label">Actualizadas este mes</div>
      </div>
      <div class="stat-card" style="--card-color: #f59e0b;">
        <div class="stat-icon" style="background: rgba(245,158,11,0.12);">📈</div>
        <div class="stat-value" style="color: #f59e0b;">
          {monthlyData.reduce((a, b) => a + b, 0)}
        </div>
        <div class="stat-label">Actualizadas este año</div>
      </div>
      <div class="stat-card" style="--card-color: #a78bfa;">
        <div class="stat-icon" style="background: rgba(167,139,250,0.12);">🏷️</div>
        <div class="stat-value" style="color: #a78bfa;">{typeData.length}</div>
        <div class="stat-label">Tipos de propiedad</div>
      </div>
    </div>

    <!-- ===== CHARTS ===== -->
    <div class="charts-grid">
      <!-- Bar chart -->
      <div class="chart-card glass">
        <div class="card-head">
          <h3>📊 Actividad por mes</h3>
          <div class="chart-legend-row">
            <span class="legend-dot" style="background:#6366f1;"></span>
            <span>{now.getFullYear()}</span>
            <span class="legend-dot" style="background:#475569;"></span>
            <span>{now.getFullYear() - 1}</span>
          </div>
        </div>
        <div class="bar-chart-wrapper">
          <svg
            viewBox="-30 -10 {CHART_W + 35} {CHART_H + 40}"
            width="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Y axis ticks -->
            {#each [0, 0.25, 0.5, 0.75, 1] as frac}
              {@const yPos = CHART_H - frac * CHART_H}
              {@const val = Math.round(frac * maxBarVal)}
              <line x1="0" y1={yPos} x2={CHART_W} y2={yPos} stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <text x="-4" y={yPos + 4} fill="#64748b" font-size="9" text-anchor="end">{val}</text>
            {/each}

            <!-- Bars -->
            {#each MONTHS as month, i}
              {@const gx = i * BAR_GROUP_W}
              {@const h1 = barHeight(monthlyData[i])}
              {@const h2 = barHeight(monthlyDataPrev[i])}

              <!-- Current year bar -->
              <rect
                role="img"
                aria-label="{month} {now.getFullYear()}: {monthlyData[i]} propiedades"
                x={gx + BAR_GAP * 2}
                y={CHART_H - h1}
                width={BAR_W}
                height={h1}
                fill={hoveredBar === i ? '#818cf8' : '#6366f1'}
                rx="3"
                class="bar"
                on:mouseenter={() => hoveredBar = i}
                on:mouseleave={() => hoveredBar = null}
              >
                <title>{month} {now.getFullYear()}: {monthlyData[i]} propiedades</title>
              </rect>

              <!-- Prev year bar -->
              <rect
                role="img"
                aria-label="{month} {now.getFullYear() - 1}: {monthlyDataPrev[i]} propiedades"
                x={gx + BAR_GAP * 2 + BAR_W + BAR_GAP}
                y={CHART_H - h2}
                width={BAR_W}
                height={h2}
                fill={hoveredBar === i ? '#64748b' : '#334155'}
                rx="3"
                class="bar"
                on:mouseenter={() => hoveredBar = i}
                on:mouseleave={() => hoveredBar = null}
              >
                <title>{month} {now.getFullYear() - 1}: {monthlyDataPrev[i]} propiedades</title>
              </rect>

              <!-- Month label -->
              <text
                x={gx + BAR_GROUP_W / 2}
                y={CHART_H + 14}
                fill={hoveredBar === i ? '#f1f5f9' : '#64748b'}
                font-size="9"
                text-anchor="middle"
              >{month}</text>

              <!-- Hover count -->
              {#if hoveredBar === i && monthlyData[i] > 0}
                <text
                  x={gx + BAR_GAP * 2 + BAR_W / 2}
                  y={CHART_H - h1 - 4}
                  fill="#a5b4fc"
                  font-size="9"
                  text-anchor="middle"
                  font-weight="600"
                >{monthlyData[i]}</text>
              {/if}
            {/each}
          </svg>
        </div>
      </div>

      <!-- Donut chart -->
      <div class="chart-card glass">
        <div class="card-head">
          <h3>🍩 Distribución por Tipo</h3>
        </div>
        {#if typeData.length === 0}
          <div class="chart-empty">Sin datos registrados</div>
        {:else}
          <div class="donut-wrapper">
            <svg viewBox="0 0 260 260" width="200" style="display:block; margin: 0 auto;">
              {#each pieSlices as slice}
                <path
                  role="img"
                  aria-label="{slice.label}: {slice.count} ({Math.round(slice.count / totalTypeCount * 100)}%)"
                  d={slice.path}
                  fill={slice.color}
                  opacity={hoveredSlice === null || hoveredSlice === slice.label ? 1 : 0.4}
                  style="cursor:pointer; transition: opacity 0.2s, transform 0.2s;"
                  transform={hoveredSlice === slice.label
                    ? `translate(${Math.cos(slice.midAngle) * 5} ${Math.sin(slice.midAngle) * 5})`
                    : ''}
                  on:mouseenter={() => hoveredSlice = slice.label}
                  on:mouseleave={() => hoveredSlice = null}
                >
                  <title>{slice.label}: {slice.count} ({Math.round(slice.count / totalTypeCount * 100)}%)</title>
                </path>
              {/each}
              <!-- Center text -->
              <text x={PIE_CX} y={PIE_CY - 6} text-anchor="middle" fill="#f1f5f9" font-size="22" font-weight="800">
                {hoveredSlice
                  ? (typeData.find(t => t.label === hoveredSlice)?.count ?? totalProperties)
                  : totalProperties}
              </text>
              <text x={PIE_CX} y={PIE_CY + 12} text-anchor="middle" fill="#64748b" font-size="9">
                {hoveredSlice ?? 'propiedades'}
              </text>
            </svg>

            <!-- Legend -->
            <div class="donut-legend">
              {#each typeData as t}
                <div
                  class="legend-item"
                  class:legend-active={hoveredSlice === t.label}
                  on:mouseenter={() => hoveredSlice = t.label}
                  on:mouseleave={() => hoveredSlice = null}
                  role="listitem"
                >
                  <span class="legend-dot" style="background:{t.color};"></span>
                  <span class="legend-label">{t.label}</span>
                  <span class="legend-count">{t.count}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ===== FULL PROPERTIES INVENTORY TABLE & CONTROLS ===== -->
    <div class="inventory-section glass">
      <div class="inventory-header">
        <div class="inventory-title-group">
          <h2>📦 Inventario de Propiedades</h2>
          <span class="inventory-count-tag">{filteredProperties.length} propiedades en colección <code>properties</code></span>
        </div>

        <!-- Filter and Search Bar -->
        <div class="inventory-filters">
          <!-- Search box -->
          <div class="search-input-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="search-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por ID (ej. EB-WD1256), título, colonia o agente..."
              bind:value={searchQuery}
              class="search-input"
            />
            {#if searchQuery}
              <button class="search-clear-btn" on:click={() => searchQuery = ''} aria-label="Limpiar búsqueda">✕</button>
            {/if}
          </div>

          <!-- Filter Selects -->
          <div class="filter-selects-row">
            <!-- Origen -->
            <select bind:value={filterSource} class="filter-select">
              <option value="all">Origen: Todos</option>
              <option value="easybroker">EasyBroker</option>
              <option value="manual">Manual Directa</option>
              <option value="synergy">Sinergias</option>
            </select>

            <!-- Procedencia / Red -->
            <select bind:value={filterProcedencia} class="filter-select">
              <option value="all">Red: Todas</option>
              <option value="MH">Match Home (MH)</option>
              <option value="S1">Sinergia 1 (S1)</option>
              <option value="S2">Sinergia 2 (S2)</option>
              <option value="S3">Sinergia 3 (S3)</option>
            </select>

            <!-- Operación -->
            <select bind:value={filterOperation} class="filter-select">
              <option value="all">Operación: Todas</option>
              <option value="Venta">Venta</option>
              <option value="Renta">Renta</option>
            </select>

            <!-- Tipo -->
            <select bind:value={filterType} class="filter-select">
              <option value="all">Tipo: Todos</option>
              {#each typeData as t}
                <option value={t.label}>{t.label} ({t.count})</option>
              {/each}
            </select>

            <!-- Orden -->
            <select bind:value={sortBy} class="filter-select">
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="price_desc">Mayor precio</option>
              <option value="price_asc">Menor precio</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Properties Table -->
      <div class="table-wrapper">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Clave / ID</th>
              <th>Propiedad</th>
              <th>Origen / Red</th>
              <th>Tipo</th>
              <th>Operación</th>
              <th>Colonia / Ubicación</th>
              <th>Precio</th>
              <th>Fotos</th>
              <th>Fecha</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if paginatedProperties.length === 0}
              <tr>
                <td colspan="10" class="empty-table-row">
                  <div class="empty-state">
                    <span style="font-size: 2rem;">🔍</span>
                    <p>No se encontraron propiedades con los filtros seleccionados.</p>
                    {#if searchQuery}
                      <button class="btn-clear-filters" on:click={() => { searchQuery = ''; filterSource = 'all'; filterOperation = 'all'; filterType = 'all'; }}>
                        Limpiar filtros
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {:else}
              {#each paginatedProperties as prop}
                {@const propKey = prop.easybroker_id ?? prop.clavePropiedad ?? prop.id}
                {@const isEB = prop._source === 'easybroker'}
                {@const thumb = prop.imagenMiniatura || prop.imagenPrincipal || (prop.images && prop.images[0]) || ''}
                {@const imgCount = Array.isArray(prop.images) ? prop.images.length : (thumb ? 1 : 0)}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <tr class="prop-row" on:click={() => openPropertyModal(prop)}>
                  <td>
                    <span class="key-badge" class:key-highlight={searchQuery && propKey?.toLowerCase().includes(searchQuery.toLowerCase())}>
                      {propKey ?? '—'}
                    </span>
                  </td>
                  <td>
                    <div class="prop-cell-main">
                      {#if thumb}
                        <img src={thumb} alt={prop.titulo} class="prop-cell-thumb" loading="lazy" />
                      {:else}
                        <div class="prop-cell-no-thumb">🏠</div>
                      {/if}
                      <div class="prop-cell-info">
                        <span class="prop-cell-title" title={prop.titulo ?? prop.title ?? 'Sin título'}>
                          {prop.titulo ?? prop.title ?? 'Sin título'}
                        </span>
                        {#if prop.agente}
                          <span class="prop-cell-agent">👤 {prop.agente}</span>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="source-cell">
                      <span class="source-badge source-{prop._source}">
                        {isEB ? 'EasyBroker' : (prop._source === 'synergy' ? 'Sinergia' : 'Manual')}
                      </span>
                      {#if prop.procedencia || (!isEB && prop.clavePropiedad)}
                        {@const proc = prop.procedencia || (prop.clavePropiedad?.startsWith('S1-') ? 'S1' : prop.clavePropiedad?.startsWith('S2-') ? 'S2' : prop.clavePropiedad?.startsWith('S3-') ? 'S3' : 'MH')}
                        <span class="badge-proc badge-proc-{proc.toLowerCase()}">{proc}</span>
                      {/if}
                      {#if prop.idCompaniaCaptadora || prop.companiaCaptadora}
                        <span class="badge-comp" title="Captada por {prop.companiaCaptadora || prop.idCompaniaCaptadora}">
                          🏢 {prop.companiaCaptadora || prop.idCompaniaCaptadora}
                        </span>
                      {/if}
                      {#if prop.telefonoContactoCaptador}
                        <span class="badge-comp-phone" title="Teléfono captador: {prop.telefonoContactoCaptador}">
                          📞 {prop.telefonoContactoCaptador}
                        </span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <span class="type-pill">{prop._displayType}</span>
                  </td>
                  <td>
                    <span
                      class="op-badge"
                      class:op-venta={prop.tipoOperacion === 'Venta' || prop.tipoOperacion === 'sale'}
                      class:op-renta={prop.tipoOperacion === 'Renta' || prop.tipoOperacion === 'rental'}
                    >
                      {prop.tipoOperacion === 'sale' ? 'Venta' : prop.tipoOperacion === 'rental' ? 'Renta' : (prop.tipoOperacion ?? '—')}
                    </span>
                  </td>
                  <td>
                    <span class="colonia-text" title={prop.colonia ?? '—'}>
                      {prop.colonia ?? '—'}
                    </span>
                  </td>
                  <td class="price-cell">
                    <strong>{formatPrice(prop.precio)}</strong>
                  </td>
                  <td>
                    <span class="photos-count-badge">
                      📷 {imgCount}
                    </span>
                  </td>
                  <td class="date-cell">
                    {formatDate(prop)}
                  </td>
                  <td style="text-align: right;">
                    <button
                      class="btn-view-detail"
                      on:click={(e) => { e.stopPropagation(); openPropertyModal(prop); }}
                      title="Ver galería y detalles completos"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      {#if filteredProperties.length > 0}
        <div class="pagination-footer">
          <div class="page-size-picker">
            <span>Mostrar:</span>
            <select bind:value={pageSize} class="page-size-select">
              <option value={10}>10 por página</option>
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={0}>Todas ({filteredProperties.length})</option>
            </select>
          </div>

          {#if pageSize > 0 && totalPages > 1}
            <div class="pagination-controls">
              <button
                class="btn-page"
                disabled={currentPage <= 1}
                on:click={() => currentPage--}
              >
                ‹ Anterior
              </button>

              <span class="page-info">Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>

              <button
                class="btn-page"
                disabled={currentPage >= totalPages}
                on:click={() => currentPage++}
              >
                Siguiente ›
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- ===== PROPERTY DETAIL MODAL WITH FULL PHOTO GALLERY ===== -->
    {#if selectedProperty}
      {@const galleryImages = (Array.isArray(selectedProperty.images) && selectedProperty.images.length > 0)
        ? selectedProperty.images
        : (selectedProperty.imagenPrincipal ? [selectedProperty.imagenPrincipal] : [])}
      {@const currentImg = galleryImages[activeImageIndex] || galleryImages[0] || selectedProperty.imagenPrincipal || ''}

      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div 
        class="modal-backdrop" 
        on:click={() => selectedProperty = null} 
        on:keydown={(e) => e.key === 'Escape' && (selectedProperty = null)}
        role="presentation"
      >
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div 
          class="modal-card glass" 
          on:click={(e) => e.stopPropagation()} 
          on:keydown={(e) => e.key === 'Escape' && (selectedProperty = null)} 
          role="dialog" 
          aria-modal="true" 
          tabindex="-1"
        >
          <div class="modal-header">
            <div>
              <div class="modal-badge-row">
                <span class="key-badge large">{selectedProperty.easybroker_id ?? selectedProperty.clavePropiedad ?? selectedProperty.id}</span>
                <span class="source-badge source-{selectedProperty._source}">
                  {selectedProperty._source === 'easybroker' ? 'EasyBroker' : (selectedProperty._source === 'synergy' ? 'Sinergia' : 'Manual Directa')}
                </span>
                {#if selectedProperty.procedencia || (selectedProperty._source !== 'easybroker' && selectedProperty.clavePropiedad)}
                  {@const pProc = selectedProperty.procedencia || (selectedProperty.clavePropiedad?.startsWith('S1-') ? 'S1' : selectedProperty.clavePropiedad?.startsWith('S2-') ? 'S2' : selectedProperty.clavePropiedad?.startsWith('S3-') ? 'S3' : 'MH')}
                  <span class="badge-proc badge-proc-{pProc.toLowerCase()}">{selectedProperty.procedenciaNombre || pProc}</span>
                {/if}
                {#if selectedProperty.idCompaniaCaptadora || selectedProperty.companiaCaptadora}
                  <span class="badge-comp">🏢 {selectedProperty.companiaCaptadora || selectedProperty.idCompaniaCaptadora}</span>
                {/if}
                {#if selectedProperty.telefonoContactoCaptador}
                  <span class="badge-comp-phone">📞 {selectedProperty.telefonoContactoCaptador}</span>
                {/if}
                <span class="op-badge op-venta">
                  {selectedProperty.tipoOperacion === 'sale' ? 'Venta' : selectedProperty.tipoOperacion === 'rental' ? 'Renta' : selectedProperty.tipoOperacion}
                </span>
              </div>
              <h2>{selectedProperty.titulo ?? selectedProperty.title ?? 'Sin título'}</h2>
              <p class="modal-location">📍 {selectedProperty.colonia ?? selectedProperty.location ?? 'Ubicación no especificada'}</p>
            </div>
            <button class="modal-close-btn" on:click={() => selectedProperty = null} aria-label="Cerrar modal">✕</button>
          </div>

          <div class="modal-body">
            <!-- Full Interactive Image Carousel / Gallery -->
            {#if galleryImages.length > 0}
              <div class="gallery-container">
                <div class="modal-image-wrap">
                  <img
                    src={currentImg}
                    alt="{selectedProperty.titulo} - Foto {activeImageIndex + 1}"
                    class="modal-main-image"
                  />
                  
                  {#if galleryImages.length > 1}
                    <button
                      class="gallery-nav-btn prev"
                      on:click={() => activeImageIndex = (activeImageIndex - 1 + galleryImages.length) % galleryImages.length}
                      aria-label="Foto anterior"
                    >
                      ‹
                    </button>
                    <button
                      class="gallery-nav-btn next"
                      on:click={() => activeImageIndex = (activeImageIndex + 1) % galleryImages.length}
                      aria-label="Foto siguiente"
                    >
                      ›
                    </button>
                  {/if}

                  <span class="gallery-counter">
                    📷 {activeImageIndex + 1} / {galleryImages.length}
                  </span>
                </div>

                <!-- Thumbnails Strip -->
                {#if galleryImages.length > 1}
                  <div class="thumbnails-strip">
                    {#each galleryImages as img, idx}
                      <button
                        class="thumb-btn"
                        class:thumb-active={activeImageIndex === idx}
                        on:click={() => activeImageIndex = idx}
                      >
                        <img src={img} alt="Miniatura {idx + 1}" loading="lazy" />
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <div class="modal-details-grid">
              <div class="detail-box">
                <span class="detail-label">Precio</span>
                <span class="detail-val price">{formatPrice(selectedProperty.precio)}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Tipo</span>
                <span class="detail-val">{selectedProperty._displayType ?? selectedProperty.tipoPropiedad}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Recámaras</span>
                <span class="detail-val">{selectedProperty.recamaras ?? selectedProperty.bedrooms ?? '—'}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Baños</span>
                <span class="detail-val">{selectedProperty.banos ?? selectedProperty.bathrooms ?? '—'}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Medios baños</span>
                <span class="detail-val">{selectedProperty.mediosBanos ?? selectedProperty.half_bathrooms ?? '—'}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Estacionamientos</span>
                <span class="detail-val">{selectedProperty.estacionamientos ?? selectedProperty.parking_spaces ?? '—'}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Terreno</span>
                <span class="detail-val">{selectedProperty.terreno ?? selectedProperty.lot_size ? `${selectedProperty.terreno ?? selectedProperty.lot_size} m²` : '—'}</span>
              </div>
              <div class="detail-box">
                <span class="detail-label">Construcción</span>
                <span class="detail-val">{selectedProperty.construccion ?? selectedProperty.construction_size ? `${selectedProperty.construccion ?? selectedProperty.construction_size} m²` : '—'}</span>
              </div>
              <div class="detail-box" style="grid-column: span 2;">
                <span class="detail-label">Agente</span>
                <span class="detail-val">{selectedProperty.agente ?? selectedProperty.agent ?? '—'}</span>
              </div>
              {#if selectedProperty.nombreContactoCaptador || selectedProperty.companiaCaptadora || selectedProperty.idCompaniaCaptadora}
                <div class="detail-box">
                  <span class="detail-label">Inmobiliaria / Captador</span>
                  <span class="detail-val" style="color: #fbbf24;">{selectedProperty.companiaCaptadora || selectedProperty.idCompaniaCaptadora} {selectedProperty.nombreContactoCaptador ? `(${selectedProperty.nombreContactoCaptador})` : ''}</span>
                </div>
              {/if}
              {#if selectedProperty.telefonoContactoCaptador}
                <div class="detail-box">
                  <span class="detail-label">Teléfono Captador</span>
                  <span class="detail-val">
                    <a href="https://wa.me/52{String(selectedProperty.telefonoContactoCaptador).replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
                      📞 {selectedProperty.telefonoContactoCaptador} (WhatsApp ↗)
                    </a>
                  </span>
                </div>
              {/if}
              <div class="detail-box" style="grid-column: span 2;">
                <span class="detail-label">Total de Fotos</span>
                <span class="detail-val" style="color: #60a5fa;">{galleryImages.length} fotos disponibles</span>
              </div>
            </div>

            {#if selectedProperty.amenidades && selectedProperty.amenidades.length > 0}
              <div class="modal-amenities">
                <h4>Amenidades y Características</h4>
                <div class="amenities-tags">
                  {#each selectedProperty.amenidades as amenidad}
                    <span class="amenity-tag">✓ {amenidad}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if selectedProperty.descripcion || selectedProperty.description}
              <div class="modal-desc">
                <h4>Descripción</h4>
                <p>{selectedProperty.descripcion ?? selectedProperty.description}</p>
              </div>
            {/if}
          </div>

          <div class="modal-footer">
            {#if selectedProperty.public_url || selectedProperty.easybroker_id}
              <a
                href={selectedProperty.public_url || `https://www.easybroker.com`}
                target="_blank"
                rel="noopener noreferrer"
                class="btn-external"
              >
                Abrir en EasyBroker ↗
              </a>
            {/if}
            <button class="btn-primary" on:click={() => selectedProperty = null}>Cerrar</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  .page-header h1 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
    color: var(--text-primary, #f8fafc);
  }

  .page-header p {
    color: var(--text-muted, #94a3b8);
    font-size: 0.9rem;
    text-transform: capitalize;
  }

  .page-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 5rem 0;
    color: var(--text-muted, #94a3b8);
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: var(--primary, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: var(--radius-xl, 16px);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(99,102,241,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    margin-bottom: 1rem;
  }

  .stat-value {
    font-size: 2.2rem;
    font-weight: 800;
    color: var(--text-primary, #fff);
    line-height: 1;
    margin-bottom: 0.35rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--text-muted, #94a3b8);
    font-weight: 500;
  }

  .stat-sub {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .badge-eb, .badge-manual, .badge-synergy {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
  }

  .badge-eb {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .badge-manual {
    background: rgba(167, 139, 250, 0.15);
    color: #c084fc;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .badge-synergy {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  /* Charts Grid */
  .charts-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  @media (max-width: 1024px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  .glass {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-xl, 16px);
  }

  .chart-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .card-head h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }

  .chart-legend-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: var(--text-muted, #94a3b8);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .bar-chart-wrapper {
    width: 100%;
    overflow: hidden;
  }

  .bar {
    transition: fill 0.15s;
    cursor: pointer;
  }

  /* Donut chart */
  .donut-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
  }

  .chart-empty {
    color: var(--text-muted, #94a3b8);
    text-align: center;
    padding: 3rem 0;
    font-size: 0.9rem;
  }

  .donut-legend {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 140px;
    overflow-y: auto;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: background 0.15s;
    font-size: 0.8rem;
  }

  .legend-item:hover,
  .legend-active {
    background: rgba(255,255,255,0.06);
  }

  .legend-label {
    flex: 1;
    color: var(--text-secondary, #cbd5e1);
  }

  .legend-count {
    font-weight: 700;
    color: var(--text-primary, #fff);
    font-size: 0.78rem;
  }

  /* ===== INVENTORY SECTION ===== */
  .inventory-section {
    border-radius: var(--radius-xl, 16px);
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .inventory-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .inventory-title-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .inventory-title-group h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }

  .inventory-count-tag {
    font-size: 0.78rem;
    color: var(--text-muted, #94a3b8);
    background: rgba(255,255,255,0.05);
    padding: 0.25rem 0.65rem;
    border-radius: 99px;
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  }

  .inventory-count-tag code {
    color: #a5b4fc;
    font-weight: 600;
  }

  .inventory-filters {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    color: var(--text-muted, #94a3b8);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 2.75rem !important;
    font-size: 0.9rem;
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid var(--border-color, rgba(255,255,255,0.12)) !important;
    border-radius: var(--radius-sm, 6px);
    color: var(--text-primary, #fff);
  }

  .search-input:focus {
    border-color: var(--primary, #6366f1) !important;
    background: rgba(255,255,255,0.07) !important;
    outline: none;
  }

  .search-clear-btn {
    position: absolute;
    right: 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-muted, #94a3b8);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
  }

  .search-clear-btn:hover {
    color: var(--text-primary, #fff);
  }

  .filter-selects-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .filter-select {
    padding: 0.5rem 0.85rem;
    background: #181d33;
    border: 1px solid var(--border-color, rgba(255,255,255,0.12));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-secondary, #cbd5e1);
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s;
  }

  .filter-select:focus {
    border-color: var(--primary, #6366f1);
    color: var(--text-primary, #fff);
  }

  /* Table styles */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: var(--radius-md, 10px);
    background: rgba(0,0,0,0.2);
  }

  .inventory-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    text-align: left;
  }

  .inventory-table th {
    padding: 0.75rem 1rem;
    color: var(--text-muted, #94a3b8);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(255,255,255,0.02);
    border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
    white-space: nowrap;
  }

  .inventory-table td {
    padding: 0.85rem 1rem;
    color: var(--text-secondary, #cbd5e1);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: middle;
  }

  .prop-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .prop-row:hover td {
    background: rgba(99, 102, 241, 0.07);
    color: var(--text-primary, #fff);
  }

  .prop-cell-main {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-width: 220px;
  }

  .prop-cell-thumb {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm, 6px);
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .prop-cell-no-thumb {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.08);
  }

  .prop-cell-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .prop-cell-title {
    font-weight: 600;
    color: var(--text-primary, #fff);
    font-size: 0.88rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .prop-cell-agent {
    font-size: 0.72rem;
    color: var(--text-muted, #94a3b8);
  }

  .key-badge {
    font-family: 'Courier New', monospace;
    font-size: 0.78rem;
    font-weight: 700;
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    border: 1px solid rgba(99,102,241,0.25);
  }

  .key-highlight {
    background: rgba(245,158,11,0.2);
    color: #fde68a;
    border-color: rgba(245,158,11,0.5);
  }

  .key-badge.large {
    font-size: 0.9rem;
    padding: 0.35rem 0.75rem;
  }

  .type-pill {
    font-size: 0.75rem;
    color: var(--text-secondary, #cbd5e1);
    background: rgba(255,255,255,0.05);
    padding: 0.15rem 0.5rem;
    border-radius: 99px;
  }

  .source-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
  }

  .source-badge {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  .source-easybroker {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .source-manual {
    background: rgba(167, 139, 250, 0.15);
    color: #c084fc;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .source-synergy {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .badge-comp-phone {
    font-size: 0.68rem;
    font-weight: 600;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 0.08rem 0.35rem;
    border-radius: 0.2rem;
    font-family: monospace;
    white-space: nowrap;
  }

  .badge-proc {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.12rem 0.45rem;
    border-radius: 0.25rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .badge-proc-mh {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.35);
  }

  .badge-proc-s1 {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .badge-proc-s2 {
    background: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.35);
  }

  .badge-proc-s3 {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .badge-comp {
    font-size: 0.68rem;
    font-weight: 500;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.07);
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .op-badge {
    font-size: 0.73rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 2rem;
    white-space: nowrap;
  }

  .op-venta {
    background: rgba(99,102,241,0.15);
    color: #a5b4fc;
  }

  .op-renta {
    background: rgba(52,211,153,0.12);
    color: #6ee7b7;
  }

  .colonia-text {
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
  }

  .price-cell {
    font-size: 0.9rem;
    color: var(--text-primary, #fff);
    white-space: nowrap;
  }

  .photos-count-badge {
    font-size: 0.75rem;
    background: rgba(255,255,255,0.06);
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm, 6px);
    color: var(--text-secondary, #cbd5e1);
    white-space: nowrap;
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  }

  .date-cell {
    font-size: 0.78rem;
    color: var(--text-muted, #94a3b8);
    white-space: nowrap;
  }

  .btn-view-detail {
    padding: 0.3rem 0.75rem;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border-color, rgba(255,255,255,0.12));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-secondary, #cbd5e1);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-view-detail:hover {
    background: var(--primary, #6366f1);
    color: white;
    border-color: var(--primary, #6366f1);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-muted, #94a3b8);
  }

  .btn-clear-filters {
    padding: 0.4rem 0.9rem;
    background: var(--primary, #6366f1);
    color: white;
    border: none;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.8rem;
    cursor: pointer;
  }

  /* Pagination */
  .pagination-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .page-size-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted, #94a3b8);
  }

  .page-size-select {
    padding: 0.35rem 0.6rem;
    background: #181d33;
    border: 1px solid var(--border-color, rgba(255,255,255,0.12));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-secondary, #cbd5e1);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .page-info {
    font-size: 0.82rem;
    color: var(--text-muted, #94a3b8);
  }

  .page-info strong {
    color: var(--text-primary, #fff);
  }

  .btn-page {
    padding: 0.35rem 0.75rem;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border-color, rgba(255,255,255,0.12));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-primary, #fff);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-page:hover:not(:disabled) {
    background: rgba(255,255,255,0.12);
  }

  .btn-page:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ===== PROPERTY DETAIL MODAL ===== */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
    animation: fadeIn 0.2s ease;
  }

  .modal-card {
    width: 100%;
    max-width: 760px;
    max-height: 92vh;
    border-radius: var(--radius-xl, 16px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0f1324 !important;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 24px 60px rgba(0,0,0,0.8);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
    gap: 1rem;
  }

  .modal-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .modal-header h2 {
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 0.35rem;
    color: #fff;
  }

  .modal-location {
    font-size: 0.85rem;
    color: var(--text-muted, #94a3b8);
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: none;
    color: var(--text-secondary, #cbd5e1);
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .modal-close-btn:hover {
    background: rgba(255,255,255,0.15);
    color: white;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Gallery styles */
  .gallery-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .modal-image-wrap {
    position: relative;
    width: 100%;
    height: 340px;
    border-radius: var(--radius-md, 10px);
    overflow: hidden;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-main-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #090a12;
  }

  .gallery-nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0,0,0,0.65);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    width: 38px;
    height: 38px;
    border-radius: 50%;
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    backdrop-filter: blur(4px);
  }

  .gallery-nav-btn:hover {
    background: rgba(99,102,241,0.85);
    transform: translateY(-50%) scale(1.08);
  }

  .gallery-nav-btn.prev { left: 0.75rem; }
  .gallery-nav-btn.next { right: 0.75rem; }

  .gallery-counter {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 0.25rem 0.65rem;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 600;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.15);
  }

  .thumbnails-strip {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .thumb-btn {
    width: 60px;
    height: 45px;
    border-radius: 4px;
    overflow: hidden;
    border: 2px solid transparent;
    padding: 0;
    background: #000;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0.55;
    transition: all 0.15s;
  }

  .thumb-btn:hover {
    opacity: 0.9;
  }

  .thumb-btn.thumb-active {
    opacity: 1;
    border-color: var(--primary, #6366f1);
    transform: scale(1.04);
  }

  .thumb-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .modal-details-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .detail-box {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 0.65rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .detail-label {
    font-size: 0.72rem;
    color: var(--text-muted, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-val {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .detail-val.price {
    color: #34d399;
    font-size: 1rem;
  }

  .modal-amenities {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 1rem;
  }

  .modal-amenities h4 {
    font-size: 0.82rem;
    color: var(--text-muted, #94a3b8);
    text-transform: uppercase;
    margin-bottom: 0.65rem;
  }

  .amenities-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .amenity-tag {
    font-size: 0.78rem;
    background: rgba(99, 102, 241, 0.1);
    color: #c7d2fe;
    padding: 0.25rem 0.65rem;
    border-radius: 99px;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  .modal-desc {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 1rem;
  }

  .modal-desc h4 {
    font-size: 0.82rem;
    color: var(--text-muted, #94a3b8);
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .modal-desc p {
    font-size: 0.85rem;
    color: var(--text-secondary, #cbd5e1);
    line-height: 1.5;
    white-space: pre-line;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, rgba(255,255,255,0.08));
  }

  .btn-external {
    padding: 0.65rem 1.25rem;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border-color, rgba(255,255,255,0.12));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-primary, #fff);
    font-size: 0.85rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-external:hover {
    background: rgba(255,255,255,0.12);
  }

  .btn-primary {
    padding: 0.65rem 1.25rem;
    background: var(--primary, #6366f1);
    border: none;
    border-radius: var(--radius-sm, 6px);
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 768px) {
    .modal-details-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .modal-image-wrap {
      height: 240px;
    }
  }
</style>
