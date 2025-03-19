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
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 1.5rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .card__info:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .card__Title {
    text-transform: capitalize;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .card__infoHead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #eaeaea;
  }

  .card__infoHead .date {
    font-size: 0.875rem;
    color: #666;
  }

  .info__cont {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .info__cont span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #444;
  }

  .info__cont i {
    color: #666;
    width: 1rem;
    text-align: center;
  }

  .info__features {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .info__features > span {
    font-weight: 500;
    color: #1a1a1a;
  }

  .info__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .info__tags span {
    background: #f5f5f5;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #666;
  }
</style>