<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let name: string;
    export let identificador: string;
    export let value: string[] = [];
    export let choices: string[] = [];
    
    const dispatch = createEventDispatcher();
    
    let isOpen = false;
    let searchText = '';
    
    $: filteredChoices = choices.filter(choice => 
        choice.toLowerCase().includes(searchText.toLowerCase())
    );
    
    function toggleOption(choice: string) {
        const index = value.indexOf(choice);
        if (index === -1) {
            value = [...value, choice];
        } else {
            value = value.filter(v => v !== choice);
        }
        dispatch('change', value);
    }
    
    function toggleDropdown() {
        isOpen = !isOpen;
    }
    
    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.select-container')) {
            isOpen = false;
        }
    }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="select-container">
    <label for={identificador}>{name}</label>
    <div class="selected-options" on:click={toggleDropdown}>
        {#if value.length === 0}
            <span class="placeholder">Seleccionar opciones...</span>
        {:else}
            <div class="tags">
                {#each value as selected}
                    <span class="tag">
                        {selected}
                        <button class="remove-tag" on:click|stopPropagation={() => toggleOption(selected)}>×</button>
                    </span>
                {/each}
            </div>
        {/if}
    </div>
    
    {#if isOpen}
        <div class="dropdown">
            <input
                type="text"
                bind:value={searchText}
                placeholder="Buscar..."
                class="search-input"
            />
            <div class="options-list">
                {#each filteredChoices as choice}
                    <div 
                        class="option"
                        class:selected={value.includes(choice)}
                        on:click={() => toggleOption(choice)}
                    >
                        <input
                            type="checkbox"
                            checked={value.includes(choice)}
                            readonly
                        />
                        {choice}
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .select-container {
        position: relative;
        width: 100%;
    }
    
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
    }
    
    .selected-options {
        border: 1px solid #ddd;
        padding: 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        min-height: 42px;
    }
    
    .placeholder {
        color: #666;
    }
    
    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-top: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
    }
    
    .search-input {
        width: 100%;
        padding: 0.5rem;
        border: none;
        border-bottom: 1px solid #ddd;
    }
    
    .options-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .option {
        padding: 0.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .option:hover {
        background-color: #f5f5f5;
    }
    
    .option.selected {
        background-color: #e6f3ff;
    }
    
    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .tag {
        background-color: #e6f3ff;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .remove-tag {
        border: none;
        background: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        font-size: 1.2rem;
        line-height: 1;
        color: #666;
    }
    
    .remove-tag:hover {
        color: #ff4444;
    }
</style>