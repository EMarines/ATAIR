<script lang="ts">
  import { db } from '$lib/firebase_toggle';
  import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userProfile } from '$lib/firebase/authManager';

  // ============================================================
  // QUICK ACTIONS / NAVIGATION HUB (Tarjetas de Home)
  // ============================================================
  interface NavAction {
    id: string;
    path: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    adminOnly?: boolean;
  }

  const navActions: NavAction[] = [
    {
      id: 'properties',
      path: '/properties',
      icon: 'fa-solid fa-house',
      title: 'Propiedades',
      description: 'Catálogo y fichas',
      color: '#6366f1'
    },
    {
      id: 'subir-propiedad',
      path: '/subir-propiedad',
      icon: 'fa-solid fa-plus-circle',
      title: 'Subir Propiedad',
      description: 'Alta manual con fotos',
      color: '#10b981',
      adminOnly: true
    },
    {
      id: 'contacts',
      path: '/contacts',
      icon: 'fa-solid fa-users',
      title: 'Contactos',
      description: 'Leads y agentes',
      color: '#8b5cf6',
      adminOnly: true
    },
    {
      id: 'agenda',
      path: '/agenda',
      icon: 'fa-solid fa-calendar-days',
      title: 'Agenda',
      description: 'Citas y tareas',
      color: '#ec4899',
      adminOnly: true
    },
    {
      id: 'tramites',
      path: '/tramites',
      icon: 'fa-solid fa-file-contract',
      title: 'Trámites',
      description: 'Expedientes y control',
      color: '#f59e0b',
      adminOnly: true
    },
    {
      id: 'filtros',
      path: '/filtros',
      icon: 'fa-solid fa-filter',
      title: 'Filtros Lead-Inmueble',
      description: 'Cruce inteligente',
      color: '#06b6d4',
      adminOnly: true
    },
    {
      id: 'herramientas',
      path: '/herramientas',
      icon: 'fa-solid fa-screwdriver-wrench',
      title: 'Herramientas',
      description: 'Sincronización y bots',
      color: '#f97316',
      adminOnly: true
    },
    {
      id: 'actions',
      path: '/actions',
      icon: 'fa-solid fa-gear',
      title: 'Acciones',
      description: 'Configuración global',
      color: '#64748b',
      adminOnly: true
    }
  ];

  function handleNavigate(action: NavAction) {
    if (action.adminOnly && $userProfile?.role !== 'admin') {
      console.warn(`Acceso restringido a ${action.title} para usuarios no-admin`);
      return;
    }
    goto(action.path);
  }

  // ============================================================
  // DASHBOARD STATE
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
  let hoveredMonthIndex: number | null = null;
  let hoveredSlice: string | null = null;

  // Agenda Tasks State
  interface AgendaTodo {
    id: string;
    task: string;
    endTask?: number;
    timeString?: string;
    notes?: string;
    isCompleted?: boolean;
    googleTaskId?: string;
  }
  let pendingTodos: AgendaTodo[] = [];
  let isUpdatingTodo = false;

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
    loadAgendaTodos();
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
        
        const isEB = data.source === 'easybroker' || d.id.startsWith('EB-') || rawKey.startsWith('EB-') || ebId.startsWith('EB-');
        const proc = data.procedencia || (rawKey.startsWith('S1-') ? 'S1' : rawKey.startsWith('S2-') ? 'S2' : rawKey.startsWith('S3-') ? 'S3' : '');
        const isSynergy = !isEB && (data.source === 'synergy' || proc === 'S1' || proc === 'S2' || proc === 'S3');
        
        const docSource = isEB ? 'easybroker' : (isSynergy ? 'synergy' : 'manual');

        if (docSource === 'easybroker') ebCount++;
        else if (docSource === 'synergy') synergyCount++;
        else manualCount++;

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

  // ============================================================
  // LOAD AGENDA TODOS (Firestore)
  // ============================================================
  async function loadAgendaTodos() {
    try {
      const snap = await getDocs(collection(db, 'todos'));
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        endTask: Number(d.data().endTask)
      })) as AgendaTodo[];

      pendingTodos = list
        .filter((t) => !t.isCompleted && t.task)
        .sort((a, b) => {
          const dA = Number(a.endTask) || 0;
          const dB = Number(b.endTask) || 0;
          return dA - dB;
        });
    } catch (err) {
      console.warn('Error cargando pendientes de agenda en dashboard:', err);
    }
  }

  async function toggleTodoStatus(todoItem: AgendaTodo) {
    if (isUpdatingTodo) return;
    isUpdatingTodo = true;
    try {
      const newStatus = !todoItem.isCompleted;
      await updateDoc(doc(db, 'todos', todoItem.id), {
        isCompleted: newStatus
      });

      pendingTodos = pendingTodos.filter((t) => t.id !== todoItem.id);

      if (todoItem.googleTaskId) {
        fetch('/api/tasks/google-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE',
            googleTaskId: todoItem.googleTaskId,
            isCompleted: newStatus,
            status: newStatus ? 'completed' : 'needsAction'
          }),
          keepalive: true
        }).catch((e) => console.warn('Sync error:', e));
      }
    } catch (e) {
      console.error('Error actualizando tarea:', e);
    } finally {
      isUpdatingTodo = false;
    }
  }

  function formatTodoDate(timestamp?: number, timeStr?: string) {
    if (!timestamp || isNaN(timestamp)) return 'Sin fecha';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Sin fecha';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(d);
    itemDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let dayText = '';
    if (diffDays === 0) dayText = 'Hoy';
    else if (diffDays === 1) dayText = 'Mañana';
    else if (diffDays === -1) dayText = 'Ayer';
    else {
      dayText = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    }

    if (timeStr) {
      return `${dayText} · ${timeStr}`;
    }
    return dayText;
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

    if (filterSource !== 'all') {
      list = list.filter((p) => p._source === filterSource);
    }

    if (filterProcedencia !== 'all') {
      list = list.filter((p) => {
        const key = p.clavePropiedad || p.easybroker_id || '';
        const proc = p.procedencia || (key.startsWith('S1-') ? 'S1' : key.startsWith('S2-') ? 'S2' : key.startsWith('S3-') ? 'S3' : (key.startsWith('MH-') ? 'MH' : ''));
        return proc === filterProcedencia;
      });
    }

    if (filterOperation !== 'all') {
      list = list.filter((p) => {
        const op = p.tipoOperacion === 'sale' ? 'Venta' : p.tipoOperacion === 'rental' ? 'Renta' : p.tipoOperacion;
        return op === filterOperation;
      });
    }

    if (filterType !== 'all') {
      list = list.filter((p) => p._displayType === filterType);
    }

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

  $: totalPages = Math.ceil(filteredProperties.length / (pageSize || 1)) || 1;

  $: paginatedProperties = (() => {
    if (pageSize === 0) return filteredProperties;
    const start = (currentPage - 1) * pageSize;
    return filteredProperties.slice(start, start + pageSize);
  })();

  $: if (searchQuery || filterSource || filterProcedencia || filterOperation || filterType || sortBy || pageSize) {
    currentPage = 1;
  }

  // ============================================================
  // COMPACT SPARKLINE / LINE CHART HELPERS
  // ============================================================
  const SVG_W = 540;
  const SVG_H = 135;
  const PAD_L = 32;
  const PAD_R = 20;
  const PAD_T = 16;
  const PAD_B = 24;

  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;

  $: maxVal = Math.max(...monthlyData, ...monthlyDataPrev, 1);

  function getX(index: number) {
    return PAD_L + (index / 11) * PLOT_W;
  }

  function getY(val: number) {
    return PAD_T + PLOT_H - (val / maxVal) * PLOT_H;
  }

  function createLinePath(data: number[]): string {
    if (!data.length) return '';
    return data.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
  }

  function createAreaPath(data: number[]): string {
    if (!data.length) return '';
    const line = data.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
    const lastX = getX(data.length - 1).toFixed(1);
    const bottomY = (PAD_T + PLOT_H).toFixed(1);
    const firstX = getX(0).toFixed(1);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }

  $: currentYearPath = createLinePath(monthlyData);
  $: currentYearArea = createAreaPath(monthlyData);
  $: prevYearPath = createLinePath(monthlyDataPrev);

  // ============================================================
  // PIE/DONUT CHART HELPERS
  // ============================================================
  const PIE_CX = 110;
  const PIE_CY = 110;
  const PIE_R = 82;
  const PIE_INNER_R = 50;

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
  <title>ATAIR CRM – Panel de Control</title>
  <meta name="description" content="Panel de control central, inventario y métricas operativas de ATAIR CRM." />
</svelte:head>

<div class="page-container">
  <!-- ===== HEADER PRINCIPAL ===== -->
  <div class="page-header-row">
    <div class="page-header">
      <div class="header-badge-tag">
        <span class="live-dot"></span>
        <span>Centro de Mando Inmobiliario</span>
      </div>
      <h1 class="main-title">Dashboard Principal</h1>
      <p class="main-subtitle">Portafolio activo, métricas de inventario y tareas operativas · {now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  </div>

  <!-- ===== QUICK ACCESS NAVIGATION HUB (Tarjetas de Home) ===== -->
  <section class="quick-nav-section glass">
    <div class="section-title-row">
      <div class="title-with-icon">
        <i class="fa-solid fa-compass"></i>
        <h2>Accesos Rápidos al Sistema</h2>
      </div>
      <span class="section-badge">Navegación</span>
    </div>

    <div class="nav-cards-grid">
      {#each navActions as action}
        {@const isRestricted = action.adminOnly && $userProfile?.role !== 'admin'}
        <button
          class="nav-card"
          class:disabled={isRestricted}
          on:click={() => handleNavigate(action)}
          disabled={isRestricted}
          style="--action-color: {action.color};"
        >
          <div class="nav-card-icon-wrap">
            <i class={action.icon}></i>
          </div>
          <div class="nav-card-body">
            <h3>{action.title}</h3>
            <p>{action.description}</p>
          </div>
          <i class="fa-solid fa-arrow-right nav-card-arrow"></i>
        </button>
      {/each}
    </div>
  </section>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Cargando panel de control e inventario...</p>
    </div>
  {:else}
    <!-- ===== METRICS & INTELLIGENCE GRID ===== -->
    <div class="main-dashboard-grid">
      <!-- COLUMNA IZQUIERDA: AGENDA (ARRIBA) & ACTIVIDAD MENSUAL (ABAJO) -->
      <div class="left-metrics-col">
        <!-- 1. WIDGET DE PENDIENTES DE LA AGENDA (ARRIBA) -->
        <div class="agenda-widget-card glass">
          <div class="widget-header">
            <div class="widget-title-group">
              <i class="fa-solid fa-calendar-check" style="color: #ec4899;"></i>
              <h3>Pendientes de Agenda</h3>
              {#if pendingTodos.length > 0}
                <span class="todo-count-badge">{pendingTodos.length}</span>
              {/if}
            </div>
            <button class="btn-widget-link" on:click={() => goto('/agenda')} title="Ir a la Agenda completa">
              Ver Agenda ↗
            </button>
          </div>

          <div class="agenda-todos-list">
            {#if pendingTodos.length === 0}
              <div class="todos-empty-state">
                <i class="fa-regular fa-circle-check"></i>
                <p>¡Al día! No hay compromisos ni tareas pendientes.</p>
                <button class="btn-create-todo" on:click={() => goto('/agenda')}>+ Programar cita</button>
              </div>
            {:else}
              {#each pendingTodos.slice(0, 4) as item}
                <div class="todo-item-row" class:updating={isUpdatingTodo}>
                  <button
                    class="todo-check-btn"
                    on:click={() => toggleTodoStatus(item)}
                    title="Marcar como completada"
                    aria-label="Marcar como completada"
                  >
                    <i class="fa-regular fa-circle"></i>
                  </button>
                  <div class="todo-info">
                    <span class="todo-task-title" title={item.task}>{item.task}</span>
                    <div class="todo-meta">
                      <span class="todo-date-badge">
                        <i class="fa-regular fa-clock"></i>
                        {formatTodoDate(item.endTask, item.timeString)}
                      </span>
                      {#if item.notes}
                        <span class="todo-notes-preview" title={item.notes}>{item.notes}</span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}

              {#if pendingTodos.length > 4}
                <div class="more-todos-indicator">
                  <span>+ {pendingTodos.length - 4} tareas adicionales en la agenda</span>
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <!-- 2. Compact Line Chart: ACTIVIDAD MENSUAL (ABAJO) -->
        <div class="chart-card glass">
          <div class="card-head">
            <div class="chart-title-wrap">
              <i class="fa-solid fa-chart-line" style="color: #6366f1;"></i>
              <h3>Actividad Mensual de Captación</h3>
            </div>
            <div class="chart-legend-row">
              <span class="legend-dot" style="background:#6366f1;"></span>
              <span>{now.getFullYear()}</span>
              <span class="legend-dot" style="background:#94a3b8;"></span>
              <span>{now.getFullYear() - 1}</span>
            </div>
          </div>

          <div class="line-chart-container">
            <svg viewBox="0 0 {SVG_W} {SVG_H}" class="compact-line-svg" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
                </linearGradient>
              </defs>

              <!-- Horizontal Guide Lines -->
              {#each [0, 0.5, 1] as frac}
                {@const y = PAD_T + PLOT_H - frac * PLOT_H}
                <line x1={PAD_L} y1={y} x2={SVG_W - PAD_R} y2={y} class="chart-grid-line" stroke-dasharray="2,2"/>
                <text x={PAD_L - 6} y={y + 3} class="chart-axis-text" font-size="8.5" text-anchor="end">{Math.round(frac * maxVal)}</text>
              {/each}

              <!-- Area Fill for current year -->
              {#if currentYearArea}
                <path d={currentYearArea} fill="url(#chartGradient)" />
              {/if}

              <!-- Previous Year Line (dashed) -->
              {#if prevYearPath}
                <path d={prevYearPath} fill="none" class="chart-prev-line" stroke-width="1.5" stroke-dasharray="3,3"/>
              {/if}

              <!-- Current Year Line -->
              {#if currentYearPath}
                <path d={currentYearPath} fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              {/if}

              <!-- Interactive Points & Month Labels -->
              {#each MONTHS as month, i}
                {@const px = getX(i)}
                {@const py = getY(monthlyData[i])}
                {@const isHovered = hoveredMonthIndex === i}

                <!-- Month Label -->
                <text
                  x={px}
                  y={SVG_H - 8}
                  class="chart-month-label"
                  class:hovered={isHovered}
                  font-size="8.5"
                  font-weight={isHovered ? '700' : '500'}
                  text-anchor="middle"
                >
                  {month}
                </text>

                <!-- Interactive Hover Zone -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <rect
                  x={px - 14}
                  y={PAD_T}
                  width="28"
                  height={PLOT_H + 10}
                  fill="transparent"
                  style="cursor: pointer;"
                  on:mouseenter={() => hoveredMonthIndex = i}
                  on:mouseleave={() => hoveredMonthIndex = null}
                />

                <!-- Data point -->
                <circle
                  cx={px}
                  cy={py}
                  r={isHovered ? 5 : 3}
                  fill={isHovered ? '#818cf8' : '#6366f1'}
                  stroke="var(--surface-1, #ffffff)"
                  stroke-width="1.5"
                  style="transition: r 0.15s ease;"
                />

                <!-- Tooltip popup on hover -->
                {#if isHovered}
                  <g>
                    <rect
                      x={px - 28}
                      y={py - 24}
                      width="56"
                      height="18"
                      rx="4"
                      class="chart-tooltip-bg"
                    />
                    <text
                      x={px}
                      y={py - 12}
                      class="chart-tooltip-text"
                      font-size="8.5"
                      font-weight="700"
                      text-anchor="middle"
                    >
                      {monthlyData[i]} props
                    </text>
                  </g>
                {/if}
              {/each}
            </svg>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: TARJETA UNIFICADA (TOTAL PROPIEDADES + DESGLOSE ORIGEN + DONUT TIPO) -->
      <div class="unified-portfolio-card glass">
        <!-- Header con Total de Propiedades -->
        <div class="portfolio-card-header">
          <div class="portfolio-title-group">
            <div class="portfolio-icon-badge">🏠</div>
            <div>
              <span class="kpi-tag">Portafolio General</span>
              <h3 class="portfolio-title">Inventario & Distribución</h3>
            </div>
          </div>
          <div class="portfolio-total-display">
            <span class="total-big-val">{totalProperties}</span>
            <span class="total-label">Propiedades</span>
          </div>
        </div>

        <!-- Desglose por Origen / Procedencia (¿Cómo se obtuvieron?) -->
        <div class="sources-breakdown-panel">
          <div class="sources-breakdown-title">
            <i class="fa-solid fa-network-wired" style="color: #6366f1;"></i>
            <span>Canales de Captación & Origen</span>
          </div>
          <div class="sources-pill-row">
            <div class="source-pill-card eb">
              <div class="source-pill-icon">🌐</div>
              <div class="source-pill-content">
                <span class="source-pill-label">EasyBroker</span>
                <span class="source-pill-val">{totalEasyBroker}</span>
                <span class="source-pill-pct">{totalProperties ? Math.round((totalEasyBroker / totalProperties) * 100) : 0}%</span>
              </div>
            </div>

            <div class="source-pill-card manual">
              <div class="source-pill-icon">✍️</div>
              <div class="source-pill-content">
                <span class="source-pill-label">Manual Directa</span>
                <span class="source-pill-val">{totalManual}</span>
                <span class="source-pill-pct">{totalProperties ? Math.round((totalManual / totalProperties) * 100) : 0}%</span>
              </div>
            </div>

            {#if totalSynergy > 0}
              <div class="source-pill-card synergy">
                <div class="source-pill-icon">🤝</div>
                <div class="source-pill-content">
                  <span class="source-pill-label">Sinergias</span>
                  <span class="source-pill-val">{totalSynergy}</span>
                  <span class="source-pill-pct">{totalProperties ? Math.round((totalSynergy / totalProperties) * 100) : 0}%</span>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Gráfica Donut & Distribución por Tipo -->
        <div class="donut-section-wrapper">
          <div class="donut-sub-header">
            <i class="fa-solid fa-chart-pie" style="color: #a78bfa;"></i>
            <h4>Distribución por Tipo de Inmueble</h4>
          </div>

          {#if typeData.length === 0}
            <div class="chart-empty">Sin datos registrados</div>
          {:else}
            <div class="donut-content-layout">
              <div class="donut-svg-wrap">
                <svg viewBox="0 0 220 220" width="165" style="display:block; margin: 0 auto;">
                  {#each pieSlices as slice}
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <path
                      role="img"
                      aria-label="{slice.label}: {slice.count} ({Math.round(slice.count / totalTypeCount * 100)}%)"
                      d={slice.path}
                      fill={slice.color}
                      opacity={hoveredSlice === null || hoveredSlice === slice.label ? 1 : 0.4}
                      style="cursor:pointer; transition: opacity 0.2s, transform 0.2s;"
                      transform={hoveredSlice === slice.label
                        ? `translate(${Math.cos(slice.midAngle) * 4} ${Math.sin(slice.midAngle) * 4})`
                        : ''}
                      on:mouseenter={() => hoveredSlice = slice.label}
                      on:mouseleave={() => hoveredSlice = null}
                    >
                      <title>{slice.label}: {slice.count} ({Math.round(slice.count / totalTypeCount * 100)}%)</title>
                    </path>
                  {/each}
                  <!-- Center text -->
                  <text x={PIE_CX} y={PIE_CY - 4} text-anchor="middle" class="donut-center-num" font-size="18" font-weight="800">
                    {hoveredSlice
                      ? (typeData.find(t => t.label === hoveredSlice)?.count ?? totalProperties)
                      : totalProperties}
                  </text>
                  <text x={PIE_CX} y={PIE_CY + 10} text-anchor="middle" class="donut-center-sub" font-size="8.5">
                    {hoveredSlice ?? 'propiedades'}
                  </text>
                </svg>
              </div>

              <!-- Legend -->
              <div class="donut-legend compact">
                {#each typeData as t}
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
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
    </div>

    <!-- ===== FULL PROPERTIES INVENTORY TABLE & CONTROLS ===== -->
    <div class="inventory-section glass">
      <div class="inventory-header">
        <div class="inventory-title-group">
          <div class="title-with-icon">
            <i class="fa-solid fa-boxes-stacked" style="color: #6366f1;"></i>
            <h2>Inventario Completo de Propiedades</h2>
          </div>
          <span class="inventory-count-tag">{filteredProperties.length} propiedades en catálogo</span>
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
              placeholder="Buscar por ID (ej. EB-WD1256), título, colonia o captador..."
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
                    <a href="https://wa.me/52{String(selectedProperty.telefonoContactoCaptador).replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: none; font-weight: 600;">
                      📞 {selectedProperty.telefonoContactoCaptador} (WhatsApp ↗)
                    </a>
                  </span>
                </div>
              {/if}
              <div class="detail-box" style="grid-column: span 2;">
                <span class="detail-label">Total de Fotos</span>
                <span class="detail-val" style="color: #6366f1;">{galleryImages.length} fotos disponibles</span>
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
                href={selectedProperty.public_url || 'https://www.easybroker.com'}
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
    padding: 1.5rem 1.5rem 4rem;
    color: var(--color, #18181b);
  }

  .page-header-row {
    margin-bottom: 1.5rem;
  }

  .header-badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--brand, #4f46e5);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  :global([data-theme="dark"]) .header-badge-tag {
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.25);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .main-title {
    font-size: 1.85rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
    color: var(--title-heading, var(--color, #18181b));
  }

  .main-subtitle {
    color: var(--text-muted, #64748b);
    font-size: 0.88rem;
    text-transform: capitalize;
  }

  /* ===== GLASS CARDS (THEME ADAPTIVE) ===== */
  .glass {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border, #e4e4e7);
    border-radius: var(--radius-xl, 16px);
    box-shadow: var(--card-shadow, 0 4px 16px rgba(0, 0, 0, 0.06));
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  :global([data-theme="dark"]) .glass {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  }

  /* ===== QUICK NAV SECTION (TARJETAS DE HOME) ===== */
  .quick-nav-section {
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .title-with-icon i {
    font-size: 1.15rem;
    color: var(--brand, #4f46e5);
  }

  .title-with-icon h2 {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #18181b));
    margin: 0;
  }

  .section-badge {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #64748b);
    background: rgba(0, 0, 0, 0.05);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  :global([data-theme="dark"]) .section-badge {
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.85rem;
  }

  .nav-card {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.85rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  :global([data-theme="dark"]) .nav-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .nav-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 3.5px;
    height: 100%;
    background: var(--action-color, #6366f1);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .nav-card:hover:not(.disabled) {
    transform: translateY(-3px);
    background: #ffffff;
    border-color: var(--action-color, #6366f1);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  }

  :global([data-theme="dark"]) .nav-card:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }

  .nav-card:hover:not(.disabled)::before {
    opacity: 1;
  }

  .nav-card-icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    color: var(--action-color, #6366f1);
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  :global([data-theme="dark"]) .nav-card-icon-wrap {
    background: rgba(255, 255, 255, 0.06);
  }

  .nav-card:hover:not(.disabled) .nav-card-icon-wrap {
    transform: scale(1.08);
  }

  .nav-card-body {
    flex: 1;
    min-width: 0;
  }

  .nav-card-body h3 {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--color, #0f172a);
    margin: 0 0 0.15rem 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-card-body p {
    font-size: 0.72rem;
    color: var(--text-muted, #64748b);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-card-arrow {
    font-size: 0.75rem;
    color: var(--text-muted, #94a3b8);
    opacity: 0.7;
    transition: all 0.2s ease;
  }

  .nav-card:hover:not(.disabled) .nav-card-arrow {
    color: var(--action-color, #6366f1);
    opacity: 1;
    transform: translateX(3px);
  }

  .nav-card.disabled {
    cursor: not-allowed;
    opacity: 0.4;
    filter: grayscale(1);
  }

  /* ===== MAIN DASHBOARD GRID ===== */
  .main-dashboard-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
    align-items: stretch;
  }

  @media (max-width: 1080px) {
    .main-dashboard-grid {
      grid-template-columns: 1fr;
    }
  }

  .left-metrics-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Chart Card */
  .chart-card {
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .chart-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chart-title-wrap h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #0f172a));
    margin: 0;
  }

  .chart-legend-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .line-chart-container {
    width: 100%;
    overflow: hidden;
  }

  .compact-line-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-grid-line {
    stroke: #e2e8f0;
    stroke-width: 1;
  }

  :global([data-theme="dark"]) .chart-grid-line {
    stroke: rgba(255, 255, 255, 0.08);
  }

  .chart-axis-text {
    fill: var(--text-muted, #64748b);
  }

  .chart-prev-line {
    stroke: #94a3b8;
    opacity: 0.75;
  }

  :global([data-theme="dark"]) .chart-prev-line {
    stroke: #64748b;
  }

  .chart-month-label {
    fill: var(--text-muted, #64748b);
  }

  .chart-month-label.hovered {
    fill: var(--color, #0f172a);
  }

  :global([data-theme="dark"]) .chart-month-label.hovered {
    fill: #f8fafc;
  }

  .chart-tooltip-bg {
    fill: #1e1b4b;
    stroke: #6366f1;
    stroke-width: 1;
  }

  :global([data-theme="light"]) .chart-tooltip-bg {
    fill: #0f172a;
    stroke: #6366f1;
  }

  .chart-tooltip-text {
    fill: #ffffff;
  }

  /* Agenda Widget */
  .agenda-widget-card {
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--border, #e4e4e7);
  }

  :global([data-theme="dark"]) .widget-header {
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .widget-title-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .widget-title-group h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #0f172a));
    margin: 0;
  }

  .todo-count-badge {
    font-size: 0.7rem;
    font-weight: 800;
    background: #ec4899;
    color: white;
    padding: 0.1rem 0.45rem;
    border-radius: 99px;
  }

  .btn-widget-link {
    font-size: 0.78rem;
    font-weight: 600;
    color: #db2777;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  :global([data-theme="dark"]) .btn-widget-link {
    color: #f472b6;
  }

  .btn-widget-link:hover {
    text-decoration: underline;
    opacity: 0.85;
  }

  .agenda-todos-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    flex: 1;
    justify-content: center;
  }

  .todo-item-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  :global([data-theme="dark"]) .todo-item-row {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .todo-item-row:hover {
    background: #f1f5f9;
    border-color: rgba(236, 72, 153, 0.4);
  }

  :global([data-theme="dark"]) .todo-item-row:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(236, 72, 153, 0.3);
  }

  .todo-item-row.updating {
    opacity: 0.5;
    pointer-events: none;
  }

  .todo-check-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #94a3b8);
    font-size: 1.15rem;
    cursor: pointer;
    padding: 0.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }

  .todo-check-btn:hover {
    color: #10b981;
  }

  .todo-info {
    flex: 1;
    min-width: 0;
  }

  .todo-task-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color, #0f172a);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .todo-meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.15rem;
  }

  .todo-date-badge {
    font-size: 0.7rem;
    font-weight: 700;
    color: #db2777;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  :global([data-theme="dark"]) .todo-date-badge {
    color: #ec4899;
  }

  .todo-notes-preview {
    font-size: 0.7rem;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .more-todos-indicator {
    text-align: center;
    font-size: 0.72rem;
    color: var(--text-muted, #64748b);
    padding-top: 0.2rem;
  }

  .todos-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.25rem 0;
    text-align: center;
    color: var(--text-muted, #64748b);
    gap: 0.4rem;
  }

  .todos-empty-state i {
    font-size: 1.6rem;
    color: #10b981;
    opacity: 0.9;
  }

  .todos-empty-state p {
    font-size: 0.82rem;
    margin: 0;
    color: var(--color, #18181b);
    font-weight: 500;
  }

  .btn-create-todo {
    margin-top: 0.2rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.35rem 0.85rem;
    background: rgba(236, 72, 153, 0.1);
    color: #db2777;
    border: 1px solid rgba(236, 72, 153, 0.3);
    border-radius: 6px;
    cursor: pointer;
  }

  :global([data-theme="dark"]) .btn-create-todo {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
  }

  /* ===== TARJETA UNIFICADA ===== */
  .unified-portfolio-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    justify-content: space-between;
  }

  .portfolio-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border, #e4e4e7);
  }

  :global([data-theme="dark"]) .portfolio-card-header {
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .portfolio-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .portfolio-icon-badge {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(99, 102, 241, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
  }

  .kpi-tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4f46e5;
    background: rgba(99, 102, 241, 0.1);
    padding: 0.15rem 0.5rem;
    border-radius: 99px;
    display: inline-block;
    margin-bottom: 0.2rem;
  }

  :global([data-theme="dark"]) .kpi-tag {
    color: #818cf8;
  }

  .portfolio-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #0f172a));
    margin: 0;
  }

  .portfolio-total-display {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .total-big-val {
    font-size: 2.25rem;
    font-weight: 800;
    color: var(--color, #0f172a);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  :global([data-theme="dark"]) .total-big-val {
    color: #ffffff;
  }

  .total-label {
    font-size: 0.72rem;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  /* Sources Breakdown Panel */
  .sources-breakdown-panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .sources-breakdown-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #1e293b));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sources-pill-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.6rem;
  }

  .source-pill-card {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    transition: all 0.15s ease;
  }

  :global([data-theme="dark"]) .source-pill-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .source-pill-card:hover {
    background: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  :global([data-theme="dark"]) .source-pill-card:hover {
    background: rgba(255, 255, 255, 0.05);
    box-shadow: none;
  }

  .source-pill-card.eb {
    border-left: 3.5px solid #6366f1;
  }
  .source-pill-card.manual {
    border-left: 3.5px solid #a855f7;
  }
  .source-pill-card.synergy {
    border-left: 3.5px solid #10b981;
  }

  .source-pill-icon {
    font-size: 1.1rem;
  }

  .source-pill-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .source-pill-label {
    font-size: 0.68rem;
    color: var(--text-muted, #64748b);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .source-pill-val {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--color, #0f172a);
    line-height: 1.2;
  }

  :global([data-theme="dark"]) .source-pill-val {
    color: #f8fafc;
  }

  .source-pill-pct {
    font-size: 0.65rem;
    color: var(--text-muted, #94a3b8);
    font-weight: 600;
  }

  /* Donut section */
  .donut-section-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border, #e4e4e7);
  }

  :global([data-theme="dark"]) .donut-section-wrapper {
    border-top-color: rgba(255, 255, 255, 0.06);
  }

  .donut-sub-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .donut-sub-header h4 {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #1e293b));
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .donut-content-layout {
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 1rem;
  }

  @media (max-width: 600px) {
    .donut-content-layout {
      flex-direction: column;
    }
  }

  .donut-center-num {
    fill: var(--color, #0f172a);
  }

  :global([data-theme="dark"]) .donut-center-num {
    fill: #f8fafc;
  }

  .donut-center-sub {
    fill: var(--text-muted, #64748b);
  }

  .donut-legend.compact {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 140px;
    overflow-y: auto;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.25rem 0.45rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
    font-size: 0.78rem;
  }

  .legend-item:hover,
  .legend-active {
    background: #f1f5f9;
  }

  :global([data-theme="dark"]) .legend-item:hover,
  :global([data-theme="dark"]) .legend-active {
    background: rgba(255, 255, 255, 0.06);
  }

  .legend-label {
    flex: 1;
    color: var(--color, #334155);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .legend-count {
    font-weight: 700;
    color: var(--color, #0f172a);
    font-size: 0.78rem;
  }

  .chart-empty {
    color: var(--text-muted, #64748b);
    text-align: center;
    padding: 1.5rem 0;
    font-size: 0.85rem;
  }

  /* ===== INVENTORY SECTION ===== */
  .inventory-section {
    padding: 1.5rem;
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
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #0f172a));
    margin: 0;
  }

  .inventory-count-tag {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    background: rgba(0, 0, 0, 0.04);
    padding: 0.2rem 0.6rem;
    border-radius: 99px;
    border: 1px solid var(--border, #e4e4e7);
  }

  :global([data-theme="dark"]) .inventory-count-tag {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
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
    padding: 0.7rem 2.5rem 0.7rem 2.75rem !important;
    font-size: 0.88rem;
    background: #ffffff !important;
    border: 1px solid var(--border, #cbd5e1) !important;
    border-radius: 8px;
    color: var(--color, #0f172a) !important;
  }

  :global([data-theme="dark"]) .search-input {
    background: rgba(255, 255, 255, 0.04) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: #ffffff !important;
  }

  .search-input:focus {
    border-color: #6366f1 !important;
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

  .filter-selects-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-select {
    padding: 0.5rem 0.85rem;
    background: #ffffff;
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 6px;
    color: var(--color, #334155);
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s;
  }

  :global([data-theme="dark"]) .filter-select {
    background: #181d33;
    border-color: rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
  }

  .filter-select:focus {
    border-color: #6366f1;
  }

  /* Table styles */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border, #e4e4e7);
    border-radius: 10px;
    background: #ffffff;
  }

  :global([data-theme="dark"]) .table-wrapper {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
  }

  .inventory-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
    text-align: left;
  }

  .inventory-table th {
    padding: 0.75rem 0.85rem;
    color: var(--text-muted, #475569);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: #f8fafc;
    border-bottom: 1px solid var(--border, #e2e8f0);
    white-space: nowrap;
  }

  :global([data-theme="dark"]) .inventory-table th {
    background: rgba(255, 255, 255, 0.02);
    border-bottom-color: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }

  .inventory-table td {
    padding: 0.8rem 0.85rem;
    color: var(--color, #334155);
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  :global([data-theme="dark"]) .inventory-table td {
    color: #cbd5e1;
    border-bottom-color: rgba(255, 255, 255, 0.04);
  }

  .prop-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .prop-row:hover td {
    background: rgba(99, 102, 241, 0.06);
  }

  .prop-cell-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 200px;
  }

  .prop-cell-thumb {
    width: 42px;
    height: 42px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid #e2e8f0;
  }

  :global([data-theme="dark"]) .prop-cell-thumb {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .prop-cell-no-thumb {
    width: 42px;
    height: 42px;
    border-radius: 6px;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
    border: 1px solid #e2e8f0;
  }

  :global([data-theme="dark"]) .prop-cell-no-thumb {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .prop-cell-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .prop-cell-title {
    font-weight: 600;
    color: var(--color, #0f172a);
    font-size: 0.86rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .prop-cell-agent {
    font-size: 0.72rem;
    color: var(--text-muted, #64748b);
  }

  .key-badge {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba(99, 102, 241, 0.1);
    color: #4f46e5;
    padding: 0.15rem 0.45rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  :global([data-theme="dark"]) .key-badge {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
  }

  .key-highlight {
    background: rgba(245, 158, 11, 0.2);
    color: #b45309;
    border-color: rgba(245, 158, 11, 0.5);
  }

  :global([data-theme="dark"]) .key-highlight {
    color: #fde68a;
  }

  .key-badge.large {
    font-size: 0.9rem;
    padding: 0.35rem 0.75rem;
  }

  .type-pill {
    font-size: 0.72rem;
    color: var(--color, #334155);
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 99px;
  }

  :global([data-theme="dark"]) .type-pill {
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
  }

  .source-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    align-items: flex-start;
  }

  .source-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  .source-easybroker {
    background: rgba(99, 102, 241, 0.12);
    color: #4338ca;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  :global([data-theme="dark"]) .source-easybroker {
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.15);
  }

  .source-manual {
    background: rgba(167, 139, 250, 0.12);
    color: #7e22ce;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  :global([data-theme="dark"]) .source-manual {
    color: #c084fc;
    background: rgba(167, 139, 250, 0.15);
  }

  .source-synergy {
    background: rgba(16, 185, 129, 0.12);
    color: #047857;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  :global([data-theme="dark"]) .source-synergy {
    color: #34d399;
    background: rgba(16, 185, 129, 0.15);
  }

  .badge-comp-phone {
    font-size: 0.65rem;
    font-weight: 600;
    color: #0284c7;
    background: rgba(2, 132, 199, 0.1);
    border: 1px solid rgba(2, 132, 199, 0.25);
    padding: 0.05rem 0.3rem;
    border-radius: 0.2rem;
    font-family: monospace;
    white-space: nowrap;
  }

  .badge-proc {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .badge-proc-mh {
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .badge-proc-s1 {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .badge-proc-s2 {
    background: rgba(6, 182, 212, 0.12);
    color: #0891b2;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .badge-proc-s3 {
    background: rgba(245, 158, 11, 0.12);
    color: #d97706;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .badge-comp {
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text-muted, #475569);
    background: rgba(0, 0, 0, 0.05);
    padding: 0.08rem 0.3rem;
    border-radius: 0.2rem;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global([data-theme="dark"]) .badge-comp {
    background: rgba(255, 255, 255, 0.07);
    color: #cbd5e1;
  }

  .op-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.55rem;
    border-radius: 2rem;
    white-space: nowrap;
  }

  .op-venta {
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
  }

  :global([data-theme="dark"]) .op-venta {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
  }

  .op-renta {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
  }

  :global([data-theme="dark"]) .op-renta {
    background: rgba(52, 211, 153, 0.12);
    color: #6ee7b7;
  }

  .colonia-text {
    max-width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
  }

  .price-cell {
    font-size: 0.88rem;
    color: var(--color, #0f172a);
    white-space: nowrap;
  }

  .photos-count-badge {
    font-size: 0.72rem;
    background: #f1f5f9;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    color: var(--color, #475569);
    white-space: nowrap;
    border: 1px solid #e2e8f0;
  }

  :global([data-theme="dark"]) .photos-count-badge {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .date-cell {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
  }

  .btn-view-detail {
    padding: 0.3rem 0.75rem;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: var(--color, #1e293b);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  :global([data-theme="dark"]) .btn-view-detail {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
  }

  .btn-view-detail:hover {
    background: #6366f1;
    color: white;
    border-color: #6366f1;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--text-muted, #64748b);
    gap: 0.75rem;
  }

  .empty-table-row {
    text-align: center;
    padding: 2rem;
  }

  .btn-clear-filters {
    padding: 0.4rem 1rem;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #0f172a;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  :global([data-theme="dark"]) .btn-clear-filters {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
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
    color: var(--text-muted, #64748b);
  }

  .page-size-select {
    padding: 0.35rem 0.65rem;
    background: #ffffff;
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 4px;
    color: var(--color, #334155);
    font-size: 0.8rem;
    cursor: pointer;
  }

  :global([data-theme="dark"]) .page-size-select {
    background: #181d33;
    border-color: rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-page {
    padding: 0.35rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: var(--color, #334155);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  :global([data-theme="dark"]) .btn-page {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
  }

  .btn-page:hover:not(:disabled) {
    background: #6366f1;
    color: white;
    border-color: #6366f1;
  }

  .btn-page:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 5rem 0;
    color: var(--text-muted, #64748b);
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ===== MODAL ===== */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1.5rem;
  }

  .modal-card {
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    background: var(--surface-1, #ffffff);
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  :global([data-theme="dark"]) .modal-card {
    background: #131722;
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border, #e2e8f0);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  :global([data-theme="dark"]) .modal-header {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .modal-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #0f172a));
    margin: 0 0 0.25rem 0;
  }

  .modal-location {
    font-size: 0.82rem;
    color: var(--text-muted, #64748b);
    margin: 0;
  }

  .modal-close-btn {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #475569;
    font-size: 1.1rem;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global([data-theme="dark"]) .modal-close-btn {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .gallery-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .modal-image-wrap {
    position: relative;
    width: 100%;
    height: 340px;
    background: #090d16;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-main-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gallery-nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 1.8rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .gallery-nav-btn.prev { left: 1rem; }
  .gallery-nav-btn.next { right: 1rem; }

  .gallery-nav-btn:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: #6366f1;
  }

  .gallery-counter {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 99px;
  }

  .thumbnails-strip {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .thumb-btn {
    width: 56px;
    height: 56px;
    border-radius: 6px;
    overflow: hidden;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0.6;
    transition: all 0.15s;
  }

  .thumb-btn.thumb-active {
    border-color: #6366f1;
    opacity: 1;
  }

  .thumb-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .modal-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.75rem;
  }

  .detail-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  :global([data-theme="dark"]) .detail-box {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .detail-label {
    font-size: 0.68rem;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    font-weight: 600;
  }

  .detail-val {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--color, #0f172a);
  }

  .detail-val.price {
    color: #059669;
    font-size: 1.05rem;
    font-weight: 800;
  }

  :global([data-theme="dark"]) .detail-val.price {
    color: #34d399;
  }

  .modal-amenities h4,
  .modal-desc h4 {
    font-size: 0.88rem;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .amenities-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .amenity-tag {
    font-size: 0.75rem;
    color: var(--color, #334155);
    background: #f1f5f9;
    padding: 0.25rem 0.55rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  :global([data-theme="dark"]) .amenity-tag {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .modal-desc p {
    font-size: 0.85rem;
    color: var(--color, #334155);
    line-height: 1.5;
    margin: 0;
    white-space: pre-line;
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border, #e2e8f0);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  :global([data-theme="dark"]) .modal-footer {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .btn-external {
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #334155;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 600;
  }

  :global([data-theme="dark"]) .btn-external {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
  }

  .btn-primary {
    padding: 0.5rem 1.25rem;
    background: #6366f1;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary:hover {
    background: #4f46e5;
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
