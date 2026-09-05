<script lang="ts">
  export let options: Array<{ label: string; value: string | number }> = [];
  export let value: string | number = '';
  export let placeholder: string = '';
  export let name: string = '';
  export let required: boolean = false;

  let isOpen = false;

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(`.dropdown-${name}`)) {
      isOpen = false;
    }
  }

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    isOpen = !isOpen;
  }

  function selectOption(val: string | number) {
    value = val;
    isOpen = false;
  }

  $: selectedLabel = options.find((o) => `${o.value}` === `${value}`)?.label || placeholder;
</script>

<svelte:window on:click={handleClickOutside} />

<div class="dropdown-container dropdown-{name}">
  <button type="button" class="dropdown-button" class:open={isOpen} on:click={toggle}>
    <span class="label-text" class:is-placeholder={!value}>{selectedLabel}</span>
    <svg class="chevron" class:up={isOpen} viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
  
  {#if isOpen}
    <div class="dropdown-menu">
      <div class="options-list">
        {#each options as option}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <label class="option-label" on:click={() => selectOption(option.value)}>
            <span class="option-text">{option.label}</span>
            <input 
              type="radio" 
              {name}
              value={option.value}
              bind:group={value}
              {required}
              class="hidden-radio"
            />
            <span class="custom-radio"></span>
          </label>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .dropdown-container {
    position: relative;
    width: 100%;
  }

  .dropdown-button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: #1e1e35;
    border: 1px solid var(--border-color, rgba(99, 102, 241, 0.2));
    border-radius: var(--radius-sm, 0.5rem);
    color: var(--text-secondary, #94a3b8);
    font-size: 0.95rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .dropdown-button:hover {
    border-color: rgba(99, 102, 241, 0.45);
  }

  .dropdown-button:focus,
  .dropdown-button.open {
    outline: none;
    border-color: var(--primary, #6366f1);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  .label-text {
    color: var(--text-secondary, #94a3b8);
  }

  .label-text.is-placeholder {
    color: var(--text-secondary, #94a3b8);
    opacity: 0.85;
  }

  .chevron {
    transition: transform 0.2s ease, color 0.2s ease;
    color: var(--text-secondary, #94a3b8);
  }

  .dropdown-button:hover .chevron {
    color: #cbd5e1;
  }

  .chevron.up {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.35rem;
    background-color: #1e1e35;
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: var(--radius-md, 0.75rem);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 50;
    overflow: hidden;
    backdrop-filter: blur(12px);
  }

  .options-list {
    max-height: 250px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }
  
  /* Scrollbar styles for the dropdown */
  .options-list::-webkit-scrollbar {
    width: 6px;
  }
  .options-list::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
  }
  .options-list::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.35);
    border-radius: 4px;
  }
  .options-list::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.6);
  }

  .option-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.7rem 1.15rem;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .option-label:hover {
    background-color: rgba(99, 102, 241, 0.15);
  }

  .option-text {
    color: var(--text-primary, #f1f5f9);
    font-size: 0.92rem;
  }

  .hidden-radio {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .custom-radio {
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background-color: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .hidden-radio:checked + .custom-radio {
    border-color: var(--primary, #6366f1);
    background-color: rgba(99, 102, 241, 0.2);
  }

  .hidden-radio:checked + .custom-radio::after {
    content: '';
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background-color: var(--primary, #6366f1);
  }

  .hidden-radio:focus-visible + .custom-radio {
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
  }
</style>
