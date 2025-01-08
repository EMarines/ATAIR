<script>
// @ts-nocheck
  import { toComaSep, toTele } from '$lib/functions/format'
  import { formatDate } from '$lib/functions/dateFunctions.js'

  export let cont = {}; 
</script>


  <div class="card__info">
    <div class="card__infoHead">
      <span class="card__Title">{cont.name} {cont.lastname}</span>
      <span class="date">{formatDate(cont.createdAt)}</span>
    </div>
    <div class="info__cont">      
      {#if cont.telephon}
        <span> <i class="fa-solid fa-mobile-screen-button"></i> {toTele(cont.telephon)} {cont.contactStage}</span>
      {/if}
      {#if cont.email }
        <span> <i class="fa-regular fa-envelope"></i> {cont.email} </span>
      {/if}
    </div>
    <div class="info__features">
      {#if cont.budget}
        <span><i class="fa-solid fa-money-check-dollar"></i> $ {toComaSep(Number(cont.budget))}.</span>
      {:else}
        <span> <i class="fa-solid fa-money-check-dollar"></i> {cont.rangeProp}</span>
      {/if}
      <div class="info__tags">
        {#if cont.tagsProperty}
          <span><i class="fa-solid fa-tags to__showR"></i> {cont.tagsProperty.toString().replaceAll(",", ", ")}</span>
        {/if}
        {#if cont.locaProperty}
          <span><i class="fa-sharp fa-regular fa-compass to__showR"></i> {cont.locaProperty.toString().replaceAll(",", ", ")}</span>
        {/if}
      </div>
    </div>

  </div>
 

<style>

    
  .card__info {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    font-weight: 400;

  }

  .card__Title {
    text-transform: capitalize;
  }

  .card__infoHead {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 30%;
    justify-content: space-around;
    align-items: center;
    font-size: 1rem;
    font-weight:400;
    padding-top: 8px;
    gap: 15px;
  }

  .info__cont {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 20%;
    align-items: center;
    justify-content: center;
    font-size: .75rem;
    font-weight: 500;
    gap: 10px;
    margin-bottom: 5px;
    overflow: hidden;
  }

  .info__features {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 20%;
    align-items: center;
    justify-content: center;
    font-size: .75rem;
    font-weight: 500;
    /* overflow: hidden; */
    /* gap: 10px; */
  }

  .info__tags {
    display: flex;
    flex-direction: row;
    height: 20%;
    font-size: .75rem;
    flex-wrap: wrap;
    gap: 15px;
  }



</style>