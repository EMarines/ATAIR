<script lang="ts">
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
        contactType: '',
        email: '',
        id: '',
        lastname: '',
        mode: '',
        name: '',
        notes: '',
        property: '',
        propertyType: '',
        stage: '',
        telephon: '',
        timestamp: new Date(),
        zone: '',
        // Campos adicionales
        priceRange: '',
        sizeRange: '',
        roomsRange: '',
        bathroomsRange: '',
        parkingRange: '',
        amenities: [],
        paymentMethod: '',
        urgency: '',
        budget_min: 0,
        budget_max: 0,
        size_min: 0,
        size_max: 0,
        rooms_min: 0,
        rooms_max: 0,
        bathrooms_min: 0,
        bathrooms_max: 0,
        parking_min: 0,
        parking_max: 0,
        publicUrl: '', // Añadir campo para la URL pública
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
        
        // Convertir timestamp a Date si es string
        if (typeof cleanContact.timestamp === 'string') {
            cleanContact.timestamp = new Date(cleanContact.timestamp);
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

    async function onCancel() {
        if (isDirty) {
            if (!confirm('¿Está seguro que desea cancelar? Se perderán los cambios no guardados.')) {
                return;
            }
        }
        
        goto('/contacts');
    }

    function searProp(term: string) {
        if (term.length < 2) {
            propToRender = $propertiesStore;
            return;
        }
        
        const termLower = term.toLowerCase();
        propToRender = $propertiesStore.filter(prop => 
            prop.name.toLowerCase().includes(termLower) || 
            prop.address.toLowerCase().includes(termLower) ||
            prop.zone.toLowerCase().includes(termLower)
        );
    }

    function selectProperty(property: Property) {
        contact.property = property.id;
        contact.zone = property.zone;
        showProp = false;
    }

    function toggleAdditionalFields() {
        showAdditionalFields = !showAdditionalFields;
    }

    // Manejar cambios en los rangos
    function handleRangeChange(field: string, value: string) {
        switch (field) {
            case 'priceRange':
                contact.priceRange = value;
                [contact.budget_min, contact.budget_max] = ranPrice(value);
                break;
            case 'sizeRange':
                contact.sizeRange = value;
                [contact.size_min, contact.size_max] = ranPrice(value);
                break;
            case 'roomsRange':
                contact.roomsRange = value;
                [contact.rooms_min, contact.rooms_max] = ranPrice(value);
                break;
            case 'bathroomsRange':
                contact.bathroomsRange = value;
                [contact.bathrooms_min, contact.bathrooms_max] = ranPrice(value);
                break;
            case 'parkingRange':
                contact.parkingRange = value;
                [contact.parking_min, contact.parking_max] = ranPrice(value);
                break;
        }
        isDirty = true;
    }

    // Importar las funciones necesarias de Firestore
    import { db } from '$lib/firebase';
    import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
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
                        identifier="contactType"
                        label="Tipo de Contacto"
                        bind:value={contact.contactType}
                        options={typeContacts}
                        on:change={() => isDirty = true}
                    />
                </div>
                
                <div class="input-group">
                    <InputOptions
                        identifier="mode"
                        label="Modo"
                        bind:value={contact.mode}
                        options={modeContact}
                        on:change={() => isDirty = true}
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
                                        identifier="propertyType"
                                        label="Tipo de Propiedad"
                                        bind:value={contact.propertyType}
                                        options={typeProperties}
                                        on:change={(e) => {
                                            contact.propertyType = e.target.value;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identifier="stage"
                                        label="Etapa"
                                        bind:value={contact.stage}
                                        options={contStage}
                                        on:change={(e) => {
                                            contact.stage = e.target.value;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identifier="priceRange"
                                        label="Rango de Precio"
                                        bind:value={contact.priceRange}
                                        options={range}
                                        on:change={(e) => handleRangeChange('priceRange', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identifier="sizeRange"
                                        label="Rango de Tamaño"
                                        bind:value={contact.sizeRange}
                                        options={range}
                                        on:change={(e) => handleRangeChange('sizeRange', e.target.value)}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identifier="roomsRange"
                                        label="Rango de Habitaciones"
                                        bind:value={contact.roomsRange}
                                        options={oneToFive}
                                        on:change={(e) => handleRangeChange('roomsRange', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identifier="bathroomsRange"
                                        label="Rango de Baños"
                                        bind:value={contact.bathroomsRange}
                                        options={oneToFour}
                                        on:change={(e) => handleRangeChange('bathroomsRange', e.target.value)}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identifier="parkingRange"
                                        label="Rango de Estacionamientos"
                                        bind:value={contact.parkingRange}
                                        options={oneToThree}
                                        on:change={(e) => handleRangeChange('parkingRange', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <InputOptions
                                        identifier="paymentMethod"
                                        label="Método de Pago"
                                        bind:value={contact.paymentMethod}
                                        options={modePays}
                                        on:change={(e) => {
                                            contact.paymentMethod = e.target.value;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <InputOptions
                                        identifier="urgency"
                                        label="Urgencia"
                                        bind:value={contact.urgency}
                                        options={oneToFive}
                                        on:change={(e) => {
                                            contact.urgency = e.target.value;
                                            isDirty = true;
                                        }}
                                    />
                                </td>
                                <td>
                                    <Tags
                                        identifier="amenities"
                                        label="Amenidades"
                                        bind:tags={contact.amenities}
                                        on:change={() => isDirty = true}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="input-group full-width">
                        <label for="notes">Notas</label>
                        <textarea
                            id="notes"
                            class="notes"
                            bind:value={contact.notes}
                            placeholder="Notas adicionales sobre el contacto"
                            on:input={() => isDirty = true}
                        ></textarea>
                    </div>
                    
                    {#if contact.publicUrl}
                    <div class="input-group full-width">
                        <label for="publicUrl">Enlace para compartir por WhatsApp</label>
                        <textarea
                            id="publicUrl"
                            class="public-url"
                            readonly
                            bind:value={contact.publicUrl}
                            style="background-color: #f9f9f9; cursor: pointer;"
                            on:click={(e) => {
                                // @ts-ignore - Ignorar error de tipado para mantener la funcionalidad
                                e.target.select();
                                navigator.clipboard.writeText(contact.publicUrl);
                                alert('¡Enlace copiado al portapapeles!');
                            }}
                        ></textarea>
                        <small class="helper-text">Haz clic para copiar el enlace</small>
                    </div>
                    {/if}
                </div>
            {/if}
            
            <div class="form-actions">
                <Button
                    element="button"
                    type="button"
                    label="Cancelar"
                    variant="outline"
                    on:click={onCancel}
                    disabled={isSubmitting}
                />
                
                <Button
                    element="button"
                    type="submit"
                    label={existingContact ? "Actualizar" : "Guardar"}
                    variant="primary"
                    disabled={isSubmitting}
                />
            </div>
        </div>
    </form>
</div>

{#if showFooter}
    <!-- Aquí va el contenido del footer -->
{/if}

<style>
    .cont__alta {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .title {
        font-size: 24px;
        margin-bottom: 20px;
        color: #333;
    }
    
    .form-container {
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
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
    
    .full-width {
        grid-column: 1 / -1;
    }
    
    .search-container {
        position: relative;
        margin-bottom: 20px;
    }
    
    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-height: 400px;
        overflow-y: auto;
        z-index: 10;
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
        cursor: pointer;
        padding: 10px;
        border-radius: 6px;
        transition: background-color 0.2s;
    }
    
    .property-item:hover {
        background-color: #f5f5f5;
    }
    
    .additional-fields-toggle {
        margin: 10px 0;
    }
    
    .additional-fields-toggle button {
        background-color: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
    }
    
    .additional-fields-toggle button:hover {
        background-color: #e0e0e0;
    }
    
    .additional-fields {
        margin-top: 20px;
        padding: 15px;
        background-color: #f9f9f9;
        border-radius: 6px;
        border: 1px solid #eee;
    }
    
    .property-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px;
    }
    
    .property-table td {
        vertical-align: top;
        width: 50%;
    }
    
    .notes {
        width: 100%;
        min-height: 100px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        resize: vertical;
        font-family: inherit;
    }
    
    .public-url {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f9f9f9;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 0.9rem;
        min-height: 60px;
        margin-bottom: 5px;
    }
    
    .helper-text {
        color: #666;
        font-size: 0.8rem;
        margin-top: 2px;
    }
    
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
    }
    
    .error-message {
        background-color: #ffebee;
        color: #c62828;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        border-left: 4px solid #c62828;
    }
</style>