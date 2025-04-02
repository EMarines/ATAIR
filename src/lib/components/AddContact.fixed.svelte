<!-- <script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { systStatus, propertiesStore, property as propertyStore, contactsStore } from '$lib/stores/dataStore';
    import { Search, Tags, Ubication, InputText, InputOptions, InputEmail, InputDate, CardProperty, Button } from '$components';
    import { typeContacts, modeContact, typeProperties, modePays, oneToFive, oneToFour, oneToThree, contStage, range } from '$lib/parameters';
    import type { Property, Contact, AddContactEvents } from '$lib/types';
    import { ranPrice } from '$lib/functions/rangeValue';
    import { onMount, onDestroy } from 'svelte';
    // Importar las funciones necesarias para notificaciones
    import { notifications } from '$lib/stores/notificationStore';
    import { get } from 'svelte/store';
    // Importar Firebase
    import { db } from '$lib/firebase';
    import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

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

    // Estado unificado del formulario
    export let existingContact: Contact | null = null;
    
    let contact: Contact = existingContact ? { ...existingContact } : {
        budget: 0,
        comContact: '',
        contactType: 'prospecto',
        typeContact: 'prospecto',
        contactStage: '',
        contMode: '',
        createdAt: Date.now(),
        email: '',
        halfBathroom: 0,
        id: '',
        isActive: true,
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
        // Campos adicionales para compatibilidad con el formulario
        publicUrl: '',
        selecTO: ''
    };

    // Función para generar un ID único
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // Asignar un ID único si no existe
    if (!contact.id) {
        contact.id = generateUniqueId();
    }

    // Función para limpiar el objeto de contacto para Firebase
    function cleanContactForFirebase(contactData: Contact) {
        // Crear una copia para no modificar el original
        const cleanContact = { ...contactData };
        
        // Asegurarse de que el ID esté presente
        if (!cleanContact.id) {
            cleanContact.id = generateUniqueId();
        }
        
        // Asegurarse de que createdAt sea un número (timestamp)
        if (!cleanContact.createdAt) {
            cleanContact.createdAt = Date.now();
        }
        
        return cleanContact;
    }

    // Función para validar un campo específico
    function validarCampo(campo: keyof CamposValidados) {
        // Marcar el campo como modificado
        camposModificados[campo] = true;
        isDirty = true;
        
        switch (campo) {
            case 'name':
                erroresFormulario.name = !contact.name ? 'El nombre es obligatorio' : '';
                break;
            case 'lastname':
                // Lastname no es obligatorio, pero podemos validar formato si se desea
                break;
            case 'email':
                if (contact.email && !EMAIL_REGEX.test(contact.email)) {
                    erroresFormulario.email = 'Formato de email inválido';
                } else {
                    erroresFormulario.email = '';
                }
                break;
            case 'telephon':
                if (contact.telephon && !PHONE_REGEX.test(contact.telephon)) {
                    erroresFormulario.telephon = 'Formato de teléfono inválido';
                } else {
                    erroresFormulario.telephon = '';
                }
                break;
        }
    }

    async function handleSubmit() {
        try {
            isSubmitting = true;
            
            // Validar que los campos requeridos estén presentes
            if (!contact.name) {
                erroresFormulario.name = 'El nombre es obligatorio';
                isSubmitting = false;
                return;
            }
            
            // Validar email si está presente
            if (contact.email && !EMAIL_REGEX.test(contact.email)) {
                erroresFormulario.email = 'Formato de email inválido';
                isSubmitting = false;
                return;
            }
            
            // Validar teléfono si está presente
            if (contact.telephon && !PHONE_REGEX.test(contact.telephon)) {
                erroresFormulario.telephon = 'Formato de teléfono inválido';
                isSubmitting = false;
                return;
            }

            // Limpiar el contacto para Firebase
            const cleanContactData = cleanContactForFirebase(contact);
            
            // Verificar si es una actualización o creación
            if (existingContact) {
                // Es una actualización
                const contactRef = doc(db, 'contacts', cleanContactData.id);
                await updateDoc(contactRef, cleanContactData);
                
                // Actualizar el store
                const updatedContacts = get(contactsStore).map(c => 
                    c.id === cleanContactData.id ? cleanContactData : c
                );
                contactsStore.set(updatedContacts);
                
                notifications.add({
                    type: 'success',
                    message: 'Contacto actualizado correctamente',
                    duration: 3000
                });
            } else {
                // Es una creación
                // Obtener la lista actual de contactos
                const currentContacts = get(contactsStore);
                
                // Verificar si el contacto ya existe en la lista
                const contactExists = currentContacts.some(c => 
                    (c.email && c.email === cleanContactData.email) || 
                    (c.telephon && c.telephon === cleanContactData.telephon)
                );
                
                if (contactExists) {
                    erroresFormulario.general = 'Ya existe un contacto con este email o teléfono';
                    isSubmitting = false;
                    return;
                }
                
                // Agregar a Firestore
                const contactsCollection = collection(db, 'contacts');
                await addDoc(contactsCollection, cleanContactData);
                
                // Actualizar el store
                contactsStore.update(contacts => [...contacts, cleanContactData]);
                
                notifications.add({
                    type: 'success',
                    message: 'Contacto creado correctamente',
                    duration: 3000
                });
                
                // Notificar que la sincronización con Google Contacts se realizará automáticamente
                notifications.add({
                    type: 'info',
                    message: 'El contacto se sincronizará automáticamente con Google Contacts',
                    duration: 3000
                });
            }

            // Emitir evento de éxito
            dispatch('success', {
                contact: cleanContactData,
                isNew: !existingContact
            });
            
            // Redirigir a la lista de contactos
            goto('/contacts');
        } catch (error) {
            console.error('Error en handleSubmit:', error);
            // Manejar el error de manera segura verificando su tipo
            let errorMsg = 'Desconocido';
            if (error instanceof Error) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            }
            
            erroresFormulario.general = `Error al guardar el contacto: ${errorMsg}`;
            notifications.add({
                type: 'error',
                message: `Error al guardar el contacto: ${errorMsg}`,
                duration: 5000
            });
        } finally {
            isSubmitting = false;
        }
    }

    function toggleAdditionalFields() {
        showAdditionalFields = !showAdditionalFields;
    }

    // Manejar cambios en los rangos
    function handleRangeChange(field: string, value: string) {
        switch (field) {
            case 'priceRange':
                contact.rangeProp = value;
                // Convertir el rango a un valor numérico para budget
                const [min, max] = ranPrice(value);
                contact.budget = min; // Usamos el valor mínimo como presupuesto principal
                break;
            case 'sizeRange':
                contact.rangeProp = value;
                break;
            case 'roomsRange':
                contact.numBeds = value;
                break;
            case 'bathroomsRange':
                contact.numBaths = value;
                break;
            case 'parkingRange':
                contact.numParks = value;
                break;
        }
        isDirty = true;
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
                        label="Nombre"
                        placeholder="Nombre del contacto"
                        bind:value={contact.name}
                        on:blur={() => validarCampo('name')}
                        error={camposModificados.name ? erroresFormulario.name : ''}
                        required
                    />
                </div>
                
                <div class="input-group">
                    <InputText
                        identifier="lastname"
                        label="Apellido"
                        placeholder="Apellido del contacto"
                        bind:value={contact.lastname}
                        on:blur={() => validarCampo('lastname')}
                        error={camposModificados.lastname ? erroresFormulario.lastname : ''}
                    />
                </div>
                
                <div class="input-group">
                    <InputEmail
                        identifier="email"
                        label="Email"
                        placeholder="Email del contacto"
                        bind:value={contact.email}
                        on:blur={() => validarCampo('email')}
                        error={camposModificados.email ? erroresFormulario.email : ''}
                    />
                </div>
                
                <div class="input-group">
                    <InputText
                        identifier="telephon"
                        label="Teléfono"
                        placeholder="Teléfono del contacto"
                        bind:value={contact.telephon}
                        on:blur={() => validarCampo('telephon')}
                        error={camposModificados.telephon ? erroresFormulario.telephon : ''}
                    />
                </div>
                
                <div class="input-group">
                    <InputOptions
                        identificador="contactType"
                        name="Tipo de Contacto"
                        bind:value={contact.typeContact}
                        choices={typeContacts}
                        on:change={e => {
                            contact.typeContact = e.detail;
                            isDirty = true;
                        }}
                    />
                </div>
                
                <div class="input-group">
                    <InputOptions
                        identificador="mode"
                        name="Modo"
                        bind:value={contact.contMode}
                        choices={modeContact}
                        on:change={e => {
                            contact.contMode = e.detail;
                            isDirty = true;
                        }}
                    />
                </div>
            </div>
            
            <div class="search-container">
                <Search
                    placeHolder="Buscar propiedad..."
                    bind:searchTerm={searchTerm}
                    on:input={() => searProp(searchTerm)}
                    on:focus={() => showProp = true}
                />
                
                {#if showProp}
                    <div class="search-results">
                        {#if propToRender.length === 0}
                            <div class="no-results">No se encontraron propiedades</div>
                        {:else}
                            <div class="results-list">
                                {#each propToRender as property}
                                    <div class="property-item" on:click={() => selectProperty(property)}>
                                        <CardProperty property={property} />
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
            
            <div class="additional-fields-toggle">
                <button type="button" on:click={toggleAdditionalFields}>
                    {showAdditionalFields ? 'Ocultar campos adicionales' : 'Mostrar campos adicionales'}
                </button>
            </div>
            
            {#if showAdditionalFields}
                <div class="additional-fields">
                    <table class="property-table">
                        <tbody>
                            <tr>
                                <td>
                                    <InputOptions
                                        identificador="propertyType"
                                        name="Tipo de Propiedad"
                                        bind:value={contact.selecTP}
                                        choices={typeProperties}
                                        on:change={e => {
                                            contact.selecTP = e.detail;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identificador="stage"
                                        name="Etapa"
                                        bind:value={contact.contactStage}
                                        choices={contStage}
                                        on:change={e => {
                                            contact.contactStage = e.detail;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identificador="priceRange"
                                        name="Rango de Precio"
                                        bind:value={contact.rangeProp}
                                        choices={range}
                                        on:change={e => handleRangeChange('priceRange', e.detail)}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identificador="sizeRange"
                                        name="Rango de Tamaño"
                                        bind:value={contact.rangeProp}
                                        choices={range}
                                        on:change={e => handleRangeChange('sizeRange', e.detail)}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identificador="roomsRange"
                                        name="Rango de Habitaciones"
                                        bind:value={contact.numBeds}
                                        choices={oneToFive}
                                        on:change={e => handleRangeChange('roomsRange', e.detail)}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identificador="bathroomsRange"
                                        name="Rango de Baños"
                                        bind:value={contact.numBaths}
                                        choices={oneToFour}
                                        on:change={e => handleRangeChange('bathroomsRange', e.detail)}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identificador="parkingRange"
                                        name="Rango de Estacionamientos"
                                        bind:value={contact.numParks}
                                        choices={oneToThree}
                                        on:change={e => handleRangeChange('parkingRange', e.detail)}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identificador="paymentMethod"
                                        name="Método de Pago"
                                        bind:value={contact.modePay}
                                        choices={modePays}
                                        on:change={e => {
                                            contact.modePay = e.detail;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identificador="urgency"
                                        name="Urgencia"
                                        bind:value={contact.selecMC}
                                        choices={oneToFive}
                                        on:change={e => {
                                            contact.selecMC = e.detail;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                                <td>
                                    <Tags
                                        identifier="amenities"
                                        label="Amenidades"
                                        bind:value={contact.tagsProperty}
                                        on:change={() => isDirty = true}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            {/if}
            
            <div class="notes-container">
                <label for="notes">Notas:</label>
                <textarea
                    id="notes"
                    bind:value={contact.notes}
                    on:input={() => isDirty = true}
                    placeholder="Notas adicionales sobre el contacto"
                    rows="4"
                ></textarea>
            </div>
            
            {#if showFooter}
                <div class="form-footer">
                    <Button
                        type="submit"
                        text={existingContact ? 'Actualizar Contacto' : 'Crear Contacto'}
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    />
                    <Button
                        type="button"
                        text="Cancelar"
                        variant="secondary"
                        on:click={() => goto('/contacts')}
                        disabled={isSubmitting}
                    />
                </div>
            {/if}
        </div>
    </form>
</div>

<style>
    .cont__alta {
        width: 100%;
        padding: 20px;
    }
    
    .title {
        font-size: 24px;
        margin-bottom: 20px;
        color: var(--color-primary);
    }
    
    .form-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    
    .features {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    
    .inp__lat {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 15px;
    }
    
    .input-group {
        margin-bottom: 10px;
    }
    
    .error-message {
        background-color: #ffebee;
        color: #c62828;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
    }
    
    .search-container {
        position: relative;
        margin-top: 20px;
    }
    
    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        max-height: 300px;
        overflow-y: auto;
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        z-index: 10;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .no-results {
        padding: 15px;
        text-align: center;
        color: #666;
    }
    
    .results-list {
        padding: 10px;
    }
    
    .property-item {
        padding: 10px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
    }
    
    .property-item:hover {
        background-color: #f5f5f5;
    }
    
    .additional-fields-toggle {
        margin: 20px 0;
    }
    
    .additional-fields-toggle button {
        background-color: var(--color-secondary);
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .additional-fields {
        margin-top: 20px;
    }
    
    .property-table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .property-table td {
        padding: 8px;
        vertical-align: top;
    }
    
    .notes-container {
        margin-top: 20px;
    }
    
    .notes-container label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    .notes-container textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        resize: vertical;
    }
    
    .form-footer {
        display: flex;
        gap: 10px;
        margin-top: 20px;
        justify-content: flex-end;
    }
</style> -->
