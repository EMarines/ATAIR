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
      grid-template-columns: 10% 15% 75%;
      align-items: start;
      grid-row-gap: 0;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      padding-bottom: 15px;
      margin-left: 8px;
    }

    .cell__icon {
      /* width: 10%; */
      align-self: flex-start;
    }   
  
    .cell__date {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-self: start;
      padding-top: 0;
    }
    
    .cell__date div {
      margin-top: 0;
      line-height: 1;
    }
    
    .cell__comment {
      /* width: 75%; */
      align-self: flex-start;
      line-height: 1.3; /* Espacio reducido entre líneas */
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2; /* Limita a 2 líneas */
      line-clamp: 2; /* Standard property for compatibility */
      -webkit-box-orient: vertical;
    }
  
    i {
      font-size: 1.65rem;
      align-items: center;
    }
</style>