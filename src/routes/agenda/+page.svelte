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
  }
  
  let todos: Todo[] = [];
  let todo: TodoFormState = {}; // Usar el tipo de estado del formulario
  let isLoading = true;
  let error: string | null = null;

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


  // Función para formatear fecha y hora para mostrar (sin cambios, ya era correcta)
    // Función para formatear fecha y hora para mostrar (MODIFICADA para usar timeString)
  // Acepta el objeto Todo completo
  function formatDateTime(todoItem: Todo | undefined | null): string {
      if (!todoItem || todoItem.endTask === undefined || todoItem.endTask === null) return 'Fecha inválida';

      try {
          const timestamp = Number(todoItem.endTask);
          if (isNaN(timestamp)) return 'Fecha inválida';
          const date = new Date(timestamp);
          if (isNaN(date.getTime())) return 'Fecha inválida';

          // *** NUEVA LÓGICA: Usar timeString para decidir el formato ***
          if (todoItem.timeString) {
              // Si SÍ había una hora guardada (incluso '00:00'), mostrar fecha y hora
              return new Intl.DateTimeFormat('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit', // Mostrar hora
                  minute: '2-digit', // Mostrar minutos
                  hour12: true
              }).format(date);
          } else {
              // Si NO había hora guardada (era "todo el día"), mostrar solo la fecha
              return new Intl.DateTimeFormat('es-ES', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                  // No incluir hour, minute
              }).format(date);
          }
          // *** FIN NUEVA LÓGICA ***

      } catch (e) {
          console.error("Error formatting date time:", e);
          return 'Error al formatear';
      }
  }

  // --- Actualiza dónde se llama formatDateTime en el HTML ---
  // Busca esto en la tabla: <td>{formatDateTime(currentTodo.endTask)}</td>
  // Cámbialo a:
  // <td>{formatDateTime(currentTodo)}</td>

   // --- INICIO: Función para agregar/editar todo (CORREGIDA Y COMPLETA) ---
   async function handleAddTodo() {
      // --- Validaciones iniciales ---
      if (!todo.task) {
          alert('Por favor ingresa una tarea');
          return;
      }
      const dateString = todo.endTask; // 'YYYY-MM-DD'
      const timeInputString = todo.timeTask; // 'HH:MM' o '' si está vacío

      if (!dateString) {
          alert('Por favor selecciona una fecha');
          return;
      }

      // --- Cálculo del timestamp ---
      const timeForTimestamp = timeInputString || '00:00';
      const localDateTimeString = `${dateString}T${timeForTimestamp}`;
      const localDate = new Date(localDateTimeString);

      if (isNaN(localDate.getTime())) {
           alert('Fecha u hora inválida.');
           return;
      }
      const endTaskTimestamp = localDate.getTime();

      // --- *** DEFINICIÓN DE todoData (ANTES DEL TRY) *** ---
      const todoData: Partial<Todo> = {
          task: todo.task,
          endTask: endTaskTimestamp, // Timestamp siempre presente
          createdAt: todo.createdAt || Date.now(), // Usar existente si edita, nuevo si añade
          notes: todo.notes || '',
          isCompleted: todo.isCompleted !== undefined ? todo.isCompleted : false,
          type: todo.type || 'normal',
          user: todo.user || 'currentUser' // Asegúrate de tener lógica para el usuario actual si es necesario
      };

      // Añadir timeString SOLO si el usuario lo ingresó
      if (timeInputString) {
          todoData.timeString = timeInputString; // Guardar 'HH:MM'
      } else {
          // Si estamos editando y antes había un timeString, hay que quitarlo.
          // Firestore maneja bien los 'undefined', pero si quieres ser explícito:
          // delete todoData.timeString; // Opcional, depende de cómo manejes las actualizaciones
      }
      // --- *** FIN DEFINICIÓN DE todoData *** ---


      // --- Bloque Try/Catch para guardar/actualizar ---
      try {
          let result;
          let editedTodoId: string | undefined = undefined; // Variable para guardar el ID editado

          if ($systStatus === "editing" && todo.id) {
              editedTodoId = todo.id; // Guarda el ID antes de la operación
              // Ahora todoData SÍ está definido
              result = await firebase.update('todos', todo.id, todoData);
              if (!result.success) throw new Error(result.error as string || 'Error al actualizar');

              // Ocultar iconos después de editar exitosamente
              if (editedTodoId) {
                  const newMap = new Map(activeActions);
                  newMap.delete(editedTodoId);
                  activeActions = newMap;
              }

          } else {
              // Ahora todoData SÍ está definido
              result = await firebase.add('todos', todoData);
               if (!result.success) throw new Error(result.error as string || 'Error al añadir');
          }

          // --- Limpieza y recarga ---
          await loadTodos(); // Recargar lista
          todo = {}; // Limpiar formulario
          $systStatus = ""; // Resetear estado

      } catch (err: any) {
          console.error("Error guardando tarea:", err);
          alert('Error al guardar la tarea: ' + err.message);
      }
  }
  // --- FIN: Función para agregar/editar todo (CORREGIDA Y COMPLETA) ---



  // Función para eliminar todo (sin cambios)
  async function handleDeleteTodo(id: string) {
      if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

      try {
          const result = await firebase.delete('todos', id);
          if (!result.success) throw new Error(result.error as string);
          // Optimistic UI update: remove immediately
          todos = todos.filter(t => t.id !== id);
          // O recargar si prefieres: await loadTodos();
      } catch (err: any) {
          alert('Error al eliminar la tarea: ' + err.message);
          // Opcional: recargar si falla la eliminación para asegurar consistencia
          await loadTodos();
      }
  }

    // Función para actualizar estado completado (MODIFICADA para ocultar iconos post-update)
    async function handleUpdateTodo(todoToUpdate: Todo) {
      const result = await firebase.update('todos', todoToUpdate.id, { isCompleted: todoToUpdate.isCompleted });
      if (result.success) {
          // Actualizar localmente para reflejo inmediato
          const index = todos.findIndex(t => t.id === todoToUpdate.id);
          if (index !== -1) {
              todos[index] = { ...todos[index], isCompleted: todoToUpdate.isCompleted };
              todos = todos; // Trigger reactivity

              // *** NUEVO: Ocultar iconos después de actualizar estado exitosamente ***
              const newMap = new Map(activeActions);
              newMap.delete(todoToUpdate.id); // Elimina la entrada para este ID
              activeActions = newMap; // Actualiza el Map reactivo
              // *** FIN NUEVO ***

          } else {
              await loadTodos(); // Recargar si no se encontró (raro)
          }
      } else {
          alert('Error al actualizar estado: ' + result.error);
          // Opcional: revertir el cambio visual si falla la actualización
          // Si revierte, NO deberías ocultar los iconos aquí.
      }
  }


  // --- INICIO: Función para poblar el formulario al editar (CORREGIDA) ---
    // --- INICIO: Función para poblar el formulario al editar (MODIFICADA para usar timeString) ---
    function editTodo(todoToEdit: Todo) {
      const endTaskString = formatTimestampToLocalDateInputString(todoToEdit.endTask);

      // *** NUEVO: Usar el timeString guardado (si existe) para el input timeTask ***
      const timeTaskString = todoToEdit.timeString || ''; // Usa el guardado, o '' si no existe
      // *** FIN NUEVO ***

      todo = {
          id: todoToEdit.id,
          task: todoToEdit.task,
          endTask: endTaskString,
          timeTask: timeTaskString, // Usar el timeString recuperado
          notes: todoToEdit.notes,
          isCompleted: todoToEdit.isCompleted,
          createdAt: todoToEdit.createdAt,
          type: todoToEdit.type,
          user: todoToEdit.user
      };

      $systStatus = "editing";
      const formElement = document.querySelector('.cont__shcedule');
      formElement?.scrollIntoView({ behavior: 'smooth' });
  }
  // --- FIN: Función para poblar el formulario al editar (MODIFICADA) ---

  // --- FIN: Función para poblar el formulario al editar (CORREGIDA) ---


  // Declaraciones
  // let editStatus = false; // Ya no se usa, se usa $systStatus
  let inActivated = false; // Parece no usarse, considerar eliminar
  // let endTask: number = 0; // Ya no se usa
  // $systStatus = ""; // Se maneja en las funciones

  // Volvemos a usar let para el Map (sin cambios)
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

  // Close/Cancel (sin cambios)
  function cancel() {
      todo = {}; // Limpiar formulario
      $systStatus = ""; // Resetear estado
      // goto("/agenda") // No es necesario si ya estás en la página
  };

