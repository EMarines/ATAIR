<script>
	  export let searchTerm = "";
		 export let placeHolder ="";
</script>

<div id="search-input-cont">
	<input class="searchInput"
		type="text" 
		id="search-field" 
		placeholder={placeHolder} 
		autocomplete="off"
		bind:value={searchTerm}
		on:input />
</div> 

<style>	
	.searchInput{
		min-width: 200px;
		max-width: 300px;
		height: 35px;
		font-size: 22px;
		color: rgb(84, 84, 90);
		border-radius: 5px;
	}
</style>
