/**
 * Manages application notifications and user feedback
 */
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = new Map();
        this.counter = 0;
    }

    /**
     * Shows a notification message
     * @param {string} message - The message to display
     * @param {string} type - The type of notification ('success', 'error', 'warning')
     * @param {number} duration - How long to show the notification in ms (default 5000)
     * @returns {string} The notification ID
     */
    show(message, type = 'success', duration = 5000) {
        const id = `notification-${this.counter++}`;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getIcon(type)}"></i>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
        `;

        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // Set up auto-removal
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }

        return id;
    }

    /**
     * Removes a specific notification
     * @param {string} id - The notification ID to remove
     */
    remove(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                notification.remove();
                this.notifications.delete(id);
            }, 300);
        }
    }

    /**
     * Shows a success notification
     * @param {string} message - The success message
     * @param {number} duration - How long to show the notification
     * @returns {string} The notification ID
     */
    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    /**
     * Shows an error notification
     * @param {string} message - The error message
     * @param {number} duration - How long to show the notification
     * @returns {string} The notification ID
     */
    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    }

    /**
     * Shows a warning notification
     * @param {string} message - The warning message
     * @param {number} duration - How long to show the notification
     * @returns {string} The notification ID
     */
    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    /**
     * Gets the appropriate icon for the notification type
     * @private
     * @param {string} type - The notification type
     * @returns {string} The icon name
     */
    getIcon(type) {
        switch (type) {
            case 'success':
                return 'check-circle';
            case 'error':
                return 'exclamation-circle';
            case 'warning':
                return 'exclamation-triangle';
            default:
                return 'info-circle';
        }
    }

    /**
     * Clears all notifications
     */
    clearAll() {
        this.notifications.forEach((notification, id) => {
            this.remove(id);
        });
    }
}

export default NotificationManager;
