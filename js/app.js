/**
 * Main application controller
 */
class App {
    constructor() {
        this.audioController = new AudioController();
        this.bluetoothController = new BluetoothController();
        this.currentMode = null; // 'host' or 'receiver'
        this.initializeUI();
        this.setupBluetoothHandlers();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        // Mode selection buttons
        this.hostButton = document.getElementById('hostButton');
        this.receiverButton = document.getElementById('receiverButton');
        
        // Interface containers
        this.hostInterface = document.getElementById('hostInterface');
        this.receiverInterface = document.getElementById('receiverInterface');
        
        // Host controls
        this.startBroadcast = document.getElementById('startBroadcast');
        this.stopBroadcast = document.getElementById('stopBroadcast');
        this.connectedDevicesList = document.getElementById('connectedDevices');
        
        // Receiver controls
        this.searchHost = document.getElementById('searchHost');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        this.hostButton.addEventListener('click', () => this.setMode('host'));
        this.receiverButton.addEventListener('click', () => this.setMode('receiver'));
        
        this.startBroadcast.addEventListener('click', () => this.startBroadcasting());
        this.stopBroadcast.addEventListener('click', () => this.stopBroadcasting());
        
        this.searchHost.addEventListener('click', () => this.searchForHost());

        // Listen for device disconnection events
        window.addEventListener('deviceDisconnected', (event) => {
            this.updateDeviceList();
            this.showNotification(`Device ${event.detail.deviceId} disconnected`);
        });
    }

    /**
     * Set up Bluetooth event handlers
     */
    setupBluetoothHandlers() {
        // Set up data received callback for receiver mode
        this.bluetoothController.setDataReceivedCallback(async (data) => {
            if (this.currentMode === 'receiver') {
                await this.audioController.playAudio(data);
            }
        });
    }

    /**
     * Set the application mode (host/receiver)
     * @param {string} mode - The mode to set ('host' or 'receiver')
     */
    async setMode(mode) {
        this.currentMode = mode;
        this.hostInterface.classList.toggle('d-none', mode !== 'host');
        this.receiverInterface.classList.toggle('d-none', mode !== 'receiver');
        
        this.hostButton.classList.toggle('btn-primary', mode === 'host');
        this.hostButton.classList.toggle('btn-secondary', mode !== 'host');
        
        this.receiverButton.classList.toggle('btn-primary', mode === 'receiver');
        this.receiverButton.classList.toggle('btn-secondary', mode !== 'receiver');

        try {
            await this.bluetoothController.initialize();
            
            if (mode === 'host') {
                await this.bluetoothController.startAdvertising();
                this.showNotification('Started advertising as host');
            }
        } catch (error) {
            this.showError(`Failed to initialize ${mode} mode: ${error.message}`);
        }
    }

    /**
     * Start broadcasting audio
     */
    async startBroadcasting() {
        try {
            this.startBroadcast.disabled = true;
            this.stopBroadcast.disabled = false;

            await this.audioController.startCapture(async (audioData) => {
                if (this.bluetoothController.getConnectedDeviceCount() > 0) {
                    await this.bluetoothController.broadcastAudioData(audioData);
                }
            });

            this.showNotification('Broadcasting started');
        } catch (error) {
            this.showError('Failed to start broadcasting: ' + error.message);
            this.stopBroadcasting();
        }
    }

    /**
     * Stop broadcasting audio
     */
    stopBroadcasting() {
        this.audioController.stopCapture();
        this.startBroadcast.disabled = false;
        this.stopBroadcast.disabled = true;
        this.showNotification('Broadcasting stopped');
    }

    /**
     * Search for a host device
     */
    async searchForHost() {
        try {
            this.connectionStatus.textContent = 'Searching for host...';
            this.connectionStatus.className = 'alert alert-info';
            this.searchHost.disabled = true;

            await this.bluetoothController.startDiscovery();
            
            this.connectionStatus.textContent = 'Connected to host';
            this.connectionStatus.className = 'alert alert-success';
        } catch (error) {
            this.showError('Failed to find host: ' + error.message);
            this.connectionStatus.textContent = 'Connection failed';
            this.connectionStatus.className = 'alert alert-danger';
        } finally {
            this.searchHost.disabled = false;
        }
    }

    /**
     * Update the list of connected devices in the UI
     */
    updateDeviceList() {
        const devices = this.bluetoothController.getConnectedDevices();
        this.connectedDevicesList.innerHTML = devices.map(device => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${device.name || 'Unknown Device'}
                <span class="badge bg-primary rounded-pill">Connected</span>
            </li>
        `).join('');
    }

    /**
     * Show an error message to the user
     * @param {string} message Error message to display
     */
    showError(message) {
        console.error(message);
        Toastify({
            text: message,
            duration: 5000,
            close: true,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(to right, #ff5f6d, #ffc371)",
            }
        }).showToast();
    }

    /**
     * Show a notification to the user
     * @param {string} message Notification message to display
     */
    showNotification(message) {
        console.log(message);
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(to right, #00b09b, #96c93d)",
            }
        }).showToast();
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
