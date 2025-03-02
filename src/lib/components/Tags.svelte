<script lang="ts">
    import { tags } from '$lib/parameters';
    export let propTags: string[] = [];
</script>

<div class="mainContainer">
    {#each tags as tag, i}
        {#if i % 2 === 0}
            <div class="rowContainer">
                <label>
                    {tag}
                    <input type="checkbox" value={tag} bind:group={propTags} />
                </label>
                {#if tags[i + 1]}
                    <label>
                        {tags[i + 1]}
                        <input type="checkbox" value={tags[i + 1]} bind:group={propTags} />
                    </label>
                {/if}
            </div>
        {/if}
    {/each}
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

