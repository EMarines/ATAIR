<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { AddContactEvents } from '$lib/types';
    import { goto } from '$app/navigation';
    import { collection, addDoc, deleteDoc, getDoc, getDocs, doc, updateDoc} from 'firebase/firestore';
    import { db } from '$lib/firebase';
    import { systStatus, propertiesStore, property, contactsStore } from '$lib/stores/dataStore';
    import { Search, Tags, Ubication, InputText, InputOptions, InputEmail, InputDate, CardProperty, Button } from '$components';
    import { mosRange, infoToBinnacle, cleanNumber, cleanName, convertOperationEbFb } from '$functions'
    import { typeContacts, modeContact, typeProperties, modePays, oneToFive, oneToFour, oneToThree, contStage, range } from '$lib/parameters';
    import type { Property, Contact } from '$lib/types';

    const dispatch = createEventDispatcher<AddContactEvents>();

    // Validaciones
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PHONE_REGEX = /^\+?[\d\s-]{10,}$/;

    interface FormErrors {
        name?: string;
        lastname?: string;
        email?: string;
        telephon?: string;
        general?: string;
    }

    let formErrors: FormErrors = {};
    let touchedFields = {
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
    let showAdditionalFields = false; // Variable para controlar campos adicionales

    // Estado unificado del formulario
    export let existingContact: Contact | null = null;
    
    let contact: Contact = existingContact ? { ...existingContact } : {
        id: '',
        name: '',
        lastname: '',
        email: '',
        telephon: '',
        createdAt: Date.now(),
        contactStage: '',
        typeContact: '',
        selecMC: '',
        numBeds: 0,
        numBaths: 0,
        numParks: 0,
        halfBathroom: 0,
        budget: 0,
        tagsProperty: [],
        locaProperty: [],
        selecTP: '',
        comContact: '',
        modePay: '',
        rangeProp: ''
    };

    function handleBlur(field: string) {
        touchedFields[field] = true;
        validateField(field, contact[field]);
    }

    function validateField(field: string, value: string) {
        // Solo validar si el campo ha sido tocado o si el formulario está siendo enviado
        if (!touchedFields[field] && !isDirty) {
            return;
        }

        formErrors[field] = '';

        switch(field) {
            case 'name':
            case 'lastname':
                if (!value?.trim()) {
                    formErrors[field] = `El ${field === 'name' ? 'nombre' : 'apellido'} es requerido`;
                } else if (value.length < 2) {
                    formErrors[field] = `El ${field === 'name' ? 'nombre' : 'apellido'} es muy corto`;
                }
                break;
            case 'email':
                if (!value?.trim()) {
                    formErrors.email = 'El email es requerido';
                } else if (!EMAIL_REGEX.test(value)) {
                    formErrors.email = 'Email inválido';
                }
                break;
            case 'telephon':
                if (!value?.trim()) {
                    formErrors.telephon = 'El teléfono es requerido';
                } else if (!PHONE_REGEX.test(value)) {
                    formErrors.telephon = 'Formato de teléfono inválido';
                }
                break;
        }
    }

    async function handleSubmit() {
        try {
            isSubmitting = true;
            formErrors.general = null;

            // Validar todos los campos
            validateField('name', contact.name);
            validateField('lastname', contact.lastname);
            validateField('email', contact.email);
            validateField('telephon', contact.telephon);

            // Verificar si hay errores
            if (Object.values(formErrors).some(error => error)) {
                throw new Error('Por favor corrija los errores en el formulario');
            }

            // Preparar el contacto para guardar
            const contactToSave = {
                ...contact,
                createdAt: contact.createdAt || Date.now()
            };

            let result;
            if (existingContact) {
                // Si es una edición, actualizar el contacto existente
                result = await contactsStore.update(contactToSave);
            } else {
                // Si es nuevo contacto, agregar
                delete contactToSave.id;
                result = await contactsStore.add(contactToSave);
            }
            
            if (!result.success) {
                throw new Error(result.error || 'Error al guardar el contacto');
            }

            // Notificar éxito y redirigir
            dispatch('success', { contact: contactToSave });
            
            if (result.id) {
                goto(`/contact/${result.id}`);
            } else {
                throw new Error('No se recibió el ID del contacto');
            }

        } catch (err) {
            formErrors.general = err.message;
            dispatch('error', { error: err });
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

    function searProp(searchTerm: string) {
        if (searchTerm.length !== 0) {
            showProp = true;
            propToRender = $propertiesStore.filter((property) => {
                const searchInfo = `${property.location.name} ${property.title} ${property.public_id}`.toLowerCase();
                return searchInfo.includes(searchTerm.toLowerCase());
            });
        } else {
            showProp = false;
        }
    }
</script>

<div class="cont__alta">
    <h1 class="title">Alta de Contacto</h1>
    <form on:submit|preventDefault={handleSubmit} id="altaContactos" class="form-container">      
        {#if formErrors.general}
            <div class="error-message">
                {formErrors.general}
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
                        error={formErrors.name}
                    />
                    {#if touchedFields.name && formErrors.name}
                        <span class="field-error">{formErrors.name}</span>
                    {/if}
                </div>
                
                <div class="input-group">
                    <InputText 
                        identifier="lastname" 
                        name="Apellido *" 
                        bind:value={contact.lastname}
                        on:blur={() => handleBlur('lastname')}
                        error={formErrors.lastname}
                    />
                    {#if touchedFields.lastname && formErrors.lastname}
                        <span class="field-error">{formErrors.lastname}</span>
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
                        error={formErrors.telephon}
                        placeholder="+52 1234567890"
                    />
                    {#if touchedFields.telephon && formErrors.telephon}
                        <span class="field-error">{formErrors.telephon}</span>
                    {/if}
                </div>

                <div class="input-group">
                    <InputEmail 
                        identifier="email" 
                        name="Email *" 
                        bind:value={contact.email}
                        on:blur={() => handleBlur('email')}
                        error={formErrors.email}
                    />
                    {#if touchedFields.email && formErrors.email}
                        <span class="field-error">{formErrors.email}</span>
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
                            type="number"
                            bind:value={contact.budget}
                        />
                        <InputOptions 
                            identificador="rangeProp" 
                            name="Rango de Propiedad" 
                            choices={range} 
                            value={contact.rangeProp}
                            on:change={(e) => contact.rangeProp = e.detail}
                        />
                    </div>

                    <div class="inp__lat">
                        <InputOptions 
                            identificador="numBeds" 
                            name="Recámaras" 
                            choices={oneToFive} 
                            value={Number(contact.numBeds)}
                            on:change={(e) => contact.numBeds = e.detail}
                        />
                        <InputOptions 
                            identificador="numBaths" 
                            name="Baños Completos" 
                            choices={oneToFour} 
                            value={Number(contact.numBaths)}
                            on:change={(e) => contact.numBaths = e.detail}
                        />
                    </div>

                    <div class="inp__lat">
                        <InputOptions 
                            identificador="halfBathroom" 
                            name="Medios Baños" 
                            choices={oneToThree} 
                            value={contact.halfBathroom}
                            on:change={(e) => contact.halfBathroom = e.detail}
                        />
                        <InputOptions 
                            identificador="numParks" 
                            name="Estacionamientos" 
                            choices={oneToFour} 
                            value={contact.numParks}
                            on:change={(e) => contact.numParks = e.detail}
                        />
                    </div>

                    <div class="inp__lat">
                        <Tags bind:tags={contact.tagsProperty} />
                        <Ubication bind:ubication={contact.locaProperty} />
                    </div>
                </div>
            {/if}
            
            <div class="form-actions">
                <Button
                    element="button"
                    type="submit"
                    variant="solid"
                    disabled={isSubmitting || Object.values(formErrors).some(error => error)}
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
</style>