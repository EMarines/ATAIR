<script lang="ts">
  import { onMount } from 'svelte';
  import { firebase } from '$lib/stores/firebaseStores';
  import type { Todo } from '$lib/types';
  import schedule from '$lib/images/schedule.png';
  import { systStatus, todoStore } from '$lib/stores/dataStore'
 
  interface TodoFormState {
      id?: string;
      task?: string;
      endTask?: string; // YYYY-MM-DD string for input binding
      timeTask?: string; // HH:MM string for input binding
      notes?: string;
      isCompleted?: boolean;
      createdAt?: number; // Keep original timestamp if editing
      type?: string;
      user?: string;
      googleTaskId?: string;
  }
  
  let todos: Todo[] = [];
  $: pendingTodosCount = todos.filter(t => !t.isCompleted).length;
  let todo: TodoFormState = {}; // Usar el tipo de estado del formulario
  let showForm = false;
  let isLoading = true;
  let error: string | null = null;

  // Estado para el modal de Reloj con manecillas
  let showClockModal = false;
  let clockMode: 'hours' | 'minutes' = 'hours';
  let clockHour = 10;
  let clockMinute = 0;
  let clockPeriod: 'AM' | 'PM' = 'AM';

  const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const QUICK_TIMES = [
    { label: '08:00 AM', h: 8, m: 0, p: 'AM' as const },
    { label: '10:00 AM', h: 10, m: 0, p: 'AM' as const },
    { label: '12:00 PM', h: 12, m: 0, p: 'PM' as const },
    { label: '02:00 PM', h: 2, m: 0, p: 'PM' as const },
    { label: '04:30 PM', h: 4, m: 30, p: 'PM' as const },
    { label: '06:00 PM', h: 6, m: 0, p: 'PM' as const },
  ];

  $: isHourMode = clockMode === 'hours';
  $: currentVal = isHourMode ? clockHour : clockMinute;
  $: stepDeg = isHourMode ? 30 : 6;
  $: selRad = (currentVal * stepDeg - 90) * (Math.PI / 180);
  $: selX = Math.round(120 + 82 * Math.cos(selRad));
  $: selY = Math.round(120 + 82 * Math.sin(selRad));

  function openClockModal() {
    if (todo.timeTask) {
      const [hStr, mStr] = todo.timeTask.split(':');
      let h = parseInt(hStr, 10);
      if (isNaN(h)) h = 10;
      clockMinute = parseInt(mStr, 10);
      if (isNaN(clockMinute)) clockMinute = 0;

      if (h >= 12) {
        clockPeriod = 'PM';
        clockHour = h === 12 ? 12 : h - 12;
      } else {
        clockPeriod = 'AM';
        clockHour = h === 0 ? 12 : h;
      }
    } else {
      clockHour = 10;
      clockMinute = 0;
      clockPeriod = 'AM';
    }
    clockMode = 'hours';
    showClockModal = true;
  }

  function selectHour(h: number) {
    clockHour = h;
    clockMode = 'minutes';
  }

  function selectMinute(m: number) {
    clockMinute = m;
  }

  function applyQuickTime(item: typeof QUICK_TIMES[0]) {
    clockHour = item.h;
    clockMinute = item.m;
    clockPeriod = item.p;
    confirmClockTime();
  }

  function confirmClockTime() {
    let h24 = clockHour;
    if (clockPeriod === 'PM') {
      if (h24 < 12) h24 += 12;
    } else {
      if (h24 === 12) h24 = 0;
    }
    const hFormatted = String(h24).padStart(2, '0');
    const mFormatted = String(clockMinute).padStart(2, '0');
    todo.timeTask = `${hFormatted}:${mFormatted}`;
    showClockModal = false;
  }

  function clearClockTime() {
    todo.timeTask = '';
    showClockModal = false;
  }

  function formatTimeDisplay(timeStr?: string): string {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }

  function formatDateDisplay(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr || '';
    }
  }

  let dateInputRef: HTMLInputElement | null = null;
  function triggerDatePicker() {
    if (dateInputRef) {
      try {
        (dateInputRef as any).showPicker?.();
      } catch {}
      dateInputRef.focus();
    }
  }

  function handleDateInputClick(e: MouseEvent) {
    try {
      const target = e.currentTarget as any;
      target?.showPicker?.();
    } catch {}
  }

  // Reactive statement para ordenar los todos por fecha (usa el timestamp numérico)
  $: sortedTodos = todos.sort((a, b) => {
      const dateA = Number(a.endTask); // Asegurarse de que es número para ordenar
      const dateB = Number(b.endTask);
      return dateA - dateB;
  });

  // Cargar todos al montar el componente
  onMount(async () => {
      await loadTodos();
  });

  // Función para cargar todos (sin cambios)
  async function loadTodos() {
      isLoading = true;
      error = null;

      try {
          const result = await firebase.get('todos');
          if (result.success) {
              // Asegurarse de que endTask sea un número al cargar
              todos = (result.data as Todo[]).map(t => ({
                  ...t,
                  endTask: Number(t.endTask) // Convertir a número si viene como string/otro
              })).filter(t => !isNaN(t.endTask)); // Filtrar tareas con fecha inválida
          } else {
              error = result.error as string;
          }
      } catch (err) {
          console.error("Error loading todos:", err);
          error = 'Error al cargar las tareas';
      } finally {
          isLoading = false;
      }
  }

  // --- INICIO: Funciones auxiliares para formateo de fecha/hora local ---
  // Función auxiliar para convertir timestamp a YYYY-MM-DD local (para input date)
  function formatTimestampToLocalDateInputString(timestamp: number | undefined | string): string {
      if (timestamp === undefined || timestamp === null || timestamp === '') return '';
      try {
          const date = new Date(Number(timestamp));
          if (isNaN(date.getTime())) return ''; // Validar fecha

          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Mes es 0-indexado
          const day = date.getDate().toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
      } catch (e) {
          console.error("Error formatting timestamp to date string:", e);
          return '';
      }
  }

  // Función auxiliar para convertir timestamp a HH:MM local (para input time)
  function formatTimestampToLocalTimeInputString(timestamp: number | undefined | string): string {
       if (timestamp === undefined || timestamp === null || timestamp === '') return '';
       try {
          const date = new Date(Number(timestamp));
           if (isNaN(date.getTime())) return ''; // Validar fecha

          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
      } catch (e) {
          console.error("Error formatting timestamp to time string:", e);
          return '';
      }
  }
  // --- FIN: Funciones auxiliares para formateo de fecha/hora local ---


  // Función para formatear fecha y hora para mostrar (MODIFICADA para usar timeString)
  function formatDateTime(todoItem: Todo | undefined | null): string {
      if (!todoItem || todoItem.endTask === undefined || todoItem.endTask === null) return 'Fecha inválida';

      try {
          const timestamp = Number(todoItem.endTask);
          if (isNaN(timestamp)) return 'Fecha inválida';
          const date = new Date(timestamp);
          if (isNaN(date.getTime())) return 'Fecha inválida';

          if (todoItem.timeString) {
              return new Intl.DateTimeFormat('es-MX', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
              }).format(date);
          } else {
              return new Intl.DateTimeFormat('es-MX', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
              }).format(date);
          }
      } catch (e) {
          console.error("Error formatting date time:", e);
          return 'Error al formatear';
      }
  }

  // --- Sincronización con Google Tasks ---
  async function syncTaskWithGoogle(action: 'CREATE' | 'UPDATE' | 'DELETE', taskPayload: {
      todoId?: string;
      googleTaskId?: string;
      title?: string;
      notes?: string;
      dueDate?: string;
      status?: string;
      isCompleted?: boolean;
  }) {
      try {
          const res = await fetch('/api/tasks/google-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...taskPayload }),
              keepalive: true
          });
          if (res.ok) {
              return await res.json();
          }
      } catch (e) {
          console.warn('[Agenda Google Tasks Sync] Error de conexión:', e);
      }
      return null;
  }

   // --- INICIO: Función para agregar/editar todo ---
   async function handleAddTodo() {
      if (!todo.task || todo.task.trim() === '') {
          alert('Por favor ingresa un título o descripción para la tarea');
          return;
      }
      const dateString = todo.endTask; // 'YYYY-MM-DD'
      const timeInputString = todo.timeTask; // 'HH:MM' o '' si está vacío

      if (!dateString) {
          alert('Por favor selecciona una fecha');
          return;
      }

      const dateParts = dateString.split('-');
      const year = parseInt(dateParts[0], 10);
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);

      let hours = 0;
      let minutes = 0;
      let finalTimeStringForDb = '';

      if (timeInputString) {
          const timeParts = timeInputString.split(':');
          hours = parseInt(timeParts[0], 10);
          minutes = parseInt(timeParts[1], 10);
          finalTimeStringForDb = timeInputString;
      }

      const localDate = new Date(year, monthIndex, day, hours, minutes, 0, 0);

      if (isNaN(localDate.getTime())) {
          alert('Fecha u hora inválida.');
          return;
      }

      const finalTimestamp = localDate.getTime();

      const todoData: Omit<Todo, 'id'> & { googleTaskId?: string } = {
          task: todo.task.trim(),
          endTask: finalTimestamp,
          notes: todo.notes?.trim() || '',
          isCompleted: todo.isCompleted ?? false,
          createdAt: todo.createdAt || Date.now(),
          type: todo.type || '',
          user: todo.user || '',
          timeString: finalTimeStringForDb,
          ...(todo.googleTaskId ? { googleTaskId: todo.googleTaskId } : {})
      };

      try {
          let result;
          if ($systStatus === "editing") {
              if (!todo.id) throw new Error("Falta el ID del todo a editar");
              const editedTodoId = todo.id;

              result = await firebase.update('todos', editedTodoId, todoData);
              if (!result.success) throw new Error(result.error as string || 'Error al actualizar');

              if (todo.googleTaskId) {
                  syncTaskWithGoogle('UPDATE', {
                      googleTaskId: todo.googleTaskId,
                      title: todoData.task,
                      notes: todoData.notes,
                      dueDate: localDate.toISOString(),
                      isCompleted: todoData.isCompleted,
                      status: todoData.isCompleted ? 'completed' : 'needsAction'
                  });
              }

              if (editedTodoId) {
                  const newMap = new Map(activeActions);
                  newMap.delete(editedTodoId);
                  activeActions = newMap;
              }

          } else {
              const gRes = await syncTaskWithGoogle('CREATE', {
                  title: todoData.task,
                  notes: todoData.notes,
                  dueDate: localDate.toISOString(),
                  isCompleted: false
              });

              if (gRes?.googleTaskId) {
                  (todoData as any).googleTaskId = gRes.googleTaskId;
              }

              result = await firebase.add('todos', todoData);
              if (!result.success) throw new Error(result.error as string || 'Error al añadir');
          }

          await loadTodos();
          todo = {};
          $systStatus = "";
          showForm = false;

      } catch (err: any) {
          console.error("Error guardando tarea:", err);
          alert('Error al guardar la tarea: ' + err.message);
      }
  }

  async function handleDeleteTodo(id: string) {
      if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

      try {
          const todoToDelete = todos.find(t => t.id === id);
          if ((todoToDelete as any)?.googleTaskId) {
              syncTaskWithGoogle('DELETE', {
                  googleTaskId: (todoToDelete as any).googleTaskId
              });
          }

          const result = await firebase.delete('todos', id);
          if (!result.success) throw new Error(result.error as string);
          todos = todos.filter(t => t.id !== id);
      } catch (err: any) {
          alert('Error al eliminar la tarea: ' + err.message);
          await loadTodos();
      }
  }

  async function handleUpdateTodo(todoToUpdate: Todo) {
      const result = await firebase.update('todos', todoToUpdate.id, { isCompleted: todoToUpdate.isCompleted });
      if (result.success) {
          if ((todoToUpdate as any)?.googleTaskId) {
              syncTaskWithGoogle('UPDATE', {
                  googleTaskId: (todoToUpdate as any).googleTaskId,
                  isCompleted: todoToUpdate.isCompleted,
                  status: todoToUpdate.isCompleted ? 'completed' : 'needsAction'
              });
          }

          const index = todos.findIndex(t => t.id === todoToUpdate.id);
          if (index !== -1) {
              todos[index] = { ...todos[index], isCompleted: todoToUpdate.isCompleted };
              todos = todos;

              const newMap = new Map(activeActions);
              newMap.delete(todoToUpdate.id);
              activeActions = newMap;
          } else {
              await loadTodos();
          }
      } else {
          alert('Error al actualizar estado: ' + result.error);
      }
  }

  function editTodo(todoToEdit: Todo) {
      const endTaskString = formatTimestampToLocalDateInputString(todoToEdit.endTask);
      const timeTaskString = todoToEdit.timeString || '';

      todo = {
          id: todoToEdit.id,
          task: todoToEdit.task,
          endTask: endTaskString,
          timeTask: timeTaskString,
          notes: todoToEdit.notes,
          isCompleted: todoToEdit.isCompleted,
          createdAt: todoToEdit.createdAt,
          type: todoToEdit.type,
          user: todoToEdit.user,
          googleTaskId: (todoToEdit as any).googleTaskId || ''
      };

      $systStatus = "editing";
      showForm = true;
      setTimeout(() => {
          const formElement = document.querySelector('.card-form');
          formElement?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
  }

  let activeActions = new Map<string, boolean>();

  function toggleActions(todoId: string) {
      const newMap = new Map(activeActions);
      if (newMap.get(todoId)) {
          newMap.delete(todoId);
      } else {
          newMap.clear();
          newMap.set(todoId, true);
      }
      activeActions = newMap;
  }

  function cancel() {
      todo = {};
      $systStatus = "";
      showForm = false;
  }

  function toggleNewTaskForm() {
      if (showForm) {
          cancel();
      } else {
          todo = {
              endTask: formatTimestampToLocalDateInputString(Date.now()),
              timeTask: '10:00'
          };
          $systStatus = "";
          showForm = true;
      }
  }
</script>

<div class="agenda-page-container">
  <div class="agenda-main-card">
    
    <!-- ENCABEZADO CON BOTÓN + TAREA -->
    <div class="agenda-header-row">
      <div class="header-left">
        <div class="header-badge-tag">
          <i class="fa-solid fa-calendar-days"></i>
          <span>Gestión de Citas y Pendientes</span>
        </div>
        <div class="title-with-count">
          <h1 class="main-title">Agenda</h1>
          <span class="todos-count-pill">{pendingTodosCount} {pendingTodosCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}</span>
        </div>
        <p class="main-subtitle">Organiza tus citas de captación, visitas a propiedades y recordatorios de seguimiento.</p>
      </div>

      <button 
        class="btn-toggle-task"
        class:active={showForm}
        on:click={toggleNewTaskForm}
        aria-label="Agregar nueva tarea"
      >
        {#if showForm}
          <i class="fa-solid fa-xmark"></i>
          <span>Cerrar Formulario</span>
        {:else}
          <i class="fa-solid fa-plus"></i>
          <span>Tarea</span>
        {/if}
      </button>
    </div>

    <!-- FORMULARIO REDISEÑADO CON GLASS CARD -->
    {#if showForm || $systStatus === "editing"}
      <section class="card-form glass" aria-label="Formulario de Tarea">
        <div class="form-header">
          <div class="form-title-group">
            <div class="form-icon-wrap">
              <i class={$systStatus === "editing" ? "fa-solid fa-pen-to-square" : "fa-solid fa-calendar-plus"}></i>
            </div>
            <div>
              <h3>{$systStatus === "editing" ? "Editar Tarea o Cita" : "Nueva Tarea o Cita"}</h3>
              <p class="form-hint">Ingresa los datos para agendar tu actividad y sincronizarla con tu equipo</p>
            </div>
          </div>
          <button class="btn-close-form" on:click={cancel} title="Cerrar formulario">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form on:submit|preventDefault={handleAddTodo} class="form-body">
          <div class="form-grid">
            <!-- Título de la Tarea -->
            <div class="form-group full-width">
              <label for="taskTitle">
                <i class="fa-solid fa-tag"></i>
                <span>Actividad o Cita *</span>
              </label>
              <input
                id="taskTitle"
                type="text"
                class="form-input"
                placeholder="Ej. Visita a Casa en Cumbres con Cliente, Firma de Notaría..."
                bind:value={todo.task}
                required
                autofocus
              />
            </div>

            <!-- Fecha (Click completo para desplegar calendario con estilo iluminado) -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div class="form-group full-click-group" on:click={triggerDatePicker} on:keydown={(e) => e.key === 'Enter' && triggerDatePicker()} role="group">
              <label for="taskDate">
                <i class="fa-regular fa-calendar"></i>
                <span>Fecha *</span>
              </label>
              <div class="picker-input-container time-picker-trigger date-picker-trigger" id="taskDateContainer">
                <div class="time-preview-text" class:has-val={!!todo.endTask}>
                  {#if todo.endTask}
                    <span class="time-chip-selected date-chip-selected">
                      <i class="fa-solid fa-calendar-day"></i>
                      {formatDateDisplay(todo.endTask)}
                    </span>
                  {:else}
                    <span class="time-placeholder-text">Toca para seleccionar fecha...</span>
                  {/if}
                </div>
                <div class="picker-addon-icon calendar-btn">
                  <i class="fa-solid fa-calendar-days"></i>
                </div>
                <input
                  id="taskDate"
                  type="date"
                  class="native-date-hidden-overlay"
                  bind:this={dateInputRef}
                  bind:value={todo.endTask}
                  on:click|stopPropagation={handleDateInputClick}
                  required
                />
              </div>
            </div>

            <!-- Hora con Reloj Analógico de Manecillas -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div class="form-group full-click-group" on:click={openClockModal} on:keydown={(e) => e.key === 'Enter' && openClockModal()} role="group">
              <label for="taskTimeDisplay">
                <i class="fa-regular fa-clock"></i>
                <span>Hora de la Cita (Reloj)</span>
              </label>
              <div class="picker-input-container time-picker-trigger" id="taskTimeDisplay">
                <div class="time-preview-text" class:has-val={!!todo.timeTask}>
                  {#if todo.timeTask}
                    <span class="time-chip-selected">
                      <i class="fa-solid fa-clock"></i>
                      {formatTimeDisplay(todo.timeTask)}
                    </span>
                  {:else}
                    <span class="time-placeholder-text">Toca para abrir reloj de manecillas...</span>
                  {/if}
                </div>
                <button type="button" class="picker-addon-icon clock-btn" on:click|stopPropagation={openClockModal} aria-label="Abrir reloj de manecillas">
                  <i class="fa-solid fa-clock-rotate-left"></i>
                </button>
              </div>
            </div>

            <!-- Notas -->
            <div class="form-group full-width">
              <label for="taskNotes">
                <i class="fa-regular fa-comment-dots"></i>
                <span>Notas o Detalles adicionales</span>
              </label>
              <textarea
                id="taskNotes"
                class="form-input form-textarea"
                bind:value={todo.notes}
                placeholder="Añade teléfonos de contacto, claves de propiedad, instrucciones de acceso o acuerdos..."
                rows="3"
              ></textarea>
            </div>
          </div>

          <div class="form-actions-row">
            <button type="button" class="btn-secondary-form" on:click={cancel}>
              <i class="fa-solid fa-xmark"></i> Cancelar
            </button>
            <button type="submit" class="btn-primary-form">
              {#if $systStatus === "editing"}
                <i class="fa-solid fa-check"></i> Actualizar Tarea
              {:else}
                <i class="fa-solid fa-floppy-disk"></i> Guardar Tarea
              {/if}
            </button>
          </div>
        </form>
      </section>
    {/if}

    <!-- MODAL RELOJ INTERACTIVO ESTILO MANECILLAS -->
    {#if showClockModal}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div 
        class="clock-modal-backdrop"
        on:click|self={() => showClockModal = false}
        on:keydown={(e) => e.key === 'Escape' && (showClockModal = false)}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="clock-modal-card glass">
          <div class="clock-modal-header">
            <div class="clock-title-group">
              <i class="fa-solid fa-clock"></i>
              <h4>Selector de Hora</h4>
            </div>
            <button class="btn-close-clock" on:click={() => showClockModal = false} aria-label="Cerrar reloj">✕</button>
          </div>

          <!-- Display Digital Grande con Switch AM/PM -->
          <div class="clock-digital-display">
            <div class="time-digits-group">
              <button 
                type="button"
                class="digit-btn" 
                class:active-mode={clockMode === 'hours'}
                on:click={() => clockMode = 'hours'}
                title="Cambiar hora"
              >
                {String(clockHour).padStart(2, '0')}
              </button>
              <span class="colon">:</span>
              <button 
                type="button"
                class="digit-btn" 
                class:active-mode={clockMode === 'minutes'}
                on:click={() => clockMode = 'minutes'}
                title="Cambiar minutos"
              >
                {String(clockMinute).padStart(2, '0')}
              </button>
            </div>

            <div class="period-toggle-group">
              <button 
                type="button"
                class="period-btn" 
                class:selected-period={clockPeriod === 'AM'}
                on:click={() => clockPeriod = 'AM'}
              >
                AM
              </button>
              <button 
                type="button"
                class="period-btn" 
                class:selected-period={clockPeriod === 'PM'}
                on:click={() => clockPeriod = 'PM'}
              >
                PM
              </button>
            </div>
          </div>

          <div class="clock-mode-indicator">
            <span class="mode-badge">
              {clockMode === 'hours' ? '🕒 Selecciona la Hora en la esfera' : '⏱️ Selecciona los Minutos'}
            </span>
          </div>

          <!-- ESFERA ANALÓGICA CON MANECILLAS (SVG EXACTO) -->
          <div class="clock-face-wrapper">
            <svg viewBox="0 0 240 240" class="clock-svg-dial">
              <!-- Fondo de la esfera -->
              <circle cx="120" cy="120" r="114" class="svg-dial-bg" />

              <!-- Manecilla trazada exactamente desde el centro al objetivo -->
              <line x1="120" y1="120" x2={selX} y2={selY} class="svg-hand-line" />

              <!-- Círculo resaltador del número seleccionado (perfectamente concéntrico) -->
              <circle cx={selX} cy={selY} r="17" class="svg-selected-circle" />

              <!-- Centro del reloj -->
              <circle cx="120" cy="120" r="5" class="svg-center-dot" />

              <!-- Números del reloj distribuidos matemáticamente -->
              {#if isHourMode}
                {#each HOURS as h}
                  {@const hRad = (h * 30 - 90) * (Math.PI / 180)}
                  {@const hX = Math.round(120 + 82 * Math.cos(hRad))}
                  {@const hY = Math.round(120 + 82 * Math.sin(hRad))}
                  {@const isSelected = clockHour === h}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <g class="svg-num-group" on:click={() => selectHour(h)} role="button" tabindex="0">
                    <circle cx={hX} cy={hY} r="18" class="svg-num-hitbox" />
                    <text x={hX} y={hY + 5} text-anchor="middle" class="svg-num-text" class:active-text={isSelected}>
                      {h}
                    </text>
                  </g>
                {/each}
              {:else}
                {#each MINUTES as m}
                  {@const mRad = (m * 6 - 90) * (Math.PI / 180)}
                  {@const mX = Math.round(120 + 82 * Math.cos(mRad))}
                  {@const mY = Math.round(120 + 82 * Math.sin(mRad))}
                  {@const isSelected = clockMinute === m}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <g class="svg-num-group" on:click={() => selectMinute(m)} role="button" tabindex="0">
                    <circle cx={mX} cy={mY} r="18" class="svg-num-hitbox" />
                    <text x={mX} y={mY + 5} text-anchor="middle" class="svg-num-text" class:active-text={isSelected}>
                      {String(m).padStart(2, '0')}
                    </text>
                  </g>
                {/each}
              {/if}
            </svg>
          </div>

          <!-- Horarios frecuentes -->
          <div class="quick-times-container">
            <span class="quick-title">Horas Rápidas:</span>
            <div class="quick-chips-grid">
              {#each QUICK_TIMES as qt}
                <button type="button" class="chip-time" on:click={() => applyQuickTime(qt)}>
                  {qt.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Botones de confirmación del reloj -->
          <div class="clock-modal-actions">
            <button type="button" class="btn-clear-time" on:click={clearClockTime}>
              Quitar Hora
            </button>
            <div class="actions-right">
              <button type="button" class="btn-cancel-clock" on:click={() => showClockModal = false}>
                Cancelar
              </button>
              <button type="button" class="btn-confirm-clock" on:click={confirmClockTime}>
                <i class="fa-solid fa-check"></i> Establecer Hora
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- TABLA DE TAREAS Y CITAS -->
    <div class="agenda-table-section">
      {#if isLoading}
        <div class="loading-state glass">
          <div class="spinner-agenda"></div>
          <p>Cargando agenda de tareas...</p>
        </div>
      {:else if error}
        <div class="error-banner">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>{error}</span>
        </div>
      {:else if todos.length === 0}
        <div class="empty-state glass">
          <i class="fa-regular fa-calendar-check empty-icon"></i>
          <h3>No hay tareas en tu agenda</h3>
          <p>Pulsa en <strong>+ Tarea</strong> arriba para programar tu primera cita o pendiente.</p>
          <button class="btn-empty-add" on:click={toggleNewTaskForm}>
            <i class="fa-solid fa-plus"></i> Crear una Tarea Ahora
          </button>
        </div>
      {:else}
        <div class="table-card glass">
          <div class="table-responsive">
            <table class="agenda-table">
              <thead>
                <tr>
                  <th class="th-status">Estado</th>
                  <th class="th-datetime">Fecha y Hora</th>
                  <th class="th-task">Actividad / Tarea</th>
                  <th class="th-notes">Notas</th>
                  <th class="th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {#each sortedTodos as currentTodo (currentTodo.id)}
                  <tr
                    class="todo-tr"
                    class:is-completed={currentTodo.isCompleted}
                    on:click={() => toggleActions(currentTodo.id)}
                  >
                    <!-- Checkbox de estado -->
                    <td class="td-status" on:click|stopPropagation={() => handleUpdateTodo({...currentTodo, isCompleted: !currentTodo.isCompleted})}>
                      <button 
                        class="btn-check-toggle" 
                        class:checked={currentTodo.isCompleted}
                        title={currentTodo.isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
                      >
                        <i class={currentTodo.isCompleted ? "fa-solid fa-circle-check" : "fa-regular fa-circle"}></i>
                      </button>
                    </td>

                    <!-- Fecha y Hora -->
                    <td class="td-datetime">
                      <div class="datetime-pill">
                        <i class="fa-regular fa-clock"></i>
                        <span>{formatDateTime(currentTodo)}</span>
                      </div>
                    </td>

                    <!-- Tarea -->
                    <td class="td-task">
                      <div class="task-title-text" class:completed-text={currentTodo.isCompleted}>
                        {currentTodo.task}
                      </div>
                    </td>

                    <!-- Notas -->
                    <td class="td-notes">
                      {#if currentTodo.notes}
                        <span class="notes-badge" title={currentTodo.notes}>
                          {currentTodo.notes}
                        </span>
                      {:else}
                        <span class="text-muted-empty">—</span>
                      {/if}
                    </td>

                    <!-- Acciones -->
                    <td class="td-actions" on:click|stopPropagation>
                      <div class="actions-group">
                        <button
                          class="action-btn edit-btn"
                          title="Editar tarea"
                          on:click={() => editTodo(currentTodo)}
                        >
                          <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button
                          class="action-btn delete-btn"
                          title="Eliminar tarea"
                          on:click={() => handleDeleteTodo(currentTodo.id)}
                        >
                          <i class="fa-regular fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>

  </div>
</div>

<style>
  /* ===== CONTENEDOR GENERAL ===== */
  .agenda-page-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 4rem;
    font-family: 'Poppins', sans-serif;
    color: var(--color, #18181b);
  }

  .agenda-main-card {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }

  /* ===== ENCABEZADO Y BOTÓN + TAREA ===== */
  .agenda-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .header-badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.28);
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--brand, #4f46e5);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    width: fit-content;
  }

  :global([data-theme="dark"]) .header-badge-tag {
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.18);
    border-color: rgba(99, 102, 241, 0.35);
  }

  .title-with-count {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .main-title {
    font-size: 1.85rem;
    font-weight: 800;
    margin: 0;
    color: var(--title-heading, var(--color, #18181b));
    letter-spacing: -0.02em;
  }

  .todos-count-pill {
    background: rgba(99, 102, 241, 0.1);
    color: var(--brand, #4f46e5);
    border: 1px solid rgba(99, 102, 241, 0.25);
    padding: 0.2rem 0.65rem;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  :global([data-theme="dark"]) .todos-count-pill {
    color: #c7d2fe;
    background: rgba(99, 102, 241, 0.2);
  }

  .main-subtitle {
    color: var(--text-muted, #64748b);
    font-size: 0.88rem;
    margin: 0;
    max-width: 600px;
  }

  /* BOTÓN + TAREA */
  .btn-toggle-task {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.35rem;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-family: 'Poppins', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .btn-toggle-task:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  }

  .btn-toggle-task.active {
    background: #64748b;
    box-shadow: 0 4px 12px rgba(100, 116, 139, 0.25);
  }

  .btn-toggle-task.active:hover {
    background: #475569;
  }

  /* ===== GLASS CARDS ===== */
  .glass {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border, #e4e4e7);
    border-radius: var(--radius-xl, 16px);
    box-shadow: var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.05));
    transition: all 0.2s ease;
  }

  :global([data-theme="dark"]) .glass {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  }

  /* ===== FORMULARIO REDISEÑADO ===== */
  .card-form {
    padding: 1.5rem 1.75rem;
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
    animation: fadeInSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 1.1rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border, #e2e8f0);
  }

  :global([data-theme="dark"]) .form-header {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .form-title-group {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .form-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(99, 102, 241, 0.12);
    color: var(--brand, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
  }

  .form-title-group h3 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0 0 0.15rem;
    color: var(--title-heading, var(--color, #18181b));
  }

  .form-hint {
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
    margin: 0;
  }

  .btn-close-form {
    background: transparent;
    border: none;
    font-size: 1.1rem;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .btn-close-form:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.15rem;
    margin-bottom: 1.35rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .form-group.full-width {
    grid-column: span 2;
  }

  .form-group label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color, #334155);
  }

  :global([data-theme="dark"]) .form-group label {
    color: #cbd5e1;
  }

  .form-group label i {
    color: var(--brand, #6366f1);
    font-size: 0.85rem;
  }

  .form-input {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    border: 1px solid var(--border, #cbd5e1);
    background: var(--surface-input, #ffffff);
    color: var(--color, #18181b);
    font-family: 'Poppins', sans-serif;
    font-size: 0.88rem;
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  :global([data-theme="dark"]) .form-input {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--brand, #6366f1);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .form-textarea {
    min-height: 85px;
    resize: vertical;
    line-height: 1.45;
  }

  .time-input-wrap {
    width: 100%;
  }

  .form-actions-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border, #f1f5f9);
  }

  :global([data-theme="dark"]) .form-actions-row {
    border-top-color: rgba(255, 255, 255, 0.06);
  }

  .btn-secondary-form {
    padding: 0.6rem 1.15rem;
    border-radius: 8px;
    border: 1px solid var(--border, #cbd5e1);
    background: transparent;
    color: var(--text-muted, #64748b);
    font-family: 'Poppins', sans-serif;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.15s ease;
  }

  .btn-secondary-form:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color, #0f172a);
  }

  :global([data-theme="dark"]) .btn-secondary-form:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f8fafc;
  }

  .btn-primary-form {
    padding: 0.6rem 1.4rem;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #ffffff;
    font-family: 'Poppins', sans-serif;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
    transition: all 0.2s ease;
  }

  .btn-primary-form:hover {
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35);
    transform: translateY(-1px);
  }

  /* ===== TABLA DE TAREAS ===== */
  .table-card {
    padding: 0.5rem;
    overflow: hidden;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .agenda-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.88rem;
  }

  .agenda-table thead {
    background: rgba(0, 0, 0, 0.02);
    border-bottom: 1px solid var(--border, #e2e8f0);
  }

  :global([data-theme="dark"]) .agenda-table thead {
    background: rgba(255, 255, 255, 0.02);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .agenda-table th {
    padding: 0.85rem 1rem;
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #64748b);
    white-space: nowrap;
  }

  .agenda-table td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border, #f1f5f9);
    vertical-align: middle;
  }

  :global([data-theme="dark"]) .agenda-table td {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }

  .todo-tr {
    transition: background-color 0.15s ease;
    cursor: pointer;
  }

  .todo-tr:hover {
    background-color: rgba(99, 102, 241, 0.04);
  }

  :global([data-theme="dark"]) .todo-tr:hover {
    background-color: rgba(255, 255, 255, 0.03);
  }

  .todo-tr.is-completed {
    opacity: 0.65;
  }

  .th-status, .td-status {
    width: 50px;
    text-align: center;
  }

  .btn-check-toggle {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-check-toggle:hover {
    color: var(--brand, #6366f1);
    transform: scale(1.1);
  }

  .btn-check-toggle.checked {
    color: #10b981;
  }

  .datetime-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted, #475569);
    background: rgba(0, 0, 0, 0.04);
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    white-space: nowrap;
  }

  :global([data-theme="dark"]) .datetime-pill {
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
  }

  .datetime-pill i {
    color: var(--brand, #6366f1);
  }

  .task-title-text {
    font-weight: 600;
    color: var(--color, #0f172a);
    line-height: 1.4;
  }

  .task-title-text.completed-text {
    text-decoration: line-through;
    color: var(--text-muted, #94a3b8);
  }

  .notes-badge {
    display: inline-block;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
    background: rgba(0, 0, 0, 0.03);
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
  }

  :global([data-theme="dark"]) .notes-badge {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
  }

  .text-muted-empty {
    color: var(--text-muted, #94a3b8);
  }

  .th-actions, .td-actions {
    width: 100px;
    text-align: right;
  }

  .actions-group {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .action-btn {
    background: transparent;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--text-muted, #64748b);
    transition: all 0.15s ease;
  }

  .action-btn.edit-btn:hover {
    color: var(--brand, #6366f1);
    background: rgba(99, 102, 241, 0.1);
  }

  .action-btn.delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  /* ===== ESTADOS DE CARGA Y VACÍO ===== */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--text-muted, #64748b);
  }

  .spinner-agenda {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: var(--brand, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3.5rem 1.5rem;
    gap: 0.75rem;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--brand, #6366f1);
    opacity: 0.5;
    margin-bottom: 0.5rem;
  }

  .empty-state h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-muted, #64748b);
    max-width: 400px;
  }

  .btn-empty-add {
    margin-top: 0.75rem;
    padding: 0.6rem 1.25rem;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: 10px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.88rem;
  }

  :global([data-theme="dark"]) .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
  }

  /* ===== CUSTOM PICKERS (CLICK EN TODO EL INPUT) ===== */
  .full-click-group {
    cursor: pointer;
  }

  .picker-input-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    cursor: pointer;
  }

  .date-picker-trigger {
    position: relative;
    cursor: pointer;
  }

  .native-date-hidden-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
    color-scheme: light;
  }

  :global([data-theme="dark"]) .native-date-hidden-overlay {
    color-scheme: dark !important;
  }

  .native-date-hidden-overlay::-webkit-calendar-picker-indicator {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .picker-addon-icon {
    position: absolute;
    right: 0.85rem;
    color: var(--brand, #6366f1);
    font-size: 1.1rem;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .picker-addon-icon.clock-btn {
    pointer-events: auto;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.2rem;
    transition: transform 0.15s ease;
  }

  .picker-addon-icon.clock-btn:hover {
    transform: scale(1.15);
  }

  .time-picker-trigger {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    border: 1px solid var(--border, #cbd5e1);
    background: var(--surface-input, #ffffff);
    color: var(--color, #18181b);
    font-family: 'Poppins', sans-serif;
    font-size: 0.88rem;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 42px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  :global([data-theme="dark"]) .time-picker-trigger {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
  }

  .time-picker-trigger:hover, .time-picker-trigger:focus-within {
    border-color: var(--brand, #6366f1);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .time-preview-text {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .time-placeholder-text {
    color: var(--text-muted, #94a3b8);
    font-size: 0.85rem;
  }

  .time-chip-selected {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(99, 102, 241, 0.12);
    color: var(--brand, #4f46e5);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.85rem;
  }

  :global([data-theme="dark"]) .time-chip-selected {
    background: rgba(99, 102, 241, 0.25);
    color: #c7d2fe;
  }

  /* ===== MODAL DE RELOJ ANALÓGICO CON MANECILLAS ===== */
  .clock-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
    animation: fadeInModal 0.2s ease-out;
  }

  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .clock-modal-card {
    width: 100%;
    max-width: 360px;
    padding: 1.5rem;
    border-radius: 20px;
    background: var(--surface-card, #ffffff);
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    animation: scaleInClock 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes scaleInClock {
    from { transform: scale(0.92); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .clock-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border, #f1f5f9);
    padding-bottom: 0.75rem;
  }

  :global([data-theme="dark"]) .clock-modal-header {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .clock-title-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--brand, #6366f1);
  }

  .clock-title-group h4 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--title-heading, var(--color, #18181b));
  }

  .btn-close-clock {
    background: transparent;
    border: none;
    font-size: 1.1rem;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    padding: 0.2rem;
  }

  .btn-close-clock:hover {
    color: #ef4444;
  }

  /* DISPLAY DIGITAL & AM/PM */
  .clock-digital-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(99, 102, 241, 0.08);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  :global([data-theme="dark"]) .clock-digital-display {
    background: rgba(99, 102, 241, 0.15);
  }

  .time-digits-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .digit-btn {
    background: transparent;
    border: 2px solid transparent;
    border-radius: 8px;
    font-size: 1.9rem;
    font-weight: 800;
    font-family: 'Poppins', sans-serif;
    color: var(--color, #1e293b);
    padding: 0.1rem 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global([data-theme="dark"]) .digit-btn {
    color: #f8fafc;
  }

  .digit-btn.active-mode {
    background: #6366f1;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  }

  .colon {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--brand, #6366f1);
  }

  .period-toggle-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: rgba(0, 0, 0, 0.05);
    padding: 0.2rem;
    border-radius: 8px;
  }

  :global([data-theme="dark"]) .period-toggle-group {
    background: rgba(255, 255, 255, 0.05);
  }

  .period-btn {
    background: transparent;
    border: none;
    font-family: 'Poppins', sans-serif;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-muted, #64748b);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .period-btn.selected-period {
    background: #6366f1;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  }

  .clock-mode-indicator {
    text-align: center;
  }

  .mode-badge {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--brand, #4f46e5);
    background: rgba(99, 102, 241, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 99px;
    display: inline-block;
  }

  :global([data-theme="dark"]) .mode-badge {
    color: #c7d2fe;
    background: rgba(99, 102, 241, 0.2);
  }

  /* ESFERA DEL RELOJ (CLOCK SVG DIAL) */
  .clock-face-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5rem 0;
  }

  .clock-svg-dial {
    width: 248px;
    height: 248px;
    user-select: none;
    overflow: visible;
  }

  .svg-dial-bg {
    fill: var(--surface-card, #f8fafc);
    stroke: var(--border, #e2e8f0);
    stroke-width: 2px;
  }

  :global([data-theme="dark"]) .svg-dial-bg {
    fill: #141419;
    stroke: rgba(255, 255, 255, 0.12);
  }

  .svg-hand-line {
    stroke: #6366f1;
    stroke-width: 2.5px;
    stroke-linecap: round;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .svg-selected-circle {
    fill: #6366f1;
    filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.6));
    transition: cx 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), cy 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .svg-center-dot {
    fill: #6366f1;
    stroke: #ffffff;
    stroke-width: 2px;
  }

  :global([data-theme="dark"]) .svg-center-dot {
    stroke: #18181b;
  }

  .svg-num-group {
    cursor: pointer;
  }

  .svg-num-hitbox {
    fill: transparent;
    cursor: pointer;
  }

  .svg-num-hitbox:hover {
    fill: rgba(99, 102, 241, 0.15);
  }

  .svg-num-text {
    font-family: 'Poppins', sans-serif;
    font-size: 0.88rem;
    font-weight: 600;
    fill: var(--color, #334155);
    pointer-events: none;
    transition: fill 0.15s ease;
  }

  :global([data-theme="dark"]) .svg-num-text {
    fill: #cbd5e1;
  }

  .svg-num-text.active-text {
    fill: #ffffff !important;
    font-weight: 800;
  }

  /* CHIPS DE TIEMPOS RÁPIDOS */
  .quick-times-container {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .quick-title {
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted, #64748b);
  }

  .quick-chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .chip-time {
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--border, #e2e8f0);
    color: var(--text-muted, #475569);
    font-family: 'Poppins', sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global([data-theme="dark"]) .chip-time {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
  }

  .chip-time:hover {
    background: #6366f1;
    border-color: #6366f1;
    color: #ffffff;
  }

  /* BOTONES MODAL RELOJ */
  .clock-modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border, #f1f5f9);
    padding-top: 0.75rem;
  }

  :global([data-theme="dark"]) .clock-modal-actions {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .btn-clear-time {
    background: transparent;
    border: none;
    color: #ef4444;
    font-family: 'Poppins', sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
  }

  .btn-clear-time:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .actions-right {
    display: flex;
    gap: 0.5rem;
  }

  .btn-cancel-clock {
    background: transparent;
    border: 1px solid var(--border, #cbd5e1);
    color: var(--text-muted, #64748b);
    font-family: 'Poppins', sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .btn-confirm-clock {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: none;
    color: #ffffff;
    font-family: 'Poppins', sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.45rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
  }

  .btn-confirm-clock:hover {
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 768px) {
    .agenda-page-container {
      padding: 1rem 0.75rem 3rem;
    }

    .agenda-header-row {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .btn-toggle-task {
      justify-content: center;
      width: 100%;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .form-group.full-width {
      grid-column: span 1;
    }

    .card-form {
      padding: 1.25rem 1rem;
    }

    .agenda-table th, .agenda-table td {
      padding: 0.75rem 0.6rem;
    }

    .notes-badge {
      max-width: 140px;
    }
  }
</style>
