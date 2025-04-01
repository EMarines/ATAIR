<!-- <script lang="ts">
    // import { isTestMode, setTestMode } from '$lib/services/googleService';
    import { onMount } from 'svelte';
    
    let testModeEnabled = false;
    
    // onMount(() => {
    //     testModeEnabled = isTestMode();
    // });
    
    // function toggleTestMode() {
    //     testModeEnabled = !testModeEnabled;
    //     setTestMode(testModeEnabled);
    // }
</script>

<div class="test-mode-container">
    <label class="test-mode-switch">
        <input type="checkbox" bind:checked={testModeEnabled} on:change={toggleTestMode}>
        <span class="slider round"></span>
    </label>
    <span class="test-mode-label">
        {testModeEnabled ? 'Modo de prueba activado' : 'Modo de prueba desactivado'}
    </span>
    {#if testModeEnabled}
        <div class="test-mode-info">
            <p>En modo de prueba, los contactos no se sincronizarán con Google Contacts.</p>
        </div>
    {/if}
</div>

<style>
    .test-mode-container {
        display: flex;
        align-items: center;
        margin: 10px 0;
        flex-wrap: wrap;
    }
    
    .test-mode-switch {
        position: relative;
        display: inline-block;
        width: 60px;
        height: 34px;
        margin-right: 10px;
    }
    
    .test-mode-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
    }
    
    .slider:before {
        position: absolute;
        content: "";
        height: 26px;
        width: 26px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
    }
    
    input:checked + .slider {
        background-color: #2196F3;
    }
    
    input:focus + .slider {
        box-shadow: 0 0 1px #2196F3;
    }
    
    input:checked + .slider:before {
        transform: translateX(26px);
    }
    
    .slider.round {
        border-radius: 34px;
    }
    
    .slider.round:before {
        border-radius: 50%;
    }
    
    .test-mode-label {
        font-weight: bold;
        color: #333;
    }
    
    .test-mode-info {
        width: 100%;
        margin-top: 5px;
        padding: 5px;
        background-color: #f8f9fa;
        border-radius: 4px;
        font-size: 0.9em;
        color: #666;
    }
    
    .test-mode-info p {
        margin: 0;
    }
</style> -->