</script>

<div class="container schedule">

<div class="mainContainer">
  <div class="header">
    <img src={schedule} alt="schedule" class="imgTitle">
    <h1 class="title">Agenda</h1>
  </div>

  <!-- Formulario -->
  <div class="cont__shcedule">

      <input
          type="text"
          class="inputTask"
          placeholder="Agrega una Tarea o Cita"
          bind:value={todo.task}
      />

    <div class="contDate">
          <div class="time-input">
              <input
                  type="time"
                  class="inputDate"
                  bind:value={todo.timeTask}
                  list="timeList"
              />
              <datalist id="timeList">
                  <!-- Opciones de datalist sin cambios -->
                  <option value="07:00">7:00 AM</option>
                  <option value="07:30">7:30 AM</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="08:30">8:30 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="09:30">9:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="13:30">1:30 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="14:30">2:30 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="15:30">3:30 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="16:30">4:30 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="17:30">5:30 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="18:30">6:30 PM</option>
                  <option value="19:00">7:00 PM</option>
              </datalist>
          </div>
          <input
              type="date"
              class="inputDate"
              bind:value={todo.endTask} 
          />
    </div>

      <textarea
          name="notes"
          bind:value={todo.notes}
          placeholder="descripción"
      ></textarea>

      <div class="buttons">
          <button on:click={handleAddTodo}>
              {#if $systStatus === "editing"}Editar{:else}Guardar{/if}
          </button>
        <button on:click={cancel}>Cancelar</button>
      </div>

  </div>

  <!-- Tabla de Tareas -->
  {#if isLoading}
      <p>Cargando...</p>
  {:else if error}
      <p class="error">Error: {error}</p>
  {:else if todos.length === 0}
      <p>No hay tareas pendientes.</p>
  {:else}
      <div class="table__todosHoy">
        <!-- <h3 class="title">Tareas</h3> Podrías quitar este título si la tabla es la única sección -->
          <table>
              <thead>
                  <tr>
                      <th>Fecha y Hora</th>
                      <th>Tarea</th>
                      <th>Notas</th>
                      <th>Acciones</th> <!-- Columna fija para acciones -->
                  </tr>
              </thead>
              <tbody>
                  {#each sortedTodos as currentTodo (currentTodo.id)}
                      <tr
                          on:click={() => toggleActions(currentTodo.id)}
                          class="todo-row"
                          class:completed={currentTodo.isCompleted}
                      >
                          <!-- Usar formatDateTime con el objeto Todo completo -->
                          <td>{formatDateTime(currentTodo)}</td>
                          <td class="td__task">{currentTodo.task}</td>
                          <td class="td__notes">{currentTodo.notes || '-'}</td>
                          <td class="td__icons">
                              {#if activeActions.get(currentTodo.id)}
                                  <button
                                      class="icon-button"
                                      aria-label="Marcar como completada"
                                      title={currentTodo.isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
                                      on:click|stopPropagation={() => handleUpdateTodo({...currentTodo, isCompleted: !currentTodo.isCompleted})}
                                  >
                                      <i class:fa-square-check={currentTodo.isCompleted} class:fa-square={!currentTodo.isCompleted} class="fa-regular"></i>
                                  </button>

                                  <button
                                      class="icon-button"
                                      aria-label="Editar tarea"
                                      title="Editar tarea"
                                      on:click|stopPropagation={() => editTodo(currentTodo)}
                                  >
                                      <i class="fa-regular fa-pen-to-square"></i>
                                  </button>

                                  <button
                                      class="icon-button"
                                      aria-label="Eliminar tarea"
                                      title="Eliminar tarea"
                                      on:click|stopPropagation={() => handleDeleteTodo(currentTodo.id)}
                                  >
                                      <i class="fa-regular fa-trash-can"></i>
                                  </button>
                              {:else}
                                  <!-- Espacio reservado o icono de 'más acciones' -->
                                  <button class="icon-button placeholder" aria-label="Mostrar acciones">
                                      <i class="fa-solid fa-ellipsis-vertical"></i>
                                  </button>
                              {/if}
                          </td>
                      </tr>
                  {/each}
              </tbody>
          </table>
      </div>
  {/if}
</div>
</div>

<style>
  /* Estilos generales */
  .container.schedule {
      display: flex;
      justify-content: center;
      padding: 1rem;
      font-family: 'Poppins', sans-serif;
  }

  .mainContainer {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 900px; /* Ajustado para mejor legibilidad */
      height: auto;
      align-items: center;
      gap: 2rem; /* Espacio entre secciones */
  }

  .header {
      display: flex;
      width: 100%;
      justify-content: center; /* Centrar título e imagen */
      align-items: center;
      gap: 1rem;
      border-bottom: 2px solid var(--primary-color, #6b21a8); /* Usar variable si existe */
      padding-bottom: 1rem;
      margin-bottom: 1rem;
  }

  .imgTitle { /* Renombrado desde 'img' para evitar conflictos */
      width: 60px; /* Ajustado */
      height: auto;
  }

  .title {
      font-size: 1.8rem; /* Ajustado */
      font-weight: 600;
      color: var(--primary-color, #6b21a8);
      margin: 0;
  }


  .inputTask, input[type="date"], .time-input input[type="time"], textarea {
      width: 100%; /* Ocupar todo el ancho disponible */
      padding: 0.75rem; /* Más padding */
      border-radius: 6px; /* Bordes más suaves */
      border: 1px solid #ccc;
      font-family: 'Poppins', sans-serif;
      font-size: 0.95rem; /* Ligeramente más pequeño */
      box-sizing: border-box; /* Incluir padding en el ancho */
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .inputTask:focus, input[type="date"]:focus, .time-input input[type="time"]:focus, textarea:focus {
      outline: none;
      border-color: var(--primary-color, #6b21a8);
      box-shadow: 0 0 0 2px rgba(107, 33, 168, 0.2);
  }

  .contDate {
      display: flex;
      width: 100%;
      gap: 1rem; /* Espacio entre fecha y hora */
  }

  .time-input {
      position: relative;
      flex: 1; /* Ocupar espacio disponible */
  }

  textarea {
      min-height: 80px; /* Altura mínima */
      resize: vertical; /* Permitir redimensionar verticalmente */
  }

  .buttons {
      display: flex;
      justify-content: flex-end; /* Alinear botones a la derecha */
      gap: 0.5rem; /* Espacio entre botones */
      margin-top: 0.5rem;
  }

  button {
      padding: 0.6rem 1.2rem; /* Padding ajustado */
      border-radius: 6px;
      border: none; /* Quitar borde por defecto */
      cursor: pointer;
      font-family: 'Poppins', sans-serif;
      font-weight: 500;
      font-size: 0.9rem;
      transition: background-color 0.2s ease, opacity 0.2s ease;
  }

  button:first-of-type { /* Botón Guardar/Editar */
      background-color: var(--primary-color, #6b21a8);
      color: white;
  }
  button:first-of-type:hover {
      background-color: var(--primary-dark-color, #581c87); /* Color más oscuro al pasar el ratón */
  }

  button:last-of-type { /* Botón Cancelar */
      background-color: #e0e0e0;
      color: #333;
  }
  button:last-of-type:hover {
      background-color: #bdbdbd;
  }

  button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
  }

  /* Estilos de la tabla */
  .table__todosHoy {
      width: 100%;
      padding: 8px;
      overflow-x: auto; /* Permitir scroll horizontal si es necesario */
  }

  table {
      width: 100%;
      border-collapse: collapse; /* Bordes colapsados */
      margin-top: 1rem;
  }

  th, td {
      padding: 0.8rem 1rem; /* Más padding */
      text-align: left;
      border-bottom: 1px solid #e0e0e0; /* Líneas más sutiles */
      font-size: 0.9rem;
      vertical-align: middle; /* Alinear contenido verticalmente */
  }

  th {
      font-weight: 600;
      background-color: #f5f5f5; /* Fondo ligero para cabecera */
      white-space: nowrap; /* Evitar que el texto de la cabecera se rompa */
  }

  .td__task {
      /* width: 150px; */ /* Quitar ancho fijo, dejar que se ajuste */
      text-transform: capitalize;
      word-break: break-word; /* Permitir que palabras largas se rompan */
  }

  .td__notes {
      /* width: 160px; */ /* Quitar ancho fijo */
      color: #555; /* Color más suave para notas */
      word-break: break-word;
      max-width: 250px; /* Limitar ancho máximo */
      white-space: normal; /* Asegurar que el texto se ajuste */
  }

  .td__icons {
      width: 120px; /* Ancho fijo para iconos */
      text-align: right; /* Alinear iconos a la derecha */
      white-space: nowrap; /* Evitar que los iconos se rompan en líneas */
  }

  .todo-row {
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s ease;
  }

  .todo-row:hover {
      background-color: rgba(107, 33, 168, 0.05); /* Color hover sutil */
  }

  .completed td:not(.td__icons) { /* No tachar los iconos */
      text-decoration: line-through;
      color: #999; /* Color más grisáceo */
  }
  .completed:hover {
      background-color: rgba(0, 0, 0, 0.02);
  }

  .icon-button {
      background: none;
      border: none;
      padding: 0.4rem; /* Ajustar padding */
      cursor: pointer;
      color: #555; /* Color base de iconos */
      display: inline-flex; /* Alinear icono */
      align-items: center;
      justify-content: center;
      margin-left: 0.3rem; /* Espacio entre iconos */
      transition: color 0.2s ease;
  }
  .icon-button i {
      font-size: 1.1rem; /* Tamaño de icono ajustado */
      line-height: 1; /* Asegurar que no afecte altura */
  }
  .icon-button:hover {
      color: var(--primary-color, #6b21a8);
  }
  .icon-button.placeholder {
      color: #ccc;
      cursor: default;
  }
  .icon-button.placeholder:hover {
      color: #ccc;
  }


  .error {
      color: #d32f2f; /* Rojo más estándar */
      background-color: #ffebee;
      padding: 0.8rem;
      border-radius: 4px;
      border: 1px solid #d32f2f;
      margin-top: 1rem;
  }

  /* Responsive */
  @media (max-width: 600px) {
      .header {
          flex-direction: column;
          text-align: center;
      }
      .contDate {
          flex-direction: column;
          gap: 1rem;
      }
      .time-input {
          width: 100%;
      }
      .buttons {
          justify-content: space-between; /* Espaciar botones en móvil */
      }
      th, td {
          padding: 0.6rem 0.5rem; /* Menos padding en móvil */
          font-size: 0.85rem;
      }
      .td__icons {
          width: auto; /* Permitir que se ajuste */
          text-align: left; /* Alinear a la izquierda en móvil */
      }
      .icon-button {
          margin-left: 0;
          margin-right: 0.5rem; /* Espacio a la derecha */
      }
      /* Ocultar notas en pantallas muy pequeñas si es necesario */
      /*
      .td__notes {
          display: none;
      }
      th:nth-child(3) { display: none; }
      */
  }

</style>
