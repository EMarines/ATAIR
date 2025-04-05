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

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            isOpen = false;
        }
    }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeyDown} />

<div class="select-container" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" aria-controls="options-list">
    <label id={`${identificador}-label`} for={identificador}>{name}</label>
    <div 
        class="selected-options"
        id={identificador}
        tabindex="0"
        aria-labelledby={`${identificador}-label`}
        on:click={toggleDropdown}
        on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDropdown();
            }
        }}
    >
        {#if value.length === 0}
            <span class="placeholder">Seleccionar opciones...</span>
        {:else}
            <div class="tags" role="list">
                {#each value as selected}
                    <span class="tag" role="listitem">
                        {selected}
                        <button 
                            type="button"
                            class="remove-tag" 
                            on:click|stopPropagation={() => toggleOption(selected)}
                            aria-label={`Eliminar ${selected}`}
                        >×</button>
                    </span>
                {/each}
            </div>
        {/if}
    </div>
    
    {#if isOpen}
        <div 
            class="dropdown" 
            id="options-list" 
            role="listbox" 
            aria-multiselectable="true"
        >
            <div class="search-container">
                <input
                    type="text"
                    bind:value={searchText}
                    placeholder="Buscar..."
                    class="search-input"
                    aria-label="Buscar opciones"
                />
            </div>
            <div class="options-list">
                {#each filteredChoices as choice}
                    <div 
                        class="option"
                        class:selected={value.includes(choice)}
                        role="option"
                        aria-selected={value.includes(choice)}
                        tabindex="0"
                        on:click={() => toggleOption(choice)}
                        on:keydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleOption(choice);
                            }
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={value.includes(choice)}
                            aria-label={`Seleccionar ${choice}`}
                            tabindex="-1"
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
        border: 1px solid var(--border, #ddd);
        padding: 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        min-height: 42px;
        background-color: var(--surface-2, white);
    }
    
    .selected-options:focus {
        outline: none;
        border-color: var(--brand, #0052cc);
        box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.1);
    }
    
    .placeholder {
        color: var(--text-2, #666);
    }
    
    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--surface-2, white);
        border: 1px solid var(--border, #ddd);
        border-radius: 4px;
        margin-top: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
    }

    .search-container {
        padding: 0.5rem;
        border-bottom: 1px solid var(--border, #ddd);
    }
    
    .search-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--border, #ddd);
        border-radius: 4px;
    }
    
    .options-list {
        max-height: 200px;
        overflow-y: auto;
        padding: 0.5rem;
    }
    
    .option {
        padding: 0.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 4px;
    }
    
    .option:hover {
        background-color: var(--surface-3, #f5f5f5);
    }
    
    .option:focus {
        outline: none;
        background-color: var(--surface-3, #f5f5f5);
    }
    
    .option.selected {
        background-color: var(--surface-4, #e6f3ff);
    }
    
    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .tag {
        background-color: var(--surface-4, #e6f3ff);
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
        color: var(--text-2, #666);
    }
    
    .remove-tag:hover {
        color: var(--error, #ff4444);
    }

    .remove-tag:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--brand, #0052cc);
        border-radius: 2px;
    }
</style>