<script lang="ts">
    import { contactsStore, propertiesStore, systStatus, contact } from '$lib/stores/dataStore';    
    import { InputOptions, InputOptionsMultiple } from '$components';
    import InputNumber from '$lib/components/InputNumber.svelte';
    import { Button } from '$components';
    import type { Contact } from '$lib/types';
    type ExtendedContact = Contact & { tags?: string[] };
    
    let filteredContacts: ExtendedContact[] = [];
    let contacts: ExtendedContact[] = [];
    $: contacts = $contactsStore as ExtendedContact[];
    let selectedBedrooms: string = '';
    let selectedBathrooms: string = ''; 
    let selectedParking: string = '';
    let selectedtypeContact: string = '';
    let selectedtypeProperty: string = '';
    let selectedlocaProperty: string = '';
    let selectedcontactStage: string = '';
    let selectedrangeProp: string = '';
    let selectedtagsProperty: string[] = [];
    let budget: number = 0;
    let startDate: string = '';
    let endDate: string = '';

    const contactStage = {
        operation: {
            name: "Etapa",
            choices: ["Etapa1", "Etapa2", "Etapa3", "Etapa4", "Etapa5"]
        }
    };

    const typeContact = {
        operation: {
            name: "Tipo de Operación",
            choices: ["Comprador", "Arrendador", "Arrendatario", "Inversionista", "Asesor Inmobiliario", "Captación"]
        }
    };

    const selectTP = {
        operation: {
            name: "Tipo de Propiedad",
            choices: ["Casa", "Departamento", "Terreno", "Terreno Comercial", "Terreno Industrial", "Local", "Bodega", "Rancho", "Granja"]
        }
    };

    const locaProperty = {
        operation: {
            name: "Ubicación de la Propiedad",
            choices: ["Norte", "Noroeste", "Noreste", "Oeste", "Centronorte", "Este", "CentroSur", "Suroeste", "Suroeste"]
        }
    };

    const tagsProperty = {
        operation: {
            name: "Preferencias",
            choices: ["Fracc. Privado", "Frente a Parque", "Una Planta", "Recamara en P.B.", "Patio Amplio", "Lista para Habitarse", "Nueva", "En Avenida", "Alberca"]
        }
    };

    const propertyOptions = {
        bedrooms: {
            name: "Recámaras",
            choices: ["1", "2", "3", "4", "5+"]
        },
        bathrooms: {
            name: "Baños",
            choices: ["1", "2", "3", "4+"]
        },
        parking: {
            name: "Estacionamientos",
            choices: ["1", "2", "3", "4+"]
        }
    };

    // Eliminar todas las funciones handle individuales y reemplazar por una sola
    function handleFilterChange(event: CustomEvent<string | string[]>, filterType: string) {
        console.log(event.detail);
        switch(filterType) {
            case 'typeContact':
                selectedtypeContact = event.detail as string;
                break;
            case 'typeProperty':
                selectedtypeProperty = event.detail as string;
                break;
            case 'contactStage':
                selectedcontactStage = event.detail as string;
                break;
            case 'budget':
                budget = Number(event.detail as string);
                break;
            case 'bedrooms':
                selectedBedrooms = event.detail as string;
                break;
            case 'bathrooms':
                selectedBathrooms = event.detail as string;
                break;
            case 'parking':
                selectedParking = event.detail as string;
                break;
            case 'locaProperty':
                selectedlocaProperty = event.detail as string;
                break;
            case 'tagsProperty':
                selectedtagsProperty = event.detail as string[];
                break;
            case 'startDate':
                startDate = event.detail as string;
                break;
            case 'endDate':
                endDate = event.detail as string;
                break;
        }
    }

    // Modificar la lógica de filtrado para que sea en cascada
    $: {
        // Comenzar con todos los contactos
        filteredContacts = contacts;

        // Filtrar por rango de fechas
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filteredContacts = filteredContacts.filter(contact => {
                const contactDate = new Date(contact.createdAt);
                return contactDate >= start && contactDate <= end;
            });
        }

        // Filtrar por operación
        if (selectedtypeContact) {
            filteredContacts = filteredContacts.filter(contact => 
                contact.typeContact === selectedtypeContact
            );
        }

        // Filtrar por tipo de propiedad
        if (selectedtypeProperty) {
            filteredContacts = filteredContacts.filter(contact => 
                contact.selecTP === selectedtypeProperty
            );
        }

        // Filtrar por presupuesto
        if (budget && budget > 0) {
            const maxBudget = budget * 1.10; // 10% más
            const minBudget = budget * 0.70; // 30% menos
            filteredContacts = filteredContacts.filter(contact => {
                const contactBudget = Number(contact.budget || 0);
                return contactBudget >= minBudget && contactBudget <= maxBudget;
            });
        } else {
            // Si no hay budget específico, usar el rango de propiedad
            let maxBudgetByRange = 0;
            
            switch(selectedrangeProp) {
                case 'PRM': maxBudgetByRange = 1000000; break;
                case 'SGN': maxBudgetByRange = 2500000; break;
                case 'TRC': maxBudgetByRange = 4500000; break;
                case 'CRT': maxBudgetByRange = 8500000; break;
                case 'QNT': maxBudgetByRange = 12000000; break;
                case 'SXT': maxBudgetByRange = 15000000; break;
            }

            if (maxBudgetByRange > 0) {
                filteredContacts = filteredContacts.filter(contact => {
                    const contactBudget = Number(contact.budget || 0);
                    return contactBudget <= maxBudgetByRange;
                });
            }
        }

        // Filtrar por recámaras
        if (selectedBedrooms) {
            filteredContacts = filteredContacts.filter(contact => 
                Number(contact.numBeds) <= Number(selectedBedrooms.replace('+', ''))
            );
        }

        if (selectedcontactStage) {
            filteredContacts = filteredContacts.filter(contact => 
                contact.contactStage === selectedcontactStage
            );
        }

        // Filtrar por baños
        if (selectedBathrooms) {
            filteredContacts = filteredContacts.filter(contact => 
                Number(contact.numBaths) <= Number(selectedBathrooms.replace('+', ''))
            );
        }

        // Filtrar por estacionamientos
        if (selectedParking) {
            filteredContacts = filteredContacts.filter(contact => 
                Number(contact.numParks) <= Number(selectedParking.replace('+', ''))
            );
        }

        // Filtrar por ubicación
        if (selectedlocaProperty) {
            filteredContacts = filteredContacts.filter(contact => {
                // Verifica si locaProperty es un array
                if (Array.isArray(contact.locaProperty)) {
                    return contact.locaProperty.includes(selectedlocaProperty);
                }
                // Si no es array, compara directamente
                return contact.locaProperty === selectedlocaProperty;
            });
        }

        // Filtrar por tags (preferencias)
        if (selectedtagsProperty.length > 0) {
            filteredContacts = filteredContacts.filter(contact => {
                // Verifica si el contacto tiene tags y si es un array
                if (contact.tags && Array.isArray(contact.tags)) {
                    // Verifica si al menos uno de los tags seleccionados está presente
                    return selectedtagsProperty.some(tag => contact.tagsProperty.includes(tag));
                }
                return false;
            });
        }
    }

    // function handleFilter() {
    //     const filters = {
    //         operation: selectedtypeContact,
    //         typeProperty: selectedtypeProperty,
    //         budget,
    //         bedrooms: selectedBedrooms,
    //         bathrooms: selectedBathrooms,
    //         parking: selectedParking
    //     };
    //     console.log('Aplicando filtros:', filters);
    //     // Aquí puedes agregar la lógica para filtrar
    // }

    function handleClearFilters() {
        // Resetear todos los valores a su estado inicial
        selectedBedrooms = '';
        selectedBathrooms = '';
        selectedParking = '';
        selectedtypeContact = '';
        selectedtypeProperty = '';
        selectedcontactStage = '';
        budget = 0;
        selectedlocaProperty = '';
        selectedtagsProperty = [];
        startDate = '';
        endDate = '';
    }

    // Agregar variable reactiva para controlar visibilidad del botón
    $: showClearButton = selectedBedrooms !== '' || 
                        selectedBathrooms !== '' || 
                        selectedParking !== '' || 
                        selectedtypeContact !== '' || 
                        selectedtypeProperty !== '' ||
                        selectedcontactStage !== '' ||
                        selectedlocaProperty !== '' ||
                        selectedtagsProperty.length > 0 ||
                        budget !== 0 ||
                        startDate !== '' ||
                        endDate !== '';

    // Agregar variable reactiva para verificar si hay filtros activos
    $: hasActiveFilters = selectedBedrooms !== '' || 
                         selectedBathrooms !== '' || 
                         selectedParking !== '' || 
                         selectedtypeContact !== '' || 
                         selectedtypeProperty !== '' ||
                         selectedlocaProperty !== '' ||
                         selectedtagsProperty.length > 0 ||
                         budget !== 0 ||
                         startDate !== '' ||
                         endDate !== '';
</script>

<h1 class="title">Filtro de Contactos</h1>

<div class="operation-filters">
    <h3 class="title">Rango de Fechas</h3>
    
    <div class="filters-grid">
        <div class="input-container">
            <label class="input-label" for="startDate">Fecha Inicial</label>
            <input 
                type="date" 
                id="startDate"
                class="input-select"
                value={startDate}
                on:change={(e) => handleFilterChange(new CustomEvent('change', {
                    detail: e.currentTarget.value
                }), 'startDate')}
            />
        </div>

        <div class="input-container">
            <label class="input-label" for="endDate">Fecha Final</label>
            <input 
                type="date" 
                id="endDate"
                class="input-select"
                value={endDate}
                min={startDate}
                on:change={(e) => handleFilterChange(new CustomEvent('change', {
                    detail: e.currentTarget.value
                }), 'endDate')}
            />
        </div>
    </div>

    <h3 class="title">Tipo de Operación y Presupuesto</h3>
    
    <div class="filters-grid">
        <InputOptions 
            name={typeContact.operation.name}
            identificador="typeContact"
            value={selectedtypeContact}
            choices={typeContact.operation.choices}
            on:change={(event) => handleFilterChange(event, 'typeContact')}
        />
        <InputOptions 
            name={selectTP.operation.name}
            identificador="typeProperty"
            value={selectedtypeProperty}
            choices={selectTP.operation.choices}
            on:change={(event) => handleFilterChange(event, 'typeProperty')}
        />
        <InputOptions 
            name={contactStage.operation.name}
            identificador="contactStage"
            value={selectedcontactStage}
            choices={contactStage.operation.choices}
            on:change={(event) => handleFilterChange(event, 'contactStage')}
        />

        <InputNumber 
            name="Presupuesto Máximo"
            identificador="budget"
            value={budget}
            step={100000}
            min={0}
            on:change={(event) => handleFilterChange(event, 'budget')}
        />
    </div>

   
<!-- </div> -->
<!-- 
<div class="property-filters">
    <h2>Características de la Propiedad</h2> -->
    
    <div class="filters-grid">
        <InputOptions 
            name={propertyOptions.bedrooms.name}
            identificador="bedrooms"
            value={selectedBedrooms}
            choices={propertyOptions.bedrooms.choices}
            on:change={(event) => handleFilterChange(event, 'bedrooms')}
        />
        
        <InputOptions 
            name={propertyOptions.bathrooms.name}
            identificador="bathrooms"
            value={selectedBathrooms}
            choices={propertyOptions.bathrooms.choices}
            on:change={(event) => handleFilterChange(event, 'bathrooms')}
        />

        <InputOptions 
            name={propertyOptions.parking.name}
            identificador="parking"
            value={selectedParking}
            choices={propertyOptions.parking.choices}
            on:change={(event) => handleFilterChange(event, 'parking')}
        />
    </div>

    <div class="filters-grid">

        <InputOptions 
            name={locaProperty.operation.name}
            identificador="locaProperty"
            value={selectedlocaProperty}
            choices={locaProperty.operation.choices}
            on:change={(event) => handleFilterChange(event, 'locaProperty')}
        />

        <InputOptionsMultiple 
            name={tagsProperty.operation.name}
            identificador="tagsProperty"
            value={selectedtagsProperty}
            choices={tagsProperty.operation.choices}
            on:change={(event) => handleFilterChange(event, 'tagsProperty')}
        />

    </div>
    
    {#if showClearButton}
        <Button 
            element="button" 
            variant="solid" 
            on:click={handleClearFilters}
        >
            Limpiar Filtros
        </Button>
    {/if}
</div>

<!-- Agregar sección para mostrar los resultados -->
<div class="results-section">
    {#if hasActiveFilters}
        <h2>Resultados ({filteredContacts.length})</h2>
        
        {#if filteredContacts.length > 0}
            <div class="contacts-grid">
                {#each filteredContacts as contact}
                    <div class="contact-card">
                        <h5>{contact.name} {contact.lastname}</h5>
                        <p>Teléfono: {contact.telephon} Presupuesto: {contact.budget}</p>
                        <p>Recámaras: {contact.numBeds}</p>
                        <p>Ubicación: {contact.locaProperty}</p>
                    </div>
                {/each}
            </div>
        {:else}
            <p>No se encontraron contactos con los filtros seleccionados</p>
        {/if}
    {:else}
        <p>Selecciona al menos un filtro para ver resultados</p>
    {/if}
</div>

<style>
    :global(body) {
        background-color: #111827;
    }

    .title {
        font-size: 1.5rem;
        font-weight: 600;
        color: white;
        margin-bottom: 2rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #374151;
    }

    .operation-filters {
        background-color: #1f2937;
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .operation-filters h3.title {
        font-size: 1.2rem;
        color: #e5e7eb;
        margin-bottom: 1.5rem;
        border-bottom: none;
    }

    .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .results-section {
        background-color: #1f2937;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .results-section h2 {
        font-size: 1.2rem;
        color: #e5e7eb;
        margin-bottom: 1.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #374151;
    }

    .contacts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .contact-card {
        background-color: #111827;
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 1.5rem;
        transition: all 0.2s ease;
    }

    .contact-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        background-color: #1f2937;
    }

    .contact-card h5 {
        font-size: 1.1rem;
        font-weight: 600;
        color: #e5e7eb;
        margin-bottom: 1rem;
    }

    .contact-card p {
        color: #9ca3af;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        line-height: 1.4;
    }

    /* Estilos globales para inputs y selects */
    :global(.input-container) {
        background-color: #111827;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        transition: all 0.2s ease;
    }

    :global(.input-container:hover) {
        background-color: #1f2937;
        border-color: #4b5563;
    }

    :global(.input-label) {
        font-size: 0.9rem;
        font-weight: 500;
        color: #e5e7eb;
        margin-bottom: 0.5rem;
        display: block;
    }

    :global(.input-select) {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #374151;
        border-radius: 6px;
        background-color: #111827;
        color: #e5e7eb;
        font-size: 0.95rem;
    }

    :global(.input-select:focus) {
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        outline: none;
    }

    /* Estilo para el botón */
    :global(button) {
        background-color: #3b82f6;
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 500;
        font-size: 0.95rem;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
    }

    :global(button:hover) {
        background-color: #2563eb;
        transform: translateY(-1px);
    }

    :global(button:active) {
        transform: translateY(0);
    }

    /* Agregar estos estilos específicos para los inputs de fecha */
    :global(input[type="date"]) {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #374151;
        border-radius: 6px;
        background-color: #111827;
        color: #e5e7eb;
        font-size: 0.95rem;
    }

    :global(input[type="date"]::-webkit-calendar-picker-indicator) {
        filter: invert(1);
        cursor: pointer;
    }

    :global(input[type="date"]:focus) {
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        outline: none;
    }
</style>
