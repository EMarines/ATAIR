<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { onMount, onDestroy } from 'svelte';
    
    export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
    export let message: string = '';
    export let duration: number = 5000; // Duración en ms
    export let showClose: boolean = true;
    
    let visible = true;
    let timer: ReturnType<typeof setTimeout>;
    
    // Colores según el tipo
    const colors = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
        info: '#2196F3'
    };
    
    // Iconos según el tipo
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    onMount(() => {
        if (duration > 0) {
            timer = setTimeout(() => {
                visible = false;
            }, duration);
        }
    });
    
    onDestroy(() => {
        if (timer) clearTimeout(timer);
    });
    
    function close() {
        visible = false;
        if (timer) clearTimeout(timer);
    }
</script>

{#if visible}
<div 
    class="notification"
    style="border-left: 4px solid {colors[type]};"
    transition:fly={{ y: -20, duration: 300 }}
    role="alert"
>
    <div class="icon" style="background-color: {colors[type]};">
        {icons[type]}
    </div>
    <div class="content">
        <p>{message}</p>
    </div>
    {#if showClose}
    <button class="close" on:click={close}>
        ×
    </button>
    {/if}
</div>
{/if}

<style>
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        align-items: center;
        min-width: 300px;
        max-width: 450px;
        background-color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        overflow: hidden;
    }
    
    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        color: white;
        font-size: 18px;
        font-weight: bold;
    }
    
    .content {
        flex: 1;
        padding: 12px 15px;
    }
    
    .content p {
        margin: 0;
        font-size: 14px;
        line-height: 1.4;
    }
    
    .close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 0 10px;
        color: #888;
        transition: color 0.2s;
    }
    
    .close:hover {
        color: #333;
    }
</style>
