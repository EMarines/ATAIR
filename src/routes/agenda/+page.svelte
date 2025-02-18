<script lang="ts">
    import { onMount } from 'svelte';
    import { firebase } from '$lib/stores/firebaseStores';
    import type { Todo } from '$lib/types';
    import schedule from '$lib/images/schedule.png';
    import { systStatus, todoStore } from '$lib/stores/dataStore'
    import { goto } from '$app/navigation';
    import { formatDate } from '$lib/functions/dateFunctions.js'
    // import AddToSchedule from '$lib/components/AddToSchedule.svelte';
    // import { sortTodos } from '$lib/functions/sort.js'
    // import { onDestroy } from 'svelte';
    // import type { WhereFilterOp } from 'firebase/firestore';

    let todos: Todo[] = [];
    let todo: Partial<Todo> = {};
    let isLoading = true;
    let error: string | null = null;

    // Reactive statement para ordenar los todos por fecha
    $: sortedTodos = todos.sort((a, b) => {
        const dateA = Number(a.endTask);
        const dateB = Number(b.endTask);
        return dateA - dateB;
    });

    // Cargar todos al montar el componente
    onMount(async () => {
        await loadTodos();
    });

    // Función para cargar todos
    async function loadTodos() {
        isLoading = true;
        error = null;
        
        try {
            const result = await firebase.get('todos');
            if (result.success) {
                todos = result.data as Todo[];
            } else {
                error = result.error as string;
            }
        } catch (err) {
            error = 'Error al cargar las tareas';
        } finally {
            isLoading = false;
        }
    }

    // Función para formatear fecha para input date
    function formatDateForInput(timestamp: number) {
        const date = new Date(timestamp);
        // Ajustar a la zona horaria local
        const tzOffset = date.getTimezoneOffset() * 60000; // offset en milisegundos
        const localDate = new Date(date.getTime() - tzOffset);
        return localDate.toISOString().split('T')[0];
    }

    // Función para formatear fecha y hora para mostrar
    function formatDateTime(timestamp: number) {
        const date = new Date(timestamp);
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    }

    // Función para agregar todo
    async function handleAddTodo() {
        if (!todo.task) {
            alert('Por favor ingresa una tarea');
            return;
        }

        const newTodo = {
            task: todo.task,
            endTask: todo.endTask ? new Date(todo.endTask).getTime() : Date.now(),
            timeTask: todo.timeTask,
            createdAt: Date.now(),
            notes: todo.notes || '',
            isCompleted: false,
            type: 'normal',
            user: 'currentUser'
        };

        try {
            if ($systStatus === "editing" && todo.id) {
                const result = await firebase.update('todos', todo.id, newTodo);
                if (!result.success) throw new Error(result.error as string);
            } else {
                const result = await firebase.add('todos', newTodo);
                if (!result.success) throw new Error(result.error as string);
            }

            // Recargar todos después de una operación exitosa
            await loadTodos();
            
            // Limpiar el formulario
            todo = {};
            $systStatus = "";
        } catch (err: any) {
            alert('Error al guardar la tarea: ' + err.message);
        }
    }

    // Función para actualizar todo
    async function handleUpdateTodo(todoToUpdate: Todo) {
        const result = await firebase.update('todos', todoToUpdate.id, todoToUpdate);
        if (result.success) await loadTodos();
    }

    // Función para eliminar todo
    async function handleDeleteTodo(id: string) {
        if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
        
        try {
            const result = await firebase.delete('todos', id);
            if (!result.success) throw new Error(result.error as string);
            await loadTodos();
        } catch (err: any) {
            alert('Error al eliminar la tarea: ' + err.message);
        }
    }

    
      // Declaraciones
    // let editStatus = false;
          let inActivated = false;
    // let endTask: number = 0;
          $systStatus = "";
    // $: todoToRender = $todoStore

    // Agrega un Map para manejar el estado de mostActions por cada todo
    let activeActions = new Map<string, boolean>();
      
      // CRUD
          // Edita la tarea
    function editTodo(item: Todo) {
        const timestamp = typeof item.endTask === 'string' ? parseInt(item.endTask) : item.endTask;
        todo = {
            ...item,
            endTask: formatDateForInput(timestamp)
        };
        $systStatus = "editing";
    }
    
      // Close
         function close() {
          //  $todo=[]; 
           inActivated = false;
            // goto("/contactos")
          };
    
      // Mostrar Schedule
          function addSchedule(){
              inActivated = true;
            };
    
    // Modifica la función toggleActions
    function toggleActions(todoId: string) {
        // Crear un nuevo Map limpio
        const newMap = new Map<string, boolean>();
        
        // Si el todo actual no estaba activo, activarlo
        if (!activeActions.get(todoId)) {
            newMap.set(todoId, true);
        }
        
        // Actualizar el estado
        activeActions = newMap;
    }
    
        // Close
            function cancel() {
        todo={}; 
              goto("/agenda")
            };
    
</script>
              
    <div class="container schedule">  
    
      <div class="mainContainer">
        <div class="header">
          <img src={schedule} alt="schedule" class="imgTitle">
          <h1 class="title">Agenda</h1>
        </div>
    
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
                <input type="date" class="inputDate" bind:value={todo.endTask} /> 
          </div> 
    
            <textarea 
                name="notes" 
                bind:value={todo.notes} 
                placeholder="descripción"
            ></textarea>
          <!-- <div> -->
            <div class="buttons">
                <button on:click={handleAddTodo}>{#if $systStatus !== "editing"}Guardar{:else} Editar{/if}</button>
              <button on:click={cancel}>Cancelar</button>
            </div>
    
            <!-- {#if editStatus}
              <button on:click={deleteTodo}>Borrar</button>
            {/if} -->
          <!-- </div> -->
    
        </div>
    
<!--        
        AddToSchedule
                {#if inActivated}
            <AddToSchedule {...todo}  on:closeIt = {close} />
        {/if} -->
    
          <!-- Todos table´s -->
        {#if isLoading}
            <p>Cargando...</p>
        {:else if error}
            <p class="error">Error: {error}</p>
        {:else}
                <div class="table__todosHoy">
                  <h3 class="title">Hoy</h3>
                <table>
                    <tbody>
                        {#each sortedTodos as todo, index (todo.id + '-' + todo.endTask + '-' + index)}
                            <tr 
                                on:click={() => toggleActions(todo.id)}
                                class="todo-row"
                                class:completed={todo.isCompleted}
                            >
                                <td>{formatDateTime(Number(todo.endTask))}</td>
                                <td class="td__task">{todo.task}</td>
                                <td class="td__notes">{todo.notes}</td>
                                {#if activeActions.get(todo.id)}
                        <td class="td__icons">
                                        <button
                                            class="icon-button"
                                            aria-label="Marcar como completada"
                                            on:click|stopPropagation={() => handleUpdateTodo({...todo, isCompleted: !todo.isCompleted})}
                                        >
                          <i class="fa-sharp fa-regular fa-square-check"></i>
                                        </button>

                                        <button 
                                            class="icon-button"
                                            aria-label="Editar tarea"
                                            on:click|stopPropagation={() => editTodo(todo)}
                                        >
                                            <i class="fa-regular fa-pen-to-square"></i>
                                        </button>

                                        <button
                                            class="icon-button"
                                            aria-label="Eliminar tarea"
                                            on:click|stopPropagation={() => handleDeleteTodo(todo.id)}
                                        >
                                            <i class="fa-regular fa-trash-can"></i>
                                        </button>
                          </td>
                      {/if}
                    </tr>
                  {/each}
                    </tbody>
                </table>
                </div>
        {/if}
              </div>
            </div>  
    
    <style>
    
      .schedule {
        display: flex;
        justify-content: center;
      }
    
      .mainContainer {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 1200px;
        height: auto;
        align-items: center;
      }
    
      .header {
        display: flex;
        width: 100%;
        justify-content: space-evenly;
    
      }
    
      .cont__shcedule {
        display: flex;
        flex-direction: column;
        width: 100%;
        align-items: center;
        padding: 8px;
        gap: 15px;
      }
    
      .contDate {
        display: flex;
        width: 60%;
        justify-content: space-around;
        
      }
    
      .table__todosHoy{
        padding: 8px;
      }
    
      h3{
        display: flex;
        justify-content: center;
      }
    
      img {
        width: 80px;
        height: auto;
        padding: 10px;
      }
    
      .inputTask {
        width: 50%;
        
      }
    
      input {
        width: 40%;
        height: 35px;
        border-radius: 8px;
        padding: 10px;
        font-family: 'Poppins', sans-serif;
        font-size: 1rem;
      }
      textarea{
        width: 60%;
        height: 50px;
        border-radius: 8px;
        padding: 10px;
        font-family: 'Poppins', sans-serif;
        font-size: 1rem;
      }
    
      button {
        height: 30px;
        padding: 0 10px;
        border-radius: 8px;
        border-color: transparent;
      }
    
      .buttons {
        display: flex;
        width: 40%;
        justify-content: space-around;
      }
    
    
    
      td {
        font-size: .8rem;
        font-weight: 300;
        padding: 8px;
        border: 1px solid rgb(42, 41, 41, .3);
      }
    
    
      .td__notes {
        width: 160px;
      }
    
      .td__task {
        width: 150px;
        text-transform: capitalize;
      }
    
      @media(max-width: 400px){
        td{
          font-size: .8rem;
        }
    
        .cont__shcedule {
          width: 100%;
        }
        .contDate {
          flex-direction: column;
          align-items: center;
          width: 100%;
          gap: 8px;
        }
        input {
          width: 100%;
        }
        textarea {
          width: 100%;
        }
        .inputTask{
          width: 100%;
        }
        .buttons {
          width: 100%;
          /* gap: 50px; */
        }
      }
    
    .error {
        color: red;
    }

    .todo-row {
        cursor: pointer;
        user-select: none;
    }

    .todo-row:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }

    .icon-button i {
        font-size: 1.6rem;  /* Hace los iconos 1.6 veces más grandes */
    }

    .icon-button {
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: inherit;
        display: flex;        /* Ayuda a centrar los iconos */
        align-items: center;  /* Centra verticalmente */
    }

    .icon-button:hover {
        color: var(--primary-color);
    }

    .completed td {
        text-decoration: line-through;
        color: #888;
    }

    .completed:hover {
        background-color: rgba(0, 0, 0, 0.02); /* Más sutil para tareas completadas */
    }

    .time-input {
        position: relative;
        width: 40%;
    }

    .time-input input[type="time"] {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-family: 'Poppins', sans-serif;
        font-size: 1rem;
        background-color: white;
        transition: border-color 0.2s ease;
    }

    .time-input input[type="time"]:hover {
        border-color: var(--primary-color);
    }

    .time-input input[type="time"]:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
    }

    .time-input input[type="time"]::-webkit-calendar-picker-indicator {
        background: none;
        cursor: pointer;
        padding: 0;
        color: var(--primary-color);
    }

    @media (max-width: 400px) {
        .time-input {
            width: 100%;
        }
    }
    
    </style>