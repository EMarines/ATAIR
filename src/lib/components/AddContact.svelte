<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { systStatus, propertiesStore, property as propertyStore, contactsStore } from '$lib/stores/dataStore';
    import { Search, Tags, Ubication, InputText, InputOptions, InputEmail, InputNumber, CardProperty, Button } from '$components';
    import { typeContacts, modeContact, typeProperties, modePays, oneToFive, oneToFour, oneToThree, contStage, range } from '$lib/parameters';
    import type { Property, Contact, AddContactEvents } from '$lib/types';
    import { ranPrice } from '$lib/functions/rangeValue';
    import { convertOperationEbFb } from '$lib/functions/converterEb-Fb';
    import { onMount, onDestroy } from 'svelte';
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
    let showFooter = true; // Variable para controlar la visibilidad del footer
    let selectedProperties: string[] = [];
  
    // Estado unificado del formulario
    export let existingContact: Contact | null = null;
    
    let contact: Contact = existingContact 
        ? { ...existingContact } 
        : {
        budget: 0, // Valor numérico por defecto
        comContact: '',
        contactStage: 'Etapa 1',
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
        propCont: '',
        rangeProp: '',
        selecMC: '',
        selecTP: '',
        tagsProperty: [],
        telephon: '',
        typeContact: '',
    };
  
    // Variable string para el input de presupuesto, inicializada desde el contact.budget actual (que ya considera existingContact)
    let budgetStringForInput: string = String(contact.budget);

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
                if (!value || !value.trim()) {
                    erroresFormulario.name = 'El nombre es requerido';
                } else if (value.length < 2) {
                    erroresFormulario.name = 'El nombre es muy corto';
                }
                break;
            case 'telephon':
                if (!value || !value.trim()) {
                    erroresFormulario.telephon = 'El teléfono es requerido';
                } else if (!PHONE_REGEX.test(value)) {
                    erroresFormulario.telephon = 'Formato de teléfono inválido';
                }
                break;
            case 'email':
                if (!value || !value.trim()) {
                    erroresFormulario.email = 'El email es requerido';
                } else if (!EMAIL_REGEX.test(value)) {
                    erroresFormulario.email = 'Email inválido';
                }
                break;
            case 'lastname':
                if (!value || !value.trim()) {
                    erroresFormulario.lastname = 'El apellido es requerido';
                } else if (value.length < 2) {
                    erroresFormulario.lastname = 'El apellido es muy corto';
                }
                break;
        }
        console.log('Errores formulario:', erroresFormulario);
    }
  
    async function handleSubmit() {
        console.log("[AddContact] handleSubmit: budgetStringForInput (valor del input) AL INICIO:", budgetStringForInput, "Tipo:", typeof budgetStringForInput);
        // El contact.budget original no se modifica directamente por el input bindeado a budgetStringForInput
        // console.log($propertyStore, contact, "handleSubmit");
        try {
            isSubmitting = true;
           
            // Validar que los campos requeridos estén presentes
            if (!contact.name || !contact.telephon) {
                errorMessage = 'Nombre y teléfono son campos obligatorios';
                return;
            }
  
            // Parsear budgetStringForInput a número para guardar
            let parsedBudgetNumber: number = 0;
            if (budgetStringForInput !== null && budgetStringForInput !== undefined && String(budgetStringForInput).trim() !== '') {
                let numericStringToParse = String(budgetStringForInput).trim();
                const lastComma = numericStringToParse.lastIndexOf(',');
                const lastDot = numericStringToParse.lastIndexOf('.');

                if (lastComma !== -1 && (lastDot === -1 || lastDot < lastComma)) { // Coma es decimal
                    numericStringToParse = numericStringToParse.replace(/\./g, '').replace(',', '.');
                } else { // Punto es decimal o no hay decimal, comas son miles
                    numericStringToParse = numericStringToParse.replace(/,/g, '');
                }
                // Eliminar cualquier caracter que no sea dígito o el primer punto decimal
                numericStringToParse = numericStringToParse.replace(/[^\d.]/g, (match, offset, fullString) => {
                    return (match === '.' && fullString.indexOf('.') === offset) ? '.' : '';
                });

                const tempParsedValue = parseFloat(numericStringToParse);
                parsedBudgetNumber = isNaN(tempParsedValue) ? 0 : tempParsedValue;
            }
            console.log(`[AddContact] handleSubmit: budgetStringForInput ('${budgetStringForInput}') parseado a parsedBudgetNumber:`, parsedBudgetNumber);


            // Crear una copia limpia del contacto con valores por defecto para campos vacíos
            const cleanContactData: Contact = {
                id: contact.id || '',
                createdAt: contact.createdAt || Date.now(),
                name: contact.name || '',
                lastname: contact.lastname || '',
                email: contact.email || '',
                telephon: contact.telephon || '',
                selecMC: contact.selecMC || 'Lona en Propiedad',
                comContact: contact.comContact || '',
                contactStage: contact.contactStage || 'Etapa 1',
                isActive: contact.isActive !== undefined ? contact.isActive : true,
                budget: parsedBudgetNumber, // Usar el valor parseado
                selecTP: contact.selecTP || '',
                rangeProp: contact.rangeProp || '',
                numBaths: contact.numBaths || 0,
                numBeds: contact.numBeds || 0,
                numParks: contact.numParks || 0,
                halfBathroom: contact.halfBathroom || '',
                locaProperty: Array.isArray(contact.locaProperty) ? contact.locaProperty : [],
                tagsProperty: Array.isArray(contact.tagsProperty) ? contact.tagsProperty : [],
                modePay: contact.modePay || '',
                typeContact: contact.typeContact || '',
                // Propiedades opcionales - usar cadenas vacías para campos de texto
                color: contact.color || '',
                contactType: contact.contactType || '',
                contMode: contact.contMode || '',
                notes: contact.notes || '',
                propCont: contact.propCont || '',
                // selecTO: contact.selecTO || '',
                // selecTO: convertOperationEbFb($propertyStore.selecTO) || '',

                sendedProperties: Array.isArray(contact.sendedProperties) ? contact.sendedProperties : [],
                title: contact.title || '',
                typeOperation: contact.typeOperation || '',
                typeProperty: contact.typeProperty || ''
            };
            // console.log(cleanContactData.typeContact)

            
            // Añadir propiedades opcionales de tipo number solo si tienen un valor
            if (contact.lastContact) {
                cleanContactData.lastContact = contact.lastContact;
            }
            
            if (contact.lastResponse) {
                cleanContactData.lastResponse = contact.lastResponse;
            }
  
            // Asegurarse de que el contacto tenga un ID válido
            if (!cleanContactData.id || cleanContactData.id.trim() === '') {
                // Generar un ID único si no existe
                cleanContactData.id = generateUUID();
                // console.log('Generando nuevo ID para el contacto:', cleanContactData.id);
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
  
            // console.log('Guardando contacto con ID:', cleanContactData.id);
            console.log('[AddContact] handleSubmit: cleanContactData (DATOS FINALES A GUARDAR):', cleanContactData);
            
            // Guardar el contacto en Firebase
            let result;
            if (existingContact) {
                result = await contactsStore.update(cleanContactData);
            } else {
                result = await contactsStore.add(cleanContactData);
            }
  
            if (!result.success) {
                const errorMessage = result.error ? 
                    (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)) 
                    : 'Error al guardar el contacto';
                throw new Error(errorMessage);
            }
  
            // Asegurarse de que el contacto tenga el ID correcto después de guardarlo
            if (!existingContact && result.success && 'id' in result && result.id) {
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
                
                // console.log('Contacto añadido/actualizado manualmente en el store:', cleanContactData);
            }
  
            // Emitir evento de éxito
            dispatch('success', { contact: cleanContactData });
            
            // Registrar el contacto guardado para depuración
            // console.log('Contacto guardado exitosamente:', cleanContactData);
            
            // Verificar nuevamente que el ID sea válido antes de redirigir
            if (cleanContactData.id && cleanContactData.id.trim() !== '') {
                // console.log('ID válido para redirección:', cleanContactData.id);
                
                // Establecer el estado del sistema para activar la sección de comentarios en la página de detalles
                $systStatus = "addContact";
                
                // Redirigir a la página de detalles del contacto
                goto(`/contact/${cleanContactData.id}`);
            } else {
                console.error('Error: ID inválido después de guardar', cleanContactData);
            }
            
        } catch (error) {
            console.error('Error en handleSubmit:', error);
            // Manejar el error de manera segura verificando su tipo
            let errorMsg = 'Desconocido';
            if (error instanceof Error) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            } else if (error && typeof error === 'object') {
                errorMsg = JSON.stringify(error);
            }
            errorMessage = `Error: ${errorMsg}`;
        } finally {
            isSubmitting = false;
            // $systStatus = '';
            // contact.propCont = '';
            // contact.selecTP = '';
            // contact.rangeProp = '';
        }
    }

    function handlePropertySelection(property: string) {
        if (selectedProperties.includes(property)) {
            // Si la propiedad ya está seleccionada, la eliminamos
            selectedProperties = selectedProperties.filter(p => p !== property);
        } else {
            // Si la propiedad no está seleccionada, la agregamos
            selectedProperties = [...selectedProperties, property];
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
  
    // // Agregar esta función
    // const autofocus = (node: HTMLElement) => {
    //     node.focus();
    // };
  
    // Función reactiva que no hace nada con el footer
    $: {
        if (showProp && propToRender.length > 0) {
            // No hacemos nada con el footer
        } else {
            // No hacemos nada con el footer
        }
    }
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
                        on:blur={() => handleBlur('name')} 
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
                                <div class="card-wrapper">
                                    <CardProperty 
                                        {property} 
                                        selectable={true}
                                        isSelected={contact.propCont === property.public_id}
                                        onSelect={() => {
                                            contact.propCont = property.public_id;
                                            contact.selecTP = property.property_type || '';
                                            contact.typeContact = convertOperationEbFb(property.selecTO) || '',
                                            contact.rangeProp = property.price 
                                                ? ranPrice(property.price)
                                                : '';                                            
                                            // Guardar la propiedad seleccionada en el store
                                            propertyStore.set(property);
                                            // Si se quisiera que el precio de la propiedad llene el presupuesto:
                                            // contact.budget = property.price || 0;
                                            // budgetStringForInput = String(contact.budget);
                                            propToRender = [];
                                            showProp = false;
                                            searchTerm = "";
                                        }}
                                    />
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
                            value={contact.selecTP ? String(contact.selecTP) : ''}
                            on:change={(e) => contact.selecTP = e.detail}
                        />
                    
                        <InputOptions 
                            identificador="modePay" 
                            name="Modo de Pago" 
                            choices={modePays} 
                            value={contact.modePay ? String(contact.modePay) : ''}
                            on:change={(e) => contact.modePay = e.detail}
                        />
                    
                        <InputOptions 
                            identificador="contactStage" 
                            name="Etapa" 
                            choices={contStage} 
                            value={contact.contactStage ? String(contact.contactStage) : ''}
                            on:change={(e) => contact.contactStage = e.detail}
                        />
                    </div>            
                    <div class="inp__lat">
                        <InputText 
                            identifier="budget"
                            name="Presupuesto"
                            bind:value={budgetStringForInput}
                        />
                        <InputOptions 
                            identificador="rangeProp" 
                            name="Rango de Propiedad" 
                            choices={range} 
                            value={contact.rangeProp ? String(contact.rangeProp) : ''}
                            on:change={(e) => contact.rangeProp = e.detail}
                        />
                    </div>
  
                    <div class="inp__lat">
                        <InputOptions 
                            identificador="numBeds" 
                            name="Recámaras" 
                            choices={oneToFive} 
                            value={contact.numBeds ? String(contact.numBeds) : ''}
                            on:change={(e) => contact.numBeds = e.detail}
                        />
                        <InputOptions 
                            identificador="numBaths" 
                            name="Baños Completos" 
                            choices={oneToFour} 
                            value={contact.numBaths ? String(contact.numBaths) : ''}
                            on:change={(e) => contact.numBaths = e.detail}
                        />
                        
                    </div>
  
      
                    <div class="inp__lat">
                        <InputOptions 
                            identificador="halfBathroom" 
                            name="Medios Baños" 
                            choices={oneToThree} 
                            value={contact.halfBathroom ? String(contact.halfBathroom) : ''}
                            on:change={(e) => contact.halfBathroom = e.detail}
                        />
                        <InputOptions 
                            identificador="numParks" 
                            name="Estacionamientos" 
                            choices={oneToFour} 
                            value={contact.numParks ? String(contact.numParks) : ''}
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
  
  {#if showFooter}
    <!-- Aquí va el contenido del footer -->
  {/if}
  
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
        flex-wrap: wrap;
        justify-content: space-between;
    }
  
    :global(.inp__lat > div) {
        flex: 1;
        min-width: 150px;
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
        box-sizing: border-box;
    }
  
    .notes {
        width: 100%;
        min-height: 100px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
    }
  
    .search-container {
        position: relative;
        width: 100%;
        z-index: 100;
    }
  
    .search-results {
        width: 100%;
        background: #1f1f1f;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0 0 4px 4px; /* Opcional: ajustar si se ve raro sin el input arriba */
        box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.5);
        z-index: 100;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        padding: 1rem;
        max-height: 850px; /* Limita la altura máxima en pantallas grandes */
        overflow-y: auto; /* Añade scroll vertical si es necesario */
        margin-top: 5px; /* Opcional: añade un pequeño espacio tras la barra de búsqueda */
    }
  
    .no-results {
        padding: 1rem;
        text-align: center;
        color: #ccc;
        background: #2a2a2a;
        border-radius: 4px;
        grid-column: 1 / -1;
    }
  
    .property-item {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        z-index: 100;
    }
  
    .property-item:hover {
        transform: translateY(-5px);
    }
  
    .card-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        z-index: 100;
    }
  
    /* .property-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px 0;
    }
  
    .property-table td {
        padding: 0;
        border: none;
        width: 33.33%;
        vertical-align: top;
    } */
  
    :global(.property-table .in__sel) {
        width: 100%;
        font-size: 0.8rem;
        padding-right: 15px;
    }
  
    :global(.property-table .label__title) {
        width: 100%;
        font-size: 0.85rem;
    }
  
    @media (max-width: 600px) {
        /* .property-table, .property-table tbody, .property-table tr {
            display: block;
            width: 100%;
        }
  
        .property-table td {
            display: block;
            width: 100%;
            margin-bottom: 10px;
        } */
  
        .inp__lat {
            flex-direction: column;
            gap: 15px;
        }
  
        /* Ajuste para pantallas angostas */
        .search-results {
            max-height: 80vh; /* Limitar altura en pantallas pequeñas usando viewport height */
        }
    }
  </style>
