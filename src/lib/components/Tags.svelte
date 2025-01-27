<script lang="ts">

    export  let tags: string[] = [];
  
</script>

	<div class="mainContainer">

		<div class="rowContainer">
			<label>Fracc. Privado
				<input type="checkbox"  value="Fracc._Privado" bind:group={tags}/>
	   	</label>
      <label>Frente a Parque
         <input type="checkbox" value="Frente_a_Parque"  bind:group={tags}  />
      </label>	
		</div>

		<div class="rowContainer">
      <label>Una Planta
         <input type="checkbox" value="Una_Planta"  bind:group={tags} />
      </label>
			<label>Recamara en P.B.
				<input type="checkbox" value="Recamara_ en_PB" bind:group={tags} />
			</label>	
		</div>
			
		<div class="rowContainer">
			<label>Patio Amplio
				<input type="checkbox" value="Patio_Amplio" bind:group={tags} />
			</label>			
			<label>Lista para Habitarse
				<input type="checkbox" value="Lista_Habitarse" bind:group={tags} />
			</label>
		
		</div>
			
		<div class="rowContainer">
			<label>Nueva
				<input type="checkbox" value="Nueva" bind:group={tags} />
			</label>
			<label>En Avenida
				<input type="checkbox" value="En_Avenida" bind:group={tags} />
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
		/* padding: 22px; */
		align-items: center;
		justify-content: center;
		margin: 10px;
	}
	.rowContainer{
		display: flex;
		font-size: .8em;
		font-weight: 500;
		color: purple;
		display: flex;
		padding: 15px;
		gap: 20px;
	}
	
	input, label {
		cursor: pointer;
	}

	input, label:hover {
		font-weight: 900;
	}
</style>

