<script>
// @ts-nocheck

// importaciones
	// @ts-ignore
	import { dbBinnacle, db } from '../../firebase';
    import { formatDate } from '$lib/functions/dateFunctions.js';
    import { collection, onSnapshot } from 'firebase/firestore';
    import { onDestroy } from 'svelte';
    // @ts-ignore
    import { systStatus } from '$lib/stores/store';


    // $systStatus = "contSelect"
// declaraciones
    /**
   * @type {any[]}
   */
    let toRenBinn=[];
    
    // @ts-ignore
    let binnContact = true;

// Ordena por fechas
    /**
   * @param {any[]} toRenBinn
   */
    function ordenar(toRenBinn){
        toRenBinn.sort((a, b) => {
            if(new Date(a.date) < new Date(b.date)){
                return 1;
            } else if (new Date(a.date) > new Date(b.date)){
                return -1;
            } else {
                return 0;
            }
        })
    };

// Renderizar Binaccle
        const unsubs = onSnapshot(
            collection(db, "binnacles"),
            (querySnapshot) => {
                // @ts-ignore
                toRenBinn = querySnapshot.docs.map(doc => {
                    return{...doc.data(), id: doc.id}
                })
                // @ts-ignore
                ordenar(toRenBinn)
                //    console.log(toRenBinn)
            },
            (err) =>{
                console.log(err);
            }
            );
            
            onDestroy(unsubs)
   

</script>



    {#if binnContact}
        <div>
            <div class="schedule">
                <div class="binnacleHome">
                    {#each toRenBinn as item, i}
                    <div class="in__binnacle">
                        <tr>
                            <div class="date__binnacle">
                                <td>
                                    {formatDate(item.date)} 
                                </td>

                                <td class="icon__binnacle">
                                    {#if item.action === "WhatsApp enviado: "}
                                        <i class="fa-brands fa-square-whatsapp"/>
                                    {:else if item.action === "Se editó a: "}
                                        <i class="fa-solid fa-file-pen"/>
                                    {:else if item.action === "Nota agregada: "}
                                        <i class="fa-solid fa-square-poll-horizontal"/>
                                    {:else if item.action === "Se agregó a: "}
                                        <i class="fa-solid fa-user-check"/>
                                    {:else if item.action === "Propiedad enviada: "}
                                        <i class="fa-solid fa-house-circle-check" />
                                    {:else}
                                        {item.action}          

                                    {/if}
                                </td>
                            </div>
                            <td>
                                {item.comment}
                            </td>
                        </tr>
                            </div>
                    {/each}
                    
                </div>
            </div>
        </div>
    {:else}
        
    <div>
        <div class="schedule">
            <div class="binnacleHome">
                <!-- <h1 class="title">Bitácora</h1> -->
                {#each toRenBinn as item, i}
                <div class="int-binnacle">
                    {#if i < 20}
                        <div class="date-binnacle">
                            {formatDate(item.date)} 
                            {item.action}                 
                            {item.comment}
                            <!-- a: 
                            {item.to} -->
                        </div>
                    {/if}                          
                </div>
                {/each}
                
            </div>
        </div>
    </div>
    {/if}


<style>
    .date__binnacle {
        display: flex;
        flex-direction: row;
        width: 100%;

    }

   td {
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
    /* width: 20%; */
    color: rgb(137, 136, 136);
    padding: 8px;
    align-items: center;
    /* border: 1px solid rgb(42, 41, 41, .3) */
   }
</style>