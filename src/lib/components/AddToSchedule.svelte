<script lang="ts">
   
   // Importaciones
      import { createEventDispatcher } from 'svelte';
      import { fly, fade } from 'svelte/transition';
      import { systStatus } from '$lib/stores/dataStore';
      import { todoSave } from '$lib/functions/todoSaver'
      import type { Contact, Todo } from '$lib/types';
      // import { now } from 'svelte/internal';

      // console.log($todo);
      const dispatch = createEventDispatcher();

      // Props
      export let contact: Contact;
      
      // Estado inicial de una tarea
      const INITIAL_TODO: Todo = {
         id: "",
         stage: "",
         endTask: 0,
         createdAt: 0,
         notes: "",
         isCompleted: false,
         task: "",
         timeTask: "",
         type: "", 
         user: "",
      };
      
      export let todo: Todo = INITIAL_TODO;  // Hacer todo opcional con valor por defecto

      // Variables reactivas
      $: nombre = `${contact.name} ${contact.lastname}`;
      $: tarea = { ...INITIAL_TODO };

      // Funciones
      function close() {
         dispatch('closeIt');            
         $systStatus = "contSelect";
         todo = { ...INITIAL_TODO };
      }
      
      async function addTodo() {
         
         try {
            $systStatus = "todoAdding";
            
            // Validar que tengamos una fecha válida
            if (!tarea.endTask) {
               throw new Error('Por favor selecciona una fecha');
            }

            // Combinar fecha y hora
            const dateStr = tarea.endTask; // fecha en formato YYYY-MM-DD
            const timeStr = tarea.timeTask || '00:00'; // hora en formato HH:MM
            const dateTimeStr = `${dateStr}T${timeStr}`; // formato YYYY-MM-DDTHH:MM
            
            const endTask = new Date(dateTimeStr).getTime();
            
            // Validar que la fecha sea válida
            if (isNaN(endTask)) {
               console.log(endTask);
               throw new Error('Fecha u hora inválida');
            }

            const newTodo: Todo = {
               ...tarea,
               task: nombre,
               endTask,
               createdAt: Date.now() // Agregamos la fecha de creación
            };

            await todoSave(newTodo);
            close();
         } catch (error: any) {
            console.error('Error al guardar la tarea:', error);
            alert(error.message);
         }
      }
               
      function handleKeyPress(event: KeyboardEvent) {
         if (event.key === "Enter") {
            addTodo();
         }
      }
</script>

   <!-- <body> -->

      <div 
         class="background" 
         transition:fade 
         on:click={close} 
         on:keydown={()=>{}}
         role="button"
         tabindex="0"
      ></div>
         <div class="pop__up" transition:fly>         
            <div class="input-group">
               <input 
                  type="text" 
                  class="input-task"  
                  placeholder="Agrega una Tarea o Cita" 
                  bind:value={nombre}
                  on:keydown={handleKeyPress}
               />
            </div>
            <div class="datetime-group">
               <input 
                  type="time"
                  class="input-date" 
                  bind:value={tarea.timeTask} 
                  placeholder="Hora"
               />
               <input 
                  type="date" 
                  class="input-date" 
                  bind:value={tarea.endTask} 
                  placeholder="Fecha"
               /> 
            </div>
            <div class="textarea-group">
               <textarea 
                  name="notes"  
                  rows="5" 
                  bind:value={tarea.notes} 
                  placeholder="descripción"
               ></textarea>
            </div>         
            <div class="button-group">
               <button class="btn-schedule" on:click={addTodo}>Guardar</button>
               <button class="btn-schedule" on:click={close}>Cancelar</button>
            </div>
         </div>  
      <!-- </body>   -->
      <!-- <svelte:window on:keydown={keyIsPressed}/> -->

<style>


   .background {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      align-items: bottom;
      z-index: 2;
   }

   .pop__up {
        position: fixed;
        top: 100px;
        height: auto;
        width: 350px;
        color: white;
        padding: 1.5rem;
        background-color: #37474f;
        border: solid 5px;
        /* flex-wrap: wrap; */
        border-radius: 8px;
        /* align-items: center; */
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    
	.input-task {
      font-size: 1.25rem;
      font-weight: bold;
		width: 100%;
      height: 40px;
      margin-bottom: 10px;
      border-radius: 8px;
      padding: 0.5rem;
	}

    .input-date {
        font-size: 1.25rem;
        letter-spacing: 0.4em;
        font-weight: bold;
        padding: 0.5rem;
        width: 100%;
        height: 40px;
        margin-bottom: 10px;
        border-radius: 8px;
    }

    .datetime-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    textarea {
        width: 100%;
        border-radius: 8px;
        padding: 0.5rem;
        resize: vertical;
    }

    .button-group {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
    }

    .btn-schedule{
      width: 100px;
      height: 30px;
      border-radius: 8px;
      font-size: 1.25rem;
      cursor: pointer;
    }



</style>