<script>
	export let searchTerm = "";
	export let placeHolder ="";
</script>

<div class="search-input-container">
	<input 
		class="search-input"
		type="text" 
		id="search-field" 
		placeholder={placeHolder} 
		autocomplete="off"
		bind:value={searchTerm}
		on:input
		aria-label={placeHolder || "Buscar"}
	/>
</div> 

<style>	
	.search-input-container {
		position: relative;
		width: 100%;
		max-width: 300px;
	}

	.search-input {
		width: 100%;
		min-width: 200px;
		height: 35px;
		font-size: 1.2rem;
		color: var(--text-color, rgb(84, 84, 90));
		background-color: var(--surface-2, white);
		border: 1px solid var(--border, #ccc);
		border-radius: 5px;
		padding: 0.5rem;
		transition: border-color 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--brand, #0052cc);
		box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.1);
	}
</style>
