<script lang="ts">
    import { notifications } from '$lib/stores/notificationStore';
    import Notification from './Notification.svelte';
</script>

<div class="notification-container">
    {#each $notifications as notification (notification.id)}
        <Notification
            type={notification.type}
            message={notification.message}
            duration={notification.duration || 5000}
            showClose={notification.showClose !== false}
        />
    {/each}
</div>

<style>
    .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
