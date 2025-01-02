/**
 * Manages Bluetooth connections and data transfer
 */
const BLUETOOTH_SERVICE_UUID = '1234';
const AUDIO_CHARACTERISTIC_UUID = '5678';
const MAX_CONNECTIONS = 7; // Bluetooth standard limit for simultaneous connections

class BluetoothController {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.connectedDevices = new Map();
        this.isHost = false;
        this.connectionListeners = new Set();
        this.signalStrengthInterval = null;
        this.connectionQueue = [];
        this.maxConnections = MAX_CONNECTIONS;
        this.connectionTimeout = 10000; // 10 seconds timeout
    }

    /**
     * Initializes Bluetooth functionality and checks device compatibility
     * @returns {Promise<void>}
     * @throws {Error} If Bluetooth is not supported
     */
    async initialize() {
        if (!navigator.bluetooth) {
            throw new Error('Bluetooth not supported');
        }

        // Check for required Bluetooth permissions
        if (navigator.permissions) {
            try {
                const result = await navigator.permissions.query({ name: 'bluetooth' });
                if (result.state === 'denied') {
                    throw new Error('Bluetooth permission denied');
                }
            } catch (error) {
                console.warn('Bluetooth permission check failed:', error);
            }
        }
    }

    /**
     * Starts device discovery and connection as host
     * @returns {Promise<void>}
     */
    async startHosting() {
        try {
            this.isHost = true;
            
            // Create GATT server
            this.server = await navigator.bluetooth.getGATTServer();
            
            // Create our audio service
            this.service = await this.server.createService(BLUETOOTH_SERVICE_UUID);
            
            // Create characteristic for audio data
            this.characteristic = await this.service.createCharacteristic(
                AUDIO_CHARACTERISTIC_UUID,
                {
                    properties: ['write', 'notify'],
                    permissions: ['write']
                }
            );

            // Start advertising our service
            await this.server.startAdvertising({
                name: 'Audio Broadcaster',
                serviceUuids: [BLUETOOTH_SERVICE_UUID]
            });

            this.startSignalStrengthMonitoring();
        } catch (error) {
            console.error('Failed to start hosting:', error);
            throw new Error('Failed to start hosting');
        }
    }

    /**
     * Connects to a host device with error handling and connection validation
     * @returns {Promise<void>}
     */
    async connectToHost() {
        try {
            // Request device with specific service UUID
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{
                    services: [BLUETOOTH_SERVICE_UUID]
                }],
                optionalServices: []
            });

            // Validate device compatibility
            if (!this.device.gatt) {
                throw new Error('Device does not support GATT');
            }

            // Connect to the device
            this.server = await this.device.gatt.connect();
            
            // Get the audio service
            this.service = await this.server.getPrimaryService(BLUETOOTH_SERVICE_UUID);
            
            // Get the audio characteristic
            this.characteristic = await this.service.getCharacteristic(AUDIO_CHARACTERISTIC_UUID);

            // Set up disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnect();
            });

            this.startSignalStrengthMonitoring();
        } catch (error) {
            console.error('Failed to connect to host:', error);
            throw new Error('Connection failed: ' + error.message);
        }
    }

    /**
     * Monitors signal strength for all connections
     * @private
     */
    startSignalStrengthMonitoring() {
        if (this.signalStrengthInterval) {
            clearInterval(this.signalStrengthInterval);
        }

        this.signalStrengthInterval = setInterval(async () => {
            if (this.device) {
                try {
                    const rssi = await this.device.gatt.getRSSI();
                    this.notifyConnectionListeners({
                        type: 'signal',
                        deviceId: this.device.id,
                        rssi: rssi
                    });
                } catch (error) {
                    console.warn('Failed to get RSSI:', error);
                }
            }
        }, 1000);
    }

    /**
     * Handles device disconnection
     * @private
     */
    handleDisconnect() {
        const deviceId = this.device?.id;
        this.connectedDevices.delete(deviceId);
        this.notifyConnectionListeners({
            type: 'disconnect',
            deviceId: deviceId
        });
    }

    /**
     * Handles new device connection request
     * @private
     * @param {BluetoothDevice} device - The device requesting connection
     */
    async handleConnectionRequest(device) {
        if (this.connectedDevices.size >= this.maxConnections) {
            // Check for inactive connections
            const inactiveDevices = Array.from(this.connectedDevices.entries())
                .filter(([_, data]) => Date.now() - data.lastActive > 5000);

            if (inactiveDevices.length > 0) {
                // Disconnect least active device
                const [deviceId] = inactiveDevices[0];
                await this.disconnectDevice(deviceId);
            } else {
                throw new Error('Maximum connection limit reached');
            }
        }

        // Add to connection queue
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.connectionQueue = this.connectionQueue.filter(req => req.device !== device);
                reject(new Error('Connection request timeout'));
            }, this.connectionTimeout);

            this.connectionQueue.push({
                device,
                resolve,
                reject,
                timeoutId
            });

            this.processConnectionQueue();
        });
    }

    /**
     * Processes the connection queue
     * @private
     */
    async processConnectionQueue() {
        if (this.connectionQueue.length === 0) return;

        const request = this.connectionQueue[0];
        try {
            const server = await request.device.gatt.connect();
            const deviceInfo = {
                id: request.device.id,
                name: request.device.name || 'Unknown Device',
                server,
                lastActive: Date.now(),
                rssi: null
            };

            this.connectedDevices.set(request.device.id, deviceInfo);
            clearTimeout(request.timeoutId);
            request.resolve(deviceInfo);

            this.notifyConnectionListeners({
                type: 'connect',
                device: deviceInfo
            });
        } catch (error) {
            request.reject(error);
        } finally {
            this.connectionQueue.shift();
            this.processConnectionQueue();
        }
    }

    /**
     * Disconnects a specific device
     * @private
     * @param {string} deviceId - ID of the device to disconnect
     */
    async disconnectDevice(deviceId) {
        const deviceInfo = this.connectedDevices.get(deviceId);
        if (deviceInfo && deviceInfo.server.connected) {
            await deviceInfo.server.disconnect();
        }
        this.connectedDevices.delete(deviceId);
        this.notifyConnectionListeners({
            type: 'disconnect',
            deviceId
        });
    }

    /**
     * Updates device activity timestamp
     * @private
     * @param {string} deviceId - ID of the active device
     */
    updateDeviceActivity(deviceId) {
        const deviceInfo = this.connectedDevices.get(deviceId);
        if (deviceInfo) {
            deviceInfo.lastActive = Date.now();
        }
    }

    /**
     * Sends audio data to connected devices with priority handling
     * @param {Float32Array} audioData - Audio data to send
     */
    async sendAudioData(audioData) {
        if (!this.isHost || !this.characteristic) return;

        try {
            const chunk = new Uint8Array(audioData.buffer);
            const promises = Array.from(this.connectedDevices.entries()).map(async ([deviceId, deviceInfo]) => {
                try {
                    await deviceInfo.server.writeValue(chunk);
                    this.updateDeviceActivity(deviceId);
                } catch (error) {
                    console.warn(`Failed to send audio to device ${deviceId}:`, error);
                    if (error.message.includes('disconnected')) {
                        await this.disconnectDevice(deviceId);
                    }
                }
            });

            await Promise.all(promises);
        } catch (error) {
            console.error('Failed to send audio data:', error);
            this.notifyConnectionListeners({
                type: 'error',
                message: 'Failed to send audio data'
            });
        }
    }

    /**
     * Adds a connection status listener
     * @param {Function} listener - Callback function for connection events
     */
    addConnectionListener(listener) {
        this.connectionListeners.add(listener);
    }

    /**
     * Removes a connection status listener
     * @param {Function} listener - Callback function to remove
     */
    removeConnectionListener(listener) {
        this.connectionListeners.delete(listener);
    }

    /**
     * Notifies all connection listeners of an event
     * @private
     * @param {Object} event - Event object to send to listeners
     */
    notifyConnectionListeners(event) {
        this.connectionListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in connection listener:', error);
            }
        });
    }

    /**
     * Disconnects from all devices and cleans up resources
     */
    disconnect() {
        if (this.signalStrengthInterval) {
            clearInterval(this.signalStrengthInterval);
            this.signalStrengthInterval = null;
        }

        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }

        if (this.server && this.isHost) {
            this.server.stopAdvertising();
        }
        
        this.connectedDevices.clear();
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        
        this.notifyConnectionListeners({
            type: 'cleanup',
            message: 'Disconnected and cleaned up'
        });
    }

    /**
     * Gets the list of connected devices with their signal strength
     * @returns {Array} Array of connected device objects
     */
    getConnectedDevices() {
        return Array.from(this.connectedDevices.values());
    }
}

export default BluetoothController;
