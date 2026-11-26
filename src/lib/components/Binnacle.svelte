<script lang="ts">
// @ts-nocheck

// importaciones
	// @ts-ignore
	import { dbBinnacle, db } from '../../firebase';
    import { formatDate } from '$lib/functions/dateFunctions.js';
    import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
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
            query(collection(db, "binnacles"), orderBy("date", "desc"), limit(50)),
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
            
            onDestroy(unsubs);

	function getActionMeta(b: any) {
		const act = String(b?.action || '').trim().toLowerCase();
		const dir = String(b?.direction || '').trim().toLowerCase();

		if (act.includes('recibido') || dir === 'inbound') {
			return {
				type: 'wa-inbound',
				icon: 'fa-brands fa-whatsapp',
				color: '#22c55e',
				title: 'WhatsApp recibido del cliente'
			};
		}
		if (act.includes('whatsapp') || dir === 'outbound') {
			return {
				type: 'wa-outbound',
				icon: 'fa-brands fa-whatsapp',
				color: '#38bdf8',
				title: 'WhatsApp enviado al cliente'
			};
		}
		if (act.includes('propiedad') || act.includes('inmueble')) {
			return {
				type: 'property-sent',
				icon: 'fa-solid fa-house-circle-check',
				color: '#f59e0b',
				title: 'Propiedad enviada'
			};
		}
		if (act.includes('editó') || act.includes('edito')) {
			return {
				type: 'edited',
				icon: 'fa-solid fa-file-pen',
				color: '#a855f7',
				title: 'Edición en expediente'
			};
		}
		if (act.includes('nota')) {
			return {
				type: 'note-added',
				icon: 'fa-solid fa-square-poll-horizontal',
				color: '#eab308',
				title: 'Nota agregada'
			};
		}
		if (act.includes('agregó') || act.includes('agrego') || act.includes('asign')) {
			return {
				type: 'user-assigned',
				icon: 'fa-solid fa-user-check',
				color: '#14b8a6',
				title: 'Asignado / Agregado'
			};
		}
		return {
			type: 'default',
			icon: 'fa-solid fa-comment-dots',
			color: '#94a3b8',
			title: b?.action || 'Nota'
		};
	}
</script>



    {#if binnContact}
        <div>
            <div class="schedule">
                <div class="binnacleHome">
                    {#each toRenBinn as item, i}
                    {@const meta = getActionMeta(item)}
                    <div class="in__binnacle type-{meta.type}">
                        <tr>
                            <div class="date__binnacle">
                                <td class="icon__binnacle">
                                    <i class="{meta.icon} action-glyph" style="color: {meta.color};" title={meta.title}/>
                                </td>
                            </div>
                            <td>
                                {formatDate(item.date)} 
                            </td>
                            <td class="comment-cell">
                                {item.comment}
                            </td>
                        </tr>
                    </div>
                    {/each}
                    
                </div>
            </div>
        </div>
    {:else}

        <h1>No hay notas </h1>
        
    <div>
        <div class="schedule">
            <div class="binnacleHome">
                {#each toRenBinn as item, i}
                    <div class="int-binnacle">
                        {#if i < 20}
                            <div class="date-binnacle">
                                {item.action}                 
                                {formatDate(item.date)} 
                                {item.comment}

                            </div>
                        {/if}                          
                    </div>
                {/each}
                
            </div>
        </div>
    </div>
    {/if}


<style>
    .binnacleHome {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
    }

    .in__binnacle {
        margin-bottom: 6px;
        border-radius: 6px;
        transition: background-color 0.18s ease;
    }

    .in__binnacle.type-wa-inbound {
        background: rgba(34, 197, 94, 0.08);
        border-left: 3px solid #22c55e;
    }

    .in__binnacle.type-wa-outbound {
        background: rgba(56, 189, 248, 0.08);
        border-left: 3px solid #38bdf8;
    }

    .in__binnacle.type-property-sent {
        background: rgba(245, 158, 11, 0.08);
        border-left: 3px solid #f59e0b;
    }

    .in__binnacle.type-edited {
        background: rgba(168, 85, 247, 0.08);
        border-left: 3px solid #a855f7;
    }

    .in__binnacle.type-note-added {
        background: rgba(234, 179, 8, 0.08);
        border-left: 3px solid #eab308;
    }

    .in__binnacle.type-user-assigned {
        background: rgba(20, 184, 166, 0.08);
        border-left: 3px solid #14b8a6;
    }

    .in__binnacle.type-default {
        background: rgba(148, 163, 184, 0.06);
        border-left: 3px solid #94a3b8;
    }

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
    
    .action-glyph {
        font-size: 1.15rem !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 22px !important;
        height: 22px !important;
        text-align: center !important;
    }

    .icon__binnacle {
        display: flex;
        color: rgb(137, 136, 136);
        padding: 8px;
        align-items: center;
    }
</style>