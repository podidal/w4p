/**
 * Handles receiving and playing audio from a host device
 */
class ReceiverController {
    constructor(audioContext, notificationManager, performanceMonitor) {
        this.audioContext = audioContext;
        this.notificationManager = notificationManager;
        this.performanceMonitor = performanceMonitor;
        this.isConnected = false;
        this.isPlaying = false;
        this.bluetoothDevice = null;
        this.characteristic = null;
        this.gainNode = null;
        this.audioWorklet = null;
        this.visualizer = null;
        this.setupAudioNodes();
    }

    /**
     * Sets up audio processing nodes
     * @private
     */
    async setupAudioNodes() {
        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        // Load audio worklet for processing
        try {
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
            console.error('Failed to load audio worklet:', error);
            this.notificationManager.error('Failed to initialize audio processing');
        }
    }

    /**
     * Starts searching for and connects to a host device
     */
    async connect() {
        try {
            // Request Bluetooth device with audio characteristic
            this.bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['audio_service'] }
                ]
            });

            // Handle device disconnection
            this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });

            // Connect to GATT server
            const server = await this.bluetoothDevice.gatt.connect();
            const service = await server.getPrimaryService('audio_service');
            this.characteristic = await service.getCharacteristic('audio_characteristic');

            // Start notifications for incoming audio data
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged',
                this.handleAudioData.bind(this));

            this.isConnected = true;
            this.notificationManager.success('Connected to host device');
            this.performanceMonitor.updateConnectionStatus(true);

            // Start monitoring signal strength
            this.startSignalStrengthMonitoring();
        } catch (error) {
            console.error('Connection failed:', error);
            this.notificationManager.error('Failed to connect to host device');
            throw error;
        }
    }

    /**
     * Handles incoming audio data from the host
     * @private
     * @param {Event} event - The characteristic value changed event
     */
    handleAudioData(event) {
        if (!this.isPlaying) return;

        const value = event.target.value;
        const audioData = new Float32Array(value.buffer);

        // Process audio data through worklet
        this.audioWorklet.port.postMessage({
            type: 'process',
            audioData: audioData,
            timestamp: performance.now()
        });

        // Update performance metrics
        this.performanceMonitor.updateAudioStats({
            bufferSize: audioData.length,
            timestamp: performance.now()
        });
    }

    /**
     * Starts monitoring Bluetooth signal strength
     * @private
     */
    startSignalStrengthMonitoring() {
        if (!this.bluetoothDevice) return;

        const monitorSignal = async () => {
            try {
                const signalStrength = await this.bluetoothDevice.gatt.getPrimaryService('generic_access')
                    .then(service => service.getCharacteristic('rssi'));
                
                const value = await signalStrength.readValue();
                const rssi = value.getInt8(0);
                
                this.performanceMonitor.updateSignalStrength(rssi);

                // Check for poor signal strength
                if (rssi < -80) {
                    this.notificationManager.warning('Poor connection quality');
                }
            } catch (error) {
                console.warn('Failed to read signal strength:', error);
            }
        };

        // Monitor signal strength every 2 seconds
        this.signalInterval = setInterval(monitorSignal, 2000);
    }

    /**
     * Sets the receiver volume
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Starts playing received audio
     */
    async startPlaying() {
        if (!this.isConnected) {
            this.notificationManager.warning('Not connected to a host device');
            return;
        }

        try {
            await this.audioContext.resume();
            this.isPlaying = true;
            this.notificationManager.success('Started playing audio');
        } catch (error) {
            console.error('Failed to start playback:', error);
            this.notificationManager.error('Failed to start audio playback');
        }
    }

    /**
     * Stops playing received audio
     */
    stopPlaying() {
        this.isPlaying = false;
        this.audioContext.suspend();
        this.notificationManager.success('Stopped playing audio');
    }

    /**
     * Handles device disconnection
     * @private
     */
    handleDisconnection() {
        this.isConnected = false;
        this.isPlaying = false;
        this.performanceMonitor.updateConnectionStatus(false);
        
        if (this.signalInterval) {
            clearInterval(this.signalInterval);
        }

        this.notificationManager.warning('Disconnected from host device');
    }

    /**
     * Disconnects from the host device
     */
    async disconnect() {
        if (this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
            await this.bluetoothDevice.gatt.disconnect();
        }
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
