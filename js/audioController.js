/**
 * Handles audio capture and processing for the broadcasting system
 */
class AudioController {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaStreamSource = null;
        this.audioProcessor = null;
        this.isInitialized = false;
        this.volume = 1.0;
        this.latencyData = new Map();
        this.bufferSize = 4096; // Adjustable based on latency requirements
        this.sampleRate = 48000; // High-quality audio
        this.recordingStartTime = 0;
    }

    /**
     * Initializes the audio context and sets up audio processing
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: this.sampleRate
            });
            
            // Create audio worklet for efficient processing
            await this.audioContext.audioWorklet.addModule('js/audioWorklet.js');
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            throw new Error('Audio system initialization failed');
        }
    }

    /**
     * Starts microphone capture with optimized settings
     * @returns {Promise<void>}
     */
    async startMicrophone() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1, // Mono for bandwidth efficiency
                    sampleRate: this.sampleRate,
                    latency: 0.01 // Request minimal latency
                }
            });

            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.setupAudioProcessing();
            this.recordingStartTime = this.audioContext.currentTime;
        } catch (error) {
            console.error('Failed to start microphone:', error);
            throw new Error('Microphone access failed');
        }
    }

    /**
     * Sets up optimized audio processing pipeline
     * @private
     */
    setupAudioProcessing() {
        // Create audio worklet node for efficient processing
        this.audioProcessor = new AudioWorkletNode(this.audioContext, 'audio-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            processorOptions: {
                bufferSize: this.bufferSize
            }
        });

        // Handle processed audio data
        this.audioProcessor.port.onmessage = (event) => {
            if (event.data.type === 'processedAudio') {
                this.handleProcessedAudio(event.data.buffer);
            } else if (event.data.type === 'latency') {
                this.updateLatency(event.data.value);
            }
        };

        // Connect audio nodes
        this.mediaStreamSource.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioContext.destination);
    }

    /**
     * Handles processed audio data and prepares it for transmission
     * @private
     * @param {Float32Array} buffer - Processed audio buffer
     */
    handleProcessedAudio(buffer) {
        // Calculate current latency
        const currentLatency = this.audioContext.currentTime - this.recordingStartTime;
        
        // Compress audio data for efficient transmission
        const compressedData = this.compressAudioData(buffer);
        
        // Dispatch audio data with timestamp for synchronization
        const audioPacket = {
            timestamp: this.audioContext.currentTime,
            data: compressedData,
            latency: currentLatency
        };

        // Dispatch event with processed audio data
        this.dispatchEvent('audioProcessed', audioPacket);
    }

    /**
     * Compresses audio data for efficient transmission
     * @private
     * @param {Float32Array} buffer - Raw audio buffer
     * @returns {Uint8Array} Compressed audio data
     */
    compressAudioData(buffer) {
        // Convert to 16-bit PCM for better compression
        const pcmData = new Int16Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, buffer[i] * 32768));
        }

        // Apply basic compression (implement more sophisticated compression if needed)
        return new Uint8Array(pcmData.buffer);
    }

    /**
     * Updates latency measurements
     * @private
     * @param {number} latency - Measured latency in seconds
     */
    updateLatency(latency) {
        const timestamp = Date.now();
        this.latencyData.set(timestamp, latency);
        
        // Keep only recent measurements
        const oldestAllowed = timestamp - 5000; // Last 5 seconds
        for (const [key] of this.latencyData) {
            if (key < oldestAllowed) {
                this.latencyData.delete(key);
            }
        }

        // Calculate average latency
        const avgLatency = Array.from(this.latencyData.values())
            .reduce((sum, val) => sum + val, 0) / this.latencyData.size;

        this.dispatchEvent('latencyUpdate', { average: avgLatency });
    }

    /**
     * Sets the output volume with smooth transition
     * @param {number} value - Volume level (0-1)
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.audioProcessor) {
            this.audioProcessor.port.postMessage({ type: 'volume', value: this.volume });
        }
    }

    /**
     * Dispatches custom events
     * @private
     * @param {string} type - Event type
     * @param {Object} detail - Event details
     */
    dispatchEvent(type, detail) {
        window.dispatchEvent(new CustomEvent(`audio:${type}`, { detail }));
    }

    /**
     * Stops all audio processing and releases resources
     */
    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
            this.mediaStreamSource = null;
        }

        this.latencyData.clear();
        this.recordingStartTime = 0;
    }
}

export default AudioController;
