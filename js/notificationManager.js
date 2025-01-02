/**
 * Manages application notifications and alerts
 */
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = new Set();
        this.maxNotifications = 3;
        this.autoHideDelay = 5000; // 5 seconds
    }

    /**
     * Shows a success notification
     * @param {string} message - Notification message
     */
    success(message) {
        this.show(message, 'success', 'fas fa-check-circle');
    }

    /**
     * Shows an error notification
     * @param {string} message - Notification message
     */
    error(message) {
        this.show(message, 'error', 'fas fa-exclamation-circle');
    }

    /**
     * Shows a warning notification
     * @param {string} message - Notification message
     */
    warning(message) {
        this.show(message, 'warning', 'fas fa-exclamation-triangle');
    }

    /**
     * Shows an info notification
     * @param {string} message - Notification message
     */
    info(message) {
        this.show(message, 'info', 'fas fa-info-circle');
    }

    /**
     * Shows a notification
     * @private
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     * @param {string} icon - Font Awesome icon class
     */
    show(message, type, icon) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span class="notification-message">${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.hide(notification));

        // Add to container
        this.container.appendChild(notification);
        this.notifications.add(notification);

        // Remove old notifications if exceeding max
        while (this.notifications.size > this.maxNotifications) {
            const oldest = this.notifications.values().next().value;
            this.hide(oldest);
        }

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto-hide after delay
        setTimeout(() => {
            if (this.notifications.has(notification)) {
                this.hide(notification);
            }
        }, this.autoHideDelay);
    }

    /**
     * Hides a notification
     * @private
     * @param {HTMLElement} notification - Notification element to hide
     */
    hide(notification) {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
            if (this.notifications.has(notification)) {
                this.container.removeChild(notification);
                this.notifications.delete(notification);
            }
        });
    }

    /**
     * Clears all notifications
     */
    clear() {
        this.notifications.forEach(notification => this.hide(notification));
    }
}

export default NotificationManager;
