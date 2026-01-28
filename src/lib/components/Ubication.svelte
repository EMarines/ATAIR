<script lang="ts">
export let ubication: string[] = [];

</script>

<div class="mainContainer">
	

	<div class="filterLocationOne">                        
		<label for="north">/Norte\
			<input value="Norte" id="north" type="checkbox" bind:group={ubication} />
		</label>    
	</div>

	<div class="filterLocationOne">
		<label for="Noroeste">/Noroeste
			<input value="Noroeste" id="Noroeste" type="checkbox" bind:group={ubication} />
		</label>

		<label for="Noreste">
			<input value="Noreste" id="Noreste" type="checkbox" bind:group={ubication} />NorEste\
		</label>
	</div>  

	<div class="filterLocationOne">
		<label for="Oeste">/Oeste
			<input value="Oeste" id="Oeste" type="checkbox" bind:group={ubication} />
		</label>

		<label for="Centronorte"
					 >Centro Norte
			<input value="Centronorte" id="Centronorte" type="checkbox" bind:group={ubication} />
		</label>

		<label for="Este">
					 
			<input value="Este" id="Este" type="checkbox" bind:group={ubication} />Este\
		</label>
	</div>

	<div class="filterLocationOne"> 
		<label for="Centrosur"
					 >Centro Sur
			<input value="Centrosur" id="Centrosur" type="checkbox" bind:group={ubication} />
		</label>
	</div>

	<div class="filterLocationOne">
		<label for="Suroeste"
					 >/SurOeste
			<input value="Suroeste" id="Suroeste" type="checkbox" bind:group={ubication} />
		</label>

		<label for="Sureste"
					 >
			<input value="Sureste" id="Sureste" type="checkbox" bind:group={ubication} />SurEste\
		</label>
	</div>
</div>


<style>
	.mainContainer{
		display: flex;
		flex-direction: column;
		width: 22rem;
		border: 2px solid purple;
		border-radius: 10px;
		padding: 20px;
		align-items: center;
		justify-content: center;
		margin: 10px;
	}
	.filterLocationOne{

		display: flex;
		font-size: .8em;
		font-weight: 500;
		color: purple;
		display: flex;
		padding: 15px;
		gap: 30px;
	}

	input, label {
		cursor: pointer;
	}

	input, label:hover {
		font-weight: 800;
	}

</style>
