<script>
// @ts-nocheck

    import { formatDate } from "$lib/functions/dateFunctions";

    export let binn = {};
</script>

<div class="binnacle_row">
      
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
        {formatDate(binn.date)}
      </div>
      <div class="cell__comment">
        {binn.comment}
      </div>
</div>

<style>

    
    .binnacle_row {
      display: flex;
      flex-direction: row; 
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }

    .cell__icon {
      width: 10%;
    }   
  
    .cell__date {
      width: 20%;
      align-items: center; 
    }
  
    .cell__comment {
      display: flex;
      align-items: center;
      width: 70%;
      max-width: 100%;
    }
  
    i {
      font-size: 1.5rem;
      align-items: center;
    }
  </style>