<script>
// @ts-nocheck

    import { formatDate } from "$lib/functions/dateFunctions";

    export let binn = {};
</script>

<div class="binnacle_row">
    <div class="date__binnacle">
      <div class="cell">
        {formatDate(binn.date)}
      </div>
      <div class="cell icon__binnacle">
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
      <div class="cell comment">
        {binn.comment}
      </div>
    </div>
</div>

<style>
    .binnacle_row {
      display: flex;
      flex-direction: row; /* Alinea las bitácoras en línea */
      align-items: stretch; /* Asegura que todos los contenedores tengan la misma altura */
      width: 100%; /* Asegura que ocupe todo el ancho disponible */
    }
  
    .date__binnacle {
      display: flex;
      flex-direction: row; /* Alinea los elementos en una fila horizontal */
      align-items: center; /* Centra los elementos verticalmente */
      font-size: 1.3em;
      gap: 4px; /* Reduce el espacio entre la fecha y el ícono */
      flex: 0 0 auto; /* Mantiene un ancho fijo */
      padding: 4px; /* Reduce el padding */
      height: 100%; /* Asegura que tenga la misma altura que el contenedor padre */
    }
  
    .cell {
      font-size: 0.8em;
      font-weight: 300;
      padding: 4px; /* Reduce el padding */
      align-items: center; /* Centra el contenido verticalmente */
      height: 100%; /* Asegura que tenga la misma altura que el contenedor padre */
    }
  
    .cell.comment {
      flex: 1; /* Ocupa el resto del espacio disponible */
      display: flex;
      align-items: center; /* Centra el contenido verticalmente */
    }
  
    i {
      font-size: 1.5rem;
      align-items: center;
    }
  </style>