<script lang="ts">
import { goto } from '$app/navigation';
import { AddContact } from '$components';

// Manejadores de eventos
function handleCancel() {
    goto("/contacts");
}

function handleSuccess() {
    goto("/contacts");
}
</script>

<div class="container">
    <div class="mainContainer">
        <div class="title__container">
            <h1 class="title">Nuevo Contacto</h1>
        </div>
        
        <AddContact 
            on:cancel={handleCancel}
            on:success={handleSuccess}
        />
    </div>
</div>

<style>
.container {
    width: 100%;
    height: 100%;
    padding: 2rem;
}

.mainContainer {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 2rem;
}

.title__container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.title {
    font-size: 2rem;
    font-weight: bold;
}
</style>