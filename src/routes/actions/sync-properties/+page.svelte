<script lang="ts">
    import { EasyBrokerService } from '$lib/services/easybroker';
    import { propertiesStore } from '$lib/stores/dataStore';
    import type { Property } from '$lib/types';
    import { Button } from '$components';
    // import { syncProperties } from '$lib/services/easybroker';  

    interface Changes {
        new: Property[];
        modified: Property[];
        deleted: Property[];
        total: number;
    }

    let isChecking = false;
    let isSyncing = false;
    let changes: Changes | null = null;
    let error: string | null = null;
    let isVerified = false;
    let ebPropertiesCount = 0;

    const easyBroker = new EasyBrokerService(import.meta.env.VITE_EASYBROKER_API_KEY);

    async function checkChanges() {
        isChecking = true;
        error = null;
        
        try {
            const ebProperties = await easyBroker.getProperties();
            ebPropertiesCount = ebProperties.length;
            changes = easyBroker.compareProperties(ebProperties, $propertiesStore);
            isVerified = true;
        } catch (err) {
            if (err instanceof Error) {
                error = err.message;
            } else {
                error = 'Error desconocido al verificar cambios';
            }
            isVerified = false;
        } finally {
            isChecking = false;
        }
    }

    async function syncChanges() {
        isSyncing = true;
        error = null;
        
        try {
            const propertiesToUpload = await easyBroker.preparePropertiesToUpload({
                new: changes?.new.map(p => p.public_id) || [],
                modified: changes?.modified.map(p => p.public_id) || []
            });
            
            await easyBroker.syncChanges(propertiesToUpload);
            
            // Recargar propiedades después de sincronizar
            const ebProperties = await easyBroker.getProperties();
            changes = easyBroker.compareProperties(ebProperties, $propertiesStore);
            
        } catch (err) {
            error = err instanceof Error ? err.message : 'Error desconocido durante la sincronización';
        } finally {
            isSyncing = false;
        }
    }

</script>



<div class="sync-container">
    <div class="header">
        <h2 class="title">Sincronización de Propiedades</h2>
        <div class="actions">
            <Button 
                element="button"
                variant="solid"
                disabled={isChecking || isSyncing}
                on:click={changes?.total ? syncChanges : checkChanges}
                style={changes?.total ? "background-color: #6b21a8;" : ""}
            >
                {#if isChecking}
                    Verificando...
                {:else if isSyncing}
                    Sincronizando...
                {:else if changes?.total}
                    Sincronizar ({changes.total} cambios)
                {:else}
                    Verificar Cambios
                {/if}
            </Button>
        </div>
    </div>

    {#if isVerified}
        <div class="summary">
            <h4 class="title">Propiedades en EasyBroker: <strong>{ebPropertiesCount}</strong></h4>
            <h4 class="title">Propiedades en Firebase: <strong>{$propertiesStore.length}</strong></h4>
        </div>
    {/if}

    {#if error}
        <div class="error-message">
            {error}
        </div>
    {/if}

    {#if changes}
        <div class="changes-grid">
            <!-- Nuevas Propiedades -->
            <div class="changes-section">
                <div class="changes-header">
                    <h2>Nuevas</h2>
                    <span class="changes-count status-new">{changes.new.length}</span>
                </div>
                <div class="property-list">
                    {#each changes.new as property}
                        <div class="property-item">
                            <img 
                                src={property.title_image_thumb || '/placeholder-property.png'} 
                                alt={property.title}
                                class="property-thumb"
                            />
                            <div class="property-info">
                                <h3>{property.title}</h3>
                                <p>{property.location}</p>
                                <span class="status-badge status-new">Nueva</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Propiedades Modificadas -->
            <div class="changes-section">
                <div class="changes-header">
                    <h2>Modificadas</h2>
                    <span class="changes-count status-modified">{changes.modified.length}</span>
                </div>
                <div class="property-list">
                    {#each changes.modified as property}
                        <div class="property-item">
                            <img 
                                src={property.title_image_thumb || '/placeholder-property.png'} 
                                alt={property.title}
                                class="property-thumb"
                            />
                            <div class="property-info">
                                <h3>{property.title}</h3>
                                <p>{property.location}</p>
                                <span class="status-badge status-modified">Modificada</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Propiedades Eliminadas -->
            <div class="changes-section">
                <div class="changes-header">
                    <h2>Eliminadas</h2>
                    <span class="changes-count status-deleted">{changes.deleted.length}</span>
                </div>
                <div class="property-list">
                    {#each changes.deleted as property}
                        <div class="property-item">
                            <img 
                                src={property.title_image_thumb || 'https://via.placeholder.com/200x150'} 
                                alt={property.title}
                                class="property-thumb"
                            />
                            <div class="property-info">
                                <h3>{property.title}</h3>
                                <p>{property.location}</p>
                                <span class="status-badge status-deleted">Eliminada</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div> 

<style>
    .sync-container {
        padding: 1rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
    }

    .changes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-bottom: 2rem;
    }

    .changes-section {
        background: var(--surface-2);
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .changes-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .changes-count {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--text-1);
    }

    .property-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-height: 400px;
        overflow-y: auto;
    }

    .property-item {
        display: flex;
        gap: 1rem;
        background: var(--surface-1);
        padding: 1rem;
        border-radius: 4px;
        transition: transform 0.2s;
    }

    .property-item:hover {
        transform: translateY(-2px);
    }

    .property-thumb {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 4px;
    }

    .property-info {
        flex: 1;
    }

    .status-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .status-new { background: var(--success-light); color: var(--success); }
    .status-modified { background: var(--warning-light); color: var(--warning); }
    .status-deleted { background: var(--error-light); color: var(--error); }

    /* Media Queries */
    @media (max-width: 768px) {
        .header {
            flex-direction: column;
            align-items: stretch;
        }

        .changes-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
        }

        .changes-section {
            padding: 1rem;
        }
    }

    @media (max-width: 480px) {
        .sync-container {
            padding: 0.5rem;
        }

        .property-item {
            padding: 0.75rem;
        }

        .changes-count {
            font-size: 1.25rem;
        }
    }

    /* Scrollbar personalizado */
    .property-list::-webkit-scrollbar {
        width: 6px;
    }

    .property-list::-webkit-scrollbar-track {
        background: var(--surface-1);
    }

    .property-list::-webkit-scrollbar-thumb {
        background: var(--surface-3);
        border-radius: 3px;
    }

    /* Animaciones */
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .property-item {
        animation: fadeIn 0.3s ease-out;
    }

    .summary {
        background: var(--surface-2);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 2rem;
        display: flex;
        gap: 2rem;
        justify-content: center;
    }

    /* .summary p {
        margin: 0;
    } */

    .summary strong {
        color: var(--primary);
    }
</style>