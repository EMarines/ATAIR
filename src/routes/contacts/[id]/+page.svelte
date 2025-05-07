<script lang="ts">
    import { page } from '$app/stores';
    import { firebase } from '$lib/stores/firebaseStores';
    import {AddContact} from '$components';
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let contact: any = null;
    let loading = true;
    let error = null;
    let systStatus = "";

    onMount(async () => {
        try {
            const id = $page.params.id;
            console.log('ID del contacto:', id);
            
            const result = await firebase.get('contacts', [{ field: 'id', operator: '==', value: id }]);
            console.log('Resultado de la búsqueda:', result);
            
            if (result.success && result.data && result.data.length > 0) {
                contact = result.data[0];
                console.log('Contacto encontrado:', contact);
            } else {
                error = 'Contacto no encontrado';
                console.error('No se encontraron datos para el ID:', id);
            }
        } catch (e) {
            error = e instanceof Error ? e.message : 'Error al cargar el contacto';
        } finally {
            loading = false;
        }
    });

    function editContact() {
        console.log('Estado antes de editar:', systStatus);
        console.log('Contacto a editar:', contact);
        systStatus = "";
        console.log('Estado después de editar:', systStatus);
    }
</script>

<div class="contact-edit">
    {#if loading}
        <div class="loading">Cargando...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if contact}
        {#if systStatus === "editContact"}
            <div class="edit-container" transition:fade>
                <AddContact 
                    existingContact={contact}
                    on:cancel={() => {
                        console.log('Cancelando edición');
                        systStatus = "";
                    }} 
                    on:success={(event) => {
                        console.log('Edición exitosa:', event.detail);
                        systStatus = "";
                        window.location.reload();
                    }}
                />
            </div>
        {:else}
            <div class="contact-form">
                <AddContact existingContact={contact} />
                <button on:click={editContact}>Editar Contacto</button>
            </div>
        {/if}
    {:else}
        <div class="error">No se encontró el contacto</div>
    {/if}
</div>

<style>
    .loading, .error {
        text-align: center;
        padding: 2rem;
    }
    .error {
        color: #ff3e3e;
    }
    .contact-edit {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
    }
    .contact-form {
        background: rgb(32, 32, 32);
        border-radius: 8px;
        padding: 1rem;
    }
    .edit-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        background: rgb(32, 32, 32);
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        z-index: 1000;
    }
</style>
