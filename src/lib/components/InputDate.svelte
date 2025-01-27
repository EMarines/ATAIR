<script lang="ts">
  export let value: string;
  export let identifier: string;
  export let name: string;
</script>

<label class="label__title">
  <p class={value ? ' above' : ' center'}>{name}</p>
  <input id={identifier} class="in__sel" type="date" name="createdAt" bind:value placeholder={name}>
</label>