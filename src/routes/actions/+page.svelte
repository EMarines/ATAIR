<script lang="ts">
  import { contactsStore } from "$lib/stores/dataStore";

  $: contacts = $contactsStore;

  $: console.log(contacts);

</script>

<h1>Acciones</h1>

<div>
  {#each contacts as contact}
    <p>{contact.name} {contact.lastname}</p>
  {/each}
</div>