<script lang="ts">
	export let value: string;
	export let identifier: string;
	export let name: string;
</script>

<label class="label__title" for={identifier}>
	<p class={value ? 'above' : 'center'}>
		{name}
	</p>
	<input 
		id={identifier} 
		class="in__sel" 
		type="email" 
		bind:value 
		placeholder={name}
	/>
</label>


