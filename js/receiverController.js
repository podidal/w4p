/**
 * Handles receiving audio from a host device
 */
class ReceiverController {
    constructor(audioContext, notificationManager, performanceMonitor) {
        this.audioContext = audioContext;
        this.notificationManager = notificationManager;
        this.performanceMonitor = performanceMonitor;
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.isConnected = false;
        this.isReceiving = false;
        
        // Standard Bluetooth UUIDs for audio streaming
        this.SERVICE_UUID = '0000110b-0000-1000-8000-00805f9b34fb'; // A2DP service UUID
        this.CHARACTERISTIC_UUID = '00002345-0000-1000-8000-00805f9b34fb'; // Audio streaming characteristic UUID
        
        // Audio processing nodes
        this.sourceNode = null;
        this.gainNode = null;
        this.audioWorklet = null;
        
        this.setupAudioNodes();
    }

    /**
     * Sets up audio processing nodes
     * @private
     */
    async setupAudioNodes() {
        try {
            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);

            // Load audio worklet for processing
            await this.audioContext.audioWorklet.addModule('js/audioWorklet.js');
            this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');
            this.audioWorklet.connect(this.gainNode);

            // Handle messages from audio worklet
            this.audioWorklet.port.onmessage = (event) => {
                if (event.data.type === 'latency') {
                    this.performanceMonitor.updateLatency(event.data.value);
                }
            };
        } catch (error) {
            console.error('Failed to setup audio nodes:', error);
            this.notificationManager.error('Failed to initialize audio system');
        }
    }

    /**
     * Checks if Bluetooth is available and requests necessary permissions
     * @private
     * @returns {Promise<boolean>} Whether Bluetooth is available and permitted
     */
    async checkBluetoothAvailability() {
        // Check if Bluetooth API is available
        if (!navigator.bluetooth) {
            this.notificationManager.error('Bluetooth is not supported in this browser');
            throw new Error('Bluetooth not supported');
        }

        try {
            // Request Bluetooth permission
            await navigator.permissions.query({ name: 'bluetooth' });
            
            // Check if Bluetooth is enabled
            const availability = await navigator.bluetooth.getAvailability();
            if (!availability) {
                this.notificationManager.warning('Please enable Bluetooth on your device');
                throw new Error('Bluetooth not enabled');
            }

            return true;
        } catch (error) {
            console.error('Bluetooth availability check failed:', error);
            return false;
        }
    }

    /**
     * Connects to a host device
     */
    async connect() {
        try {
            // Check Bluetooth availability first
            await this.checkBluetoothAvailability();

            // Request Bluetooth device with audio service
            this.notificationManager.info('Searching for Bluetooth devices...');
            
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '0000110b-0000-1000-8000-00805f9b34fb', // A2DP Sink
                    '0000110a-0000-1000-8000-00805f9b34fb', // A2DP Source
                    '0000110c-0000-1000-8000-00805f9b34fb', // Advanced Audio
                    '0000110e-0000-1000-8000-00805f9b34fb'  // Handsfree
                ]
            });

            if (!this.device) {
                throw new Error('No device selected');
            }

            this.notificationManager.info('Connecting to device...');

            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            
            // Get audio service
            this.service = await this.server.getPrimaryService('0000110b-0000-1000-8000-00805f9b34fb');
            
            // Get audio characteristic
            this.characteristic = await this.service.getCharacteristic('00002345-0000-1000-8000-00805f9b34fb');
            
            // Subscribe to notifications
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleAudioData.bind(this));
            
            this.isConnected = true;
            this.notificationManager.success('Connected to host device');
            
            // Start monitoring connection
            this.startConnectionMonitoring();
        } catch (error) {
            console.error('Connection failed:', error);
            if (error.message.includes('User cancelled')) {
                this.notificationManager.info('Bluetooth device selection cancelled');
            } else {
                this.notificationManager.error('Failed to connect: ' + error.message);
            }
            throw error;
        }
    }

    /**
     * Starts monitoring connection quality
     * @private
     */
    startConnectionMonitoring() {
        if (!this.device) return;

        // Monitor connection status
        this.device.addEventListener('gattserverdisconnected', () => {
            this.handleDisconnection();
        });

        // Monitor signal strength periodically
        this.rssiInterval = setInterval(async () => {
            try {
                if (this.device && this.device.gatt.connected) {
                    const rssi = await this.device.gatt.getRSSI();
                    this.performanceMonitor.updateSignalStrength(rssi);
                }
            } catch (error) {
                console.warn('Failed to get RSSI:', error);
            }
        }, 1000);
    }

    /**
     * Handles incoming audio data
     * @private
     * @param {Event} event - Bluetooth characteristic value changed event
     */
    handleAudioData(event) {
        if (!this.isReceiving) return;

        const value = event.target.value;
        const audioData = new Float32Array(value.buffer);
        
        // Process audio data through worklet
        if (this.audioWorklet) {
            this.audioWorklet.port.postMessage({
                type: 'audioData',
                data: audioData
            });
        }
    }

    /**
     * Handles device disconnection
     * @private
     */
    handleDisconnection() {
        this.isConnected = false;
        this.isReceiving = false;
        
        if (this.rssiInterval) {
            clearInterval(this.rssiInterval);
            this.rssiInterval = null;
        }

        this.performanceMonitor.updateConnectionStatus(false);
        this.notificationManager.warning('Disconnected from host device');
    }

    /**
     * Starts receiving audio
     */
    async startReceiving() {
        if (!this.isConnected) {
            throw new Error('Not connected to a host device');
        }

        try {
            await this.audioContext.resume();
            this.isReceiving = true;
            this.notificationManager.success('Started receiving audio');
        } catch (error) {
            console.error('Failed to start receiving:', error);
            this.notificationManager.error('Failed to start receiving audio');
            throw error;
        }
    }

    /**
     * Stops receiving audio
     */
    async stopReceiving() {
        this.isReceiving = false;
        try {
            await this.characteristic?.stopNotifications();
            this.notificationManager.success('Stopped receiving audio');
        } catch (error) {
            console.error('Failed to stop receiving:', error);
            this.notificationManager.error('Failed to stop receiving audio');
            throw error;
        }
    }

    /**
     * Sets the volume level
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Disconnects from the host device
     */
    async disconnect() {
        await this.stopReceiving();
        
        if (this.device?.gatt.connected) {
            await this.device.gatt.disconnect();
        }
        
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.isConnected = false;
        
        this.handleDisconnection();
    }

    /**
     * Cleans up resources
     */
    dispose() {
        this.disconnect();
        if (this.audioWorklet) {
            this.audioWorklet.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
    }
}

export default ReceiverController;
