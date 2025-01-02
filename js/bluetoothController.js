/**
 * Manages Bluetooth connections and data transfer
 */
class BluetoothController {
    constructor() {
        this.device = null;
        this.server = null;
        this.connectedDevices = new Map();
        this.isHost = false;
        this.SERVICE_UUID = '00001101-0000-1000-8000-00805F9B34FB'; // Standard SPP UUID
        this.CHARACTERISTIC_UUID = '00001102-0000-1000-8000-00805F9B34FB';
        this.onDataReceived = null;
    }

    /**
     * Initialize Bluetooth functionality
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initialize() {
        if (!navigator.bluetooth) {
            throw new Error('Bluetooth Web API not available');
        }
        return true;
    }

    /**
     * Start advertising as a host device
     * @returns {Promise<void>}
     */
    async startAdvertising() {
        try {
            this.server = await navigator.bluetooth.getAdvertisingServer();
            const service = await this.server.addService(this.SERVICE_UUID);
            const characteristic = await service.addCharacteristic(this.CHARACTERISTIC_UUID, {
                properties: ['write', 'notify'],
                permissions: ['write']
            });

            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                if (this.onDataReceived) {
                    this.onDataReceived(event.target.value);
                }
            });

            await this.server.startAdvertising({
                name: 'Audio Host',
                services: [this.SERVICE_UUID]
            });

            this.isHost = true;
        } catch (error) {
            console.error('Failed to start advertising:', error);
            throw error;
        }
    }

    /**
     * Start device discovery
     * @returns {Promise<void>}
     */
    async startDiscovery() {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{
                    services: [this.SERVICE_UUID]
                }],
                optionalServices: [this.SERVICE_UUID]
            });

            this.device = device;
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(this.SERVICE_UUID);
            const characteristic = await service.getCharacteristic(this.CHARACTERISTIC_UUID);

            // Set up notification handling
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                if (this.onDataReceived) {
                    this.onDataReceived(event.target.value);
                }
            });

            this.connectedDevices.set(device.id, {
                device,
                server,
                characteristic
            });

            device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection(device.id);
            });
        } catch (error) {
            console.error('Discovery failed:', error);
            throw error;
        }
    }

    /**
     * Send audio data to connected devices
     * @param {Uint8Array} data Audio data to send
     * @returns {Promise<void>}
     */
    async broadcastAudioData(data) {
        const promises = [];
        for (const [deviceId, connection] of this.connectedDevices) {
            try {
                // Split data into chunks if needed (Bluetooth has MTU limits)
                const CHUNK_SIZE = 512;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    promises.push(connection.characteristic.writeValue(chunk));
                }
            } catch (error) {
                console.error(`Failed to send data to device ${deviceId}:`, error);
                this.handleDisconnection(deviceId);
            }
        }
        await Promise.all(promises);
    }

    /**
     * Handle device disconnection
     * @param {string} deviceId ID of the disconnected device
     */
    handleDisconnection(deviceId) {
        const connection = this.connectedDevices.get(deviceId);
        if (connection) {
            try {
                connection.characteristic.stopNotifications();
                connection.server.disconnect();
            } catch (error) {
                console.error('Error during disconnection cleanup:', error);
            }
            this.connectedDevices.delete(deviceId);
            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('deviceDisconnected', {
                detail: { deviceId }
            }));
        }
    }

    /**
     * Set callback for received data
     * @param {Function} callback Function to handle received data
     */
    setDataReceivedCallback(callback) {
        this.onDataReceived = callback;
    }

    /**
     * Get the number of connected devices
     * @returns {number} Number of connected devices
     */
    getConnectedDeviceCount() {
        return this.connectedDevices.size;
    }

    /**
     * Get list of connected devices
     * @returns {Array} Array of connected device objects
     */
    getConnectedDevices() {
        return Array.from(this.connectedDevices.keys()).map(id => ({
            id,
            name: this.connectedDevices.get(id).device.name
        }));
    }
}

// Export the controller
window.BluetoothController = BluetoothController;
