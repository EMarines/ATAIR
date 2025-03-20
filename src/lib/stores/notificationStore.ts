import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    duration?: number;
    showClose?: boolean;
}

function createNotificationStore() {
    const { subscribe, update } = writable<Notification[]>([]);

    function generateId(): string {
        return Math.random().toString(36).substring(2, 9);
    }

    function addNotification(notification: Omit<Notification, 'id'>) {
        const id = generateId();
        const newNotification: Notification = {
            id,
            ...notification
        };

        update(notifications => [...notifications, newNotification]);

        // Auto-remove after duration if specified
        if (notification.duration !== 0) {
            setTimeout(() => {
                removeNotification(id);
            }, notification.duration || 5000);
        }

        return id;
    }

    function removeNotification(id: string) {
        update(notifications => notifications.filter(n => n.id !== id));
    }

    function clearAll() {
        update(() => []);
    }

    return {
        subscribe,
        add: addNotification,
        remove: removeNotification,
        clear: clearAll,
        success: (message: string, duration?: number) => addNotification({ type: 'success', message, duration }),
        error: (message: string, duration?: number) => addNotification({ type: 'error', message, duration }),
        warning: (message: string, duration?: number) => addNotification({ type: 'warning', message, duration }),
        info: (message: string, duration?: number) => addNotification({ type: 'info', message, duration })
    };
}

export const notifications = createNotificationStore();
