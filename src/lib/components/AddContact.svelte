<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { systStatus, propertiesStore, property, contactsStore } from '$lib/stores/dataStore';
    import { Search, Tags, Ubication, InputText, InputOptions, InputEmail, InputDate, CardProperty, Button } from '$components';
    import { typeContacts, modeContact, typeProperties, modePays, oneToFive, oneToFour, oneToThree, contStage, range } from '$lib/parameters';
    import type { Property, Contact, AddContactEvents } from '$lib/types';
    import { ranPrice } from '$lib/functions/rangeValue';
    import { onMount, onDestroy } from 'svelte';
    // Importar las funciones necesarias para sincronizar con Google
    import { syncContact, getAccessToken } from '$lib/services/googleService';
    import { get } from 'svelte/store';

    const dispatch = createEventDispatcher<AddContactEvents>();

    // Validaciones
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PHONE_REGEX = /^\+?[\d\s-]{10,}$/;

    interface ErroresFormulario {
        name?: string;
        lastname?: string;
        email?: string;
        telephon?: string;
        general?: string;
    }

    let erroresFormulario: ErroresFormulario = {};
    // Crear un tipo para los campos que queremos validar
    type CamposValidados = Pick<Contact, 'name' | 'lastname' | 'email' | 'telephon'>;
    let camposModificados: Record<keyof CamposValidados, boolean> = {
        name: false,
        lastname: false,
        email: false,
        telephon: false
    };
    let isDirty = false;
    let isSubmitting = false;
    let showProp = false;
    let searchTerm = "";
    let propToRender = $propertiesStore;
    let showAdditionalFields = false;
    let errorMessage = ''; // Variable para almacenar mensajes de error

    // Estado unificado del formulario
    export let existingContact: Contact | null = null;
    
    let contact: Contact = existingContact ? { ...existingContact } : {
        budget: 0,
        comContact: '',
        contactStage: 'Etapa1',
        createdAt: Date.now(),
        email: '',
        halfBathroom: 0,
        id: '',
        lastname: '',
        locaProperty: [],
        modePay: '',
        name: '',
        notes: '',
        numBaths: 0,
        numBeds: 0,
        numParks: 0,
        rangeProp: '',
        selecMC: '',
        selecTP: '',
        tagsProperty: [],
        telephon: '',
        typeContact: '',
    };

    // Función para generar un UUID
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function handleBlur(field: keyof CamposValidados) {
        if (field in camposModificados) {
            camposModificados[field] = true;
            validateField(field, contact[field]);
        }
    }

    function validateField(field: keyof CamposValidados, value: any) {
        // Solo validar si el campo ha sido tocado o si el formulario está siendo enviado
        if (!camposModificados[field] && !isDirty) {
            return;
        }

        erroresFormulario[field] = '';

        switch(field) {
            case 'name':
                if (!value?.trim()) {
                    erroresFormulario.name = 'El nombre es requerido';
                } else if (value.length < 2) {
                    erroresFormulario.name = 'El nombre es muy corto';
                }
                break;
            case 'telephon':
                if (!value?.trim()) {
                    erroresFormulario.telephon = 'El teléfono es requerido';
                } else if (!PHONE_REGEX.test(value)) {
                    erroresFormulario.telephon = 'Formato de teléfono inválido';
                }
                break;
            case 'email':
                if (!value?.trim()) {
                    erroresFormulario.email = 'El email es requerido';
                } else if (!EMAIL_REGEX.test(value)) {
                    erroresFormulario.email = 'Email inválido';
                }
                break;
            case 'lastname':
                if (!value?.trim()) {
                    erroresFormulario.lastname = 'El apellido es requerido';
                } else if (value.length < 2) {
                    erroresFormulario.lastname = 'El apellido es muy corto';
                }
                break;
        }
        console.log('Errores formulario:', erroresFormulario);
    }

    async function handleSubmit() {
        try {
            isSubmitting = true;
            
            // Validar que los campos requeridos estén presentes
            if (!contact.name || !contact.telephon) {
                errorMessage = 'Nombre y teléfono son campos obligatorios';
                return;
            }

            // Crear una copia limpia del contacto con valores por defecto para campos vacíos
            const cleanContactData = {
                id: contact.id || '',
                createdAt: contact.createdAt || Date.now(),
                name: contact.name || '',
                lastname: contact.lastname || '',
                email: contact.email || '',
                telephon: contact.telephon || '',
                typeContact: contact.typeContact || '',
                selecMC: contact.selecMC || '',
                comContact: contact.comContact || '',
                contactStage: contact.contactStage || 0,
                isActive: contact.isActive !== undefined ? contact.isActive : true,
                properties: Array.isArray(contact.properties) ? contact.properties : [],
                budget: contact.budget || 0,
                selecTP: contact.selecTP || '',
                rangeProp: contact.rangeProp || '',
                numBaths: contact.numBaths || 0,
                numBeds: contact.numBeds || 0,
                numParks: contact.numParks || 0,
                halfBathroom: contact.halfBathroom || '',
                locaProperty: Array.isArray(contact.locaProperty) ? contact.locaProperty : [],
                tagsProperty: Array.isArray(contact.tagsProperty) ? contact.tagsProperty : [],
                typeContact: contact.typeContact || '',
            };

            // Asegurarse de que el contacto tenga un ID válido
            if (!cleanContactData.id || cleanContactData.id.trim() === '') {
                // Generar un ID único si no existe
                cleanContactData.id = generateUUID();
                console.log('Generando nuevo ID para el contacto:', cleanContactData.id);
            }

            // Validación final del ID
            if (!cleanContactData.id || cleanContactData.id.trim() === '') {
                console.error('Error crítico: Fallo al asignar ID al contacto', cleanContactData);
                throw new Error('Error crítico: Fallo al asignar ID al contacto');
            }

            // Añadir fecha de creación si no existe
            if (!cleanContactData.createdAt) {
                cleanContactData.createdAt = Date.now();
            }

            console.log('Guardando contacto con ID:', cleanContactData.id);
            
            // Guardar el contacto en Firebase
            let result;
            if (existingContact) {
                result = await contactsStore.update(cleanContactData);
            } else {
                result = await contactsStore.add(cleanContactData);
            }

            if (!result.success) {
                throw new Error(result.error || 'Error al guardar el contacto');
            }

            // Asegurarse de que el contacto tenga el ID correcto después de guardarlo
            if (!existingContact && result.id) {
                cleanContactData.id = result.id;
            }

            // Forzar una actualización manual del store para asegurar que el contacto aparezca en la lista
            if (!existingContact) {
                // Obtener la lista actual de contactos
                const currentContacts = get(contactsStore);
                
                // Verificar si el contacto ya existe en la lista
                const existingIndex = currentContacts.findIndex(c => c.id === cleanContactData.id);
                
                if (existingIndex >= 0) {
                  // Actualizar el contacto existente
                  currentContacts[existingIndex] = { ...cleanContactData };
                } else {
                  // Añadir el nuevo contacto a la lista
                  currentContacts.push({ ...cleanContactData });
                }
                
                // Actualizar el store con la nueva lista
                contactsStore.set([...currentContacts]);
                
                console.log('Contacto añadido/actualizado manualmente en el store:', cleanContactData);
            }

            // Sincronizar con Google Contacts (automáticamente sin confirmación)
            try {
                const accessToken = await getAccessToken();
                if (accessToken) {
                  await syncContact(cleanContactData, accessToken);
                  console.log('Contacto sincronizado con Google Contacts');
                }
            } catch (googleError) {
                console.error('Error al sincronizar con Google Contacts:', googleError);
                // Continuar a pesar del error con Google
            }

            // Emitir evento de éxito
            dispatch('success', { contact: cleanContactData });
            
            // Registrar el contacto guardado para depuración
            console.log('Contacto guardado exitosamente:', cleanContactData);
            
            // Verificar nuevamente que el ID sea válido antes de redirigir
            if (cleanContactData.id && cleanContactData.id.trim() !== '') {
                console.log('ID válido para redirección:', cleanContactData.id);
            } else {
                console.error('Error: ID inválido después de guardar', cleanContactData);
            }
            
        } catch (error) {
            console.error('Error en handleSubmit:', error);
            errorMessage = `Error: ${error.message || 'Desconocido'}`;
        } finally {
            isSubmitting = false;
        }
    }

    async function onCancel() {
        if (isDirty) {
            if (!confirm('¿Está seguro que desea cancelar? Se perderán los cambios no guardados.')) {
                return;
            }
        }
        $systStatus = "";
        dispatch('cancel');
    }

    // Agregar función para manejar clics fuera del componente
    function handleClickOutside(event: MouseEvent) {
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer && !searchContainer.contains(event.target as Node)) {
            showProp = false;
        }
    }

    // Agregar y remover el event listener cuando el componente se monta/desmonta
    onMount(() => {
        document.addEventListener('click', handleClickOutside);
    });

    onDestroy(() => {
        document.removeEventListener('click', handleClickOutside);
    });

    // Modificar la función searProp
    function searProp(searchTerm: string) {
        if (searchTerm.length !== 0) {
            showProp = true;
            propToRender = $propertiesStore.filter((property) => {
                const searchInfo = `${property.location} ${property.title} ${property.public_id}`.toLowerCase();
                return searchInfo.includes(searchTerm.toLowerCase());
            });
        } else {
            showProp = false;
            propToRender = [];
        }
    }

    // Agregar esta función
    const autofocus = (node: HTMLElement) => {
        node.focus();
    };
</script>

<div class="cont__alta">
    <h1 class="title">Alta de Contacto</h1>
    <form on:submit|preventDefault={handleSubmit} id="altaContactos" class="form-container">      
        {#if erroresFormulario.general}
            <div class="error-message">
                {erroresFormulario.general}
            </div>
        {/if}

        <div class="features">
            <div class="inp__lat">  
                <div class="input-group">
                    <InputText
                        identifier="name"
                        name="Nombre *" 
                        bind:value={contact.name}
                        on:input={() => handleBlur('name')}
                    />
                    {#if camposModificados.name && erroresFormulario.name}
                        <span class="field-error">{erroresFormulario.name}</span>
                    {/if}
                </div>
                
                <div class="input-group">
                    <InputText 
                        identifier="lastname" 
                        name="Apellido" 
                        bind:value={contact.lastname}
                        on:blur={() => handleBlur('lastname')}
                    />
                    {#if camposModificados.lastname && erroresFormulario.lastname}
                        <span class="field-error">{erroresFormulario.lastname}</span>
                    {/if}
                </div>
            </div>
            
            <div class="inp__lat">          
                <div class="input-group">
                    <InputText 
                        identifier="telephon" 
                        name="Teléfono *" 
                        bind:value={contact.telephon}
                        on:blur={() => handleBlur('telephon')}
                    />
                    {#if camposModificados.telephon && erroresFormulario.telephon}
                        <span class="field-error">{erroresFormulario.telephon}</span>
                    {/if}
                </div>

                <div class="input-group">
                    <InputEmail 
                        identifier="email" 
                        name="Email" 
                        bind:value={contact.email}
                        on:blur={() => handleBlur('email')}
                    />
                    {#if camposModificados.email && erroresFormulario.email}
                        <span class="field-error">{erroresFormulario.email}</span>
                    {/if}
                </div>
            </div>

            <div class="inp__lat">
                <InputOptions 
                    identificador="typeContact" 
                    name="Tipo de Contacto" 
                    choices={typeContacts} 
                    value={contact.typeContact}
                    on:change={(e) => contact.typeContact = e.detail}
                />
                <InputOptions 
                    identificador="selecMC" 
                    name="Modo de Contacto" 
                    choices={modeContact} 
                    value={contact.selecMC}
                    on:change={(e) => contact.selecMC = e.detail}
                />
            </div>

            <div class="inp__lat">
                <textarea
                    class="notes"
                    placeholder="Notas adicionales..."
                    bind:value={contact.notes}
                ></textarea>
            </div>

            <!-- Agregar el componente de búsqueda aquí -->
            <div class="search-container">
                <Search
                    placeHolder="Buscar propiedad..."
                    bind:searchTerm={searchTerm}
                    on:input={() => searProp(searchTerm)}
                />
                
                {#if showProp && propToRender.length > 0}
                    <div class="search-results">
                        {#each propToRender as property}
                            <div class="property-item">
                                <input 
                                    type="radio" 
                                    name="selectedProperty"
                                    value={property.public_id}
                                    class="property-selector"
                                    on:change={() => {
                                        contact.propCont = property.public_id;
                                        contact.selecTP = property.property_type || '';
                                        contact.rangeProp = property.operations?.[0]?.amount 
                                            ? ranPrice(property.operations[0].amount)
                                            : '';
                                        propToRender = [];
                                        showProp = false;
                                        searchTerm = "";
                                    }}
                                />
                                <div class="card-wrapper">
                                    <CardProperty {property} />
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else if showProp && searchTerm}
                    <div class="no-results">
                        No se encontraron propiedades
                    </div>
                {/if}
            </div>

            <!-- Botón para mostrar campos adicionales -->
            <div class="form-actions">
                <Button 
                    element="button"
                    type="button"
                    variant="solid"
                    style="background-color: #6b21a8; border-color: #6b21a8;"
                    on:click={() => showAdditionalFields = !showAdditionalFields}
                >
                    {showAdditionalFields ? 'Ocultar campos adicionales' : 'Mostrar campos adicionales'}
                </Button>
            </div>

            {#if showAdditionalFields}
                <div class="additional-fields">
                    <div class="inp__lat">
                        <InputOptions 
                            identificador="selecTP" 
                            name="Tipo de Propiedad" 
                            choices={typeProperties} 
                            value={contact.selecTP}
                            on:change={(e) => contact.selecTP = e.detail}
                        />
                        <InputOptions 
                            identificador="modePay" 
                            name="Modo de Pago" 
                            choices={modePays} 
                            value={contact.modePay}
                            on:change={(e) => contact.modePay = e.detail}
                        />
                    </div>

                    <div class="inp__lat">
                        <InputText 
                            identifier="budget" 
                            name="Presupuesto" 
                            value={String(contact.budget || '')}
                        />
                        <InputOptions 
                            identificador="rangeProp" 
                            name="Rango de Propiedad" 
                            choices={range} 
                            value={String(contact.rangeProp)}
                            on:change={(e) => contact.rangeProp = e.detail}
                        />
                    </div>

                    <div class="inp__lat">
                        <InputOptions 
                            identificador="numBeds" 
                            name="Recámaras" 
                            choices={oneToFive} 
                            value={String(contact.numBeds)}
                            on:change={(e) => contact.numBeds = e.detail}
                        />
                        <InputOptions 
                            identificador="numBaths" 
                            name="Baños Completos" 
                            choices={oneToFour} 
                            value={String(contact.numBaths)}
                            on:change={(e) => contact.numBaths = e.detail}
                        />
                    </div>

      
                    <div class="inp__lat">
                        <InputOptions 
                            identificador="halfBathroom" 
                            name="Medios Baños" 
                            choices={oneToThree} 
                            value={String(contact.halfBathroom)}
                            on:change={(e) => contact.halfBathroom = e.detail}
                        />
                        <InputOptions 
                            identificador="numParks" 
                            name="Estacionamientos" 
                            choices={oneToFour} 
                            value={String(contact.numParks)}
                            on:change={(e) => contact.numParks = e.detail}
                        />
                    </div>

                    <div class="inp__lat">
                        <Tags bind:propTags={contact.tagsProperty} />
                        <Ubication bind:ubication={contact.locaProperty} />
                    </div>
                </div>
            {/if}
            
            <div class="form-actions">
                <Button
                    element="button"
                    type="submit"
                    variant="solid"
                    disabled={isSubmitting || Object.values(erroresFormulario).some(error => error)}
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button
                    element="button"
                    type="button"
                    variant="danger"
                    on:click={onCancel}
                >
                    Cancelar
                </Button>
            </div>
        </div>
    </form>
</div>

<style>
    .form-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        font-family: 'Poppins', sans-serif;
    }

    .title {
        text-align: center;
        color: #6b21a8;
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #6b21a8;
        font-family: 'Poppins', sans-serif;
    }

    .input-group {
        position: relative;
        flex: 1;
    }

    .field-error {
        color: #ff3e3e;
        font-size: 0.8rem;
        margin-top: 4px;
        position: absolute;
        bottom: -20px;
    }

    .error-message {
        background-color: #fff1f1;
        border: 1px solid #ff3e3e;
        color: #ff3e3e;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 20px;
    }

    .form-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
    }

    .features {
        display: flex;
        flex-direction: column;
        gap: 30px;
    }

    .inp__lat {
        display: flex;
        gap: 20px;
        position: relative;
    }

    .notes {
        width: 100%;
        min-height: 100px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
    }

    .additional-fields {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
        border: 2px solid #6b21a8;
        border-radius: 10px;
        background-color: rgba(107, 33, 168, 0.05);
        margin: 10px 0;
    }

    @media (max-width: 600px) {
        .inp__lat {
            flex-direction: column;
        }

        .additional-fields {
            padding: 15px;
        }
    }

    .search-container {
        position: relative;
        width: 100%;
    }

    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 300px;
        overflow-y: auto;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
    }

    .no-results {
        padding: 1rem;
        text-align: center;
        color: #666;
        background: #f5f5f5;
        border-radius: 4px;
    }

    .property-item {
        position: relative;
        padding: 5px;
    }

    .card-wrapper {
        position: relative;
        width: 100%;
    }

    .property-selector {
        position: absolute;
        top: 15px;
        left: 15px;
        z-index: 1001;
        margin: 0;
        cursor: pointer;
        width: 20px;
        height: 20px;
        accent-color: #6b21a8;
    }
</style>