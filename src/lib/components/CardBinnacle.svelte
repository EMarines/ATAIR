<script>
// @ts-nocheck
    import { formatDate } from "$lib/functions/dateFunctions";
    export let binn = {};
</script>

<div class="binnacle__row">
      <div class="cell__icon">
        {#if binn.action === "WhatsApp enviado: "}
          <i class="fa-brands fa-square-whatsapp"></i>
        {:else if binn.action === "Se editó a: "}
          <i class="fa-solid fa-file-pen"></i>
        {:else if binn.action === "Nota agregada: "}
          <i class="fa-solid fa-square-poll-horizontal"></i>
        {:else if binn.action === "Se agregó a: "}
          <i class="fa-solid fa-user-check"></i>
        {:else if binn.action === "Propiedad enviada: "}
          <i class="fa-solid fa-house-circle-check"></i>
        {:else}
          {binn.action}
        {/if}
      </div>
      <div class="cell__date">
        <div>{formatDate(binn.date)}</div>
      </div>
      <div class="cell__comment" title="{binn.comment}">
        {binn.comment}
      </div>
</div>

<style>
    .binnacle__row {
      display: grid;
      grid-template-columns: 40px minmax(80px, 15%) 1fr; /* Columnas con tamaños más precisos */
      align-items: start;
      grid-row-gap: 0;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      padding-bottom: 15px;
      margin-left: 4px;
      column-gap: 12px; /* Aumentado de 8px a 12px para más espacio entre columnas */
      grid-template-areas: "icon date comment"; /* Nombrar áreas de la cuadrícula */
    }

    .cell__icon {
      width: 35px; /* Ligeramente más ancho para el icono */
      align-self: flex-start;
      display: flex;
      justify-content: center;
      grid-area: icon;
      padding-right: 5px; /* Añadir padding a la derecha del icono */
    }   
  
    .cell__date {
      display: flex;
      min-width: 70px;
      justify-content: flex-start;
      align-self: start;
      padding-top: 0;
      font-size: 0.85rem; /* Texto un poco más pequeño */
      grid-area: date;
      padding-left: 5px; /* Añadir padding a la izquierda de la fecha */
    }
    
    .cell__date div {
      margin-top: 0;
      line-height: 1;
      white-space: nowrap; /* Evita que la fecha se parta */
    }
    
    .cell__comment {
      align-self: flex-start;
      line-height: 1.3;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2; /* Limita a 2 líneas */
      line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word; /* Permite romper palabras largas */
      font-size: 0.85rem; /* Texto un poco más pequeño */
    }
  
    i {
      font-size: 1.5rem; /* Iconos ligeramente más pequeños */
      align-items: center;
    }
    
    /* Media query para pantallas pequeñas */
    @media (max-width: 768px) {
      .binnacle__row {
        grid-template-columns: 35px minmax(70px, 20%) 1fr; /* Ajuste para pantallas medianas */
        column-gap: 10px; /* Reducir un poco en pantallas medianas, pero mantener buen espacio */
      }
    }
    
    /* Media query para pantallas muy pequeñas */
    @media (max-width: 480px) {
      .binnacle__row {
        grid-template-columns: 30px minmax(65px, 25%) 1fr; /* Reducir aún más en móviles */
        margin-left: 2px;
        column-gap: 8px; /* Reducido para móviles pero aún mayor que el original */
        padding-bottom: 10px; /* Menos espacio entre filas */
      }
      
      .cell__icon {
        width: 25px; /* Iconos más pequeños en móvil */
      }
      
      i {
        font-size: 1.2rem; /* Iconos más pequeños */
      }
      
      .cell__date, .cell__comment {
        font-size: 0.75rem; /* Texto más pequeño */
      }
      
      .cell__comment {
        -webkit-line-clamp: 3; /* Permitir una línea más en móvil */
        line-clamp: 3;
      }
    }
</style>