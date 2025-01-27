<script>
// @ts-nocheck

    import { formatDate } from "$lib/functions/dateFunctions";

    export let binn = {};
</script>

<div class="in__binnacle">
    <div class="binnacle-row">
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
        </div>
        <div class="cell">
            {binn.comment}
        </div>
    </div>
</div>

<style>
    .cell {
        font-size: .8em;
        font-weight: 300;
        color: rgb(137, 136, 136);
        padding: 8px;
        align-items: center;
        border: 1px solid rgb(42, 41, 41, .3);
    }
    
    i {
        font-size: 2rem;
        align-items: center;
        color: rgb(137, 136, 136);
    }
    
    .icon__binnacle {
        display: flex;
        width: 50px;
        color: rgb(137, 136, 136);
        padding: 8px;
        align-items: center;
        /* border: 1px solid rgb(42, 41, 41, .3) */
    }
</style>