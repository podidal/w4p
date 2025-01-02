/**
 * Handles audio capture and processing
 */
class AudioController {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.audioSource = null;
        this.processor = null;
        this.isInitialized = false;
        this.onAudioData = null;
        
        // Audio quality settings
        this.settings = {
            sampleRate: 44100,
            bufferSize: 4096,
            compression: 'medium'
        };
        
        // Performance monitoring
        this.lastProcessingTime = 0;
        this.bufferQueue = [];
        this.maxBufferSize = 10;
    }

    /**
     * Update audio quality settings
     * @param {Object} settings New settings object
     */
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        
        if (this.isInitialized) {
            // Reinitialize audio context with new settings
            this.stopCapture();
            this.initialize();
        }
    }

    /**
     * Initialize the audio context and request microphone permissions
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: this.settings.sampleRate
            });
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.settings.sampleRate
                }
            });
            
            this.mediaStream = stream;
            this.audioSource = this.audioContext.createMediaStreamSource(stream);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Audio initialization failed:', error);
            throw new Error(`Audio initialization failed: ${error.message}`);
        }
    }

    /**
     * Start audio capture and processing
     * @param {Function} onAudioData Callback for processed audio data
     * @returns {Promise<void>}
     */
    async startCapture(onAudioData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        this.onAudioData = onAudioData;
        this.processor = this.audioContext.createScriptProcessor(
            this.settings.bufferSize,
            1, // Input channels
            1  // Output channels
        );
        
        this.processor.onaudioprocess = (e) => {
            const startTime = performance.now();
            const inputBuffer = e.inputBuffer.getChannelData(0);
            
            // Process and compress audio data
            const compressedData = this.processAudioData(inputBuffer);
            
            // Calculate processing latency
            const processingTime = performance.now() - startTime;
            this.lastProcessingTime = processingTime;
            
            if (this.onAudioData) {
                this.onAudioData(compressedData);
            }
            
            // Update buffer health
            this.updateBufferHealth();
        };

        this.audioSource.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    /**
     * Process and compress audio data based on quality settings
     * @param {Float32Array} audioData Raw audio data
     * @returns {Uint8Array} Processed audio data
     */
    processAudioData(audioData) {
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            const s = Math.max(-1, Math.min(1, audioData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        let processedData = new Uint8Array(pcmData.buffer);
        
        // Apply compression based on settings
        switch (this.settings.compression) {
            case 'high':
                processedData = this.highCompression(processedData);
                break;
            case 'medium':
                processedData = this.mediumCompression(processedData);
                break;
            case 'low':
                processedData = this.lowCompression(processedData);
                break;
            // 'none' requires no additional processing
        }
        
        return processedData;
    }

    /**
     * High compression (reduces quality but minimizes data)
     * @param {Uint8Array} data Input data
     * @returns {Uint8Array} Compressed data
     */
    highCompression(data) {
        // Implement high compression (e.g., downsampling by 4)
        const compressed = new Uint8Array(Math.ceil(data.length / 4));
        for (let i = 0; i < compressed.length; i++) {
            compressed[i] = data[i * 4];
        }
        return compressed;
    }

    /**
     * Medium compression (balanced approach)
     * @param {Uint8Array} data Input data
     * @returns {Uint8Array} Compressed data
     */
    mediumCompression(data) {
        // Implement medium compression (e.g., downsampling by 2)
        const compressed = new Uint8Array(Math.ceil(data.length / 2));
        for (let i = 0; i < compressed.length; i++) {
            compressed[i] = data[i * 2];
        }
        return compressed;
    }

    /**
     * Low compression (preserves quality)
     * @param {Uint8Array} data Input data
     * @returns {Uint8Array} Compressed data
     */
    lowCompression(data) {
        // Implement low compression (e.g., basic quantization)
        const compressed = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            compressed[i] = Math.round(data[i] / 2) * 2;
        }
        return compressed;
    }

    /**
     * Update buffer health metrics
     */
    updateBufferHealth() {
        // Add current buffer to queue
        this.bufferQueue.push(performance.now());
        
        // Remove old buffers
        while (this.bufferQueue.length > this.maxBufferSize) {
            this.bufferQueue.shift();
        }
        
        // Calculate buffer health based on timing consistency
        if (this.bufferQueue.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.bufferQueue.length; i++) {
                intervals.push(this.bufferQueue[i] - this.bufferQueue[i - 1]);
            }
            
            // Calculate standard deviation of intervals
            const mean = intervals.reduce((a, b) => a + b) / intervals.length;
            const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
            const stdDev = Math.sqrt(variance);
            
            // Convert to a health percentage (lower stdDev = better health)
            const maxAcceptableStdDev = 50; // milliseconds
            const health = Math.max(0, Math.min(100, 100 * (1 - stdDev / maxAcceptableStdDev)));
            
            // Update UI via StatsMonitor
            if (window.statsMonitor) {
                window.statsMonitor.updateBufferHealth(health);
            }
        }
    }

    /**
     * Get current processing latency
     * @returns {number} Processing latency in milliseconds
     */
    getProcessingLatency() {
        return this.lastProcessingTime;
    }

    /**
     * Process incoming audio data for playback
     * @param {Uint8Array} compressedData Compressed audio data
     * @returns {Float32Array} Processed audio data
     */
    processReceivedAudio(compressedData) {
        // Decompress based on current compression setting
        let decompressedData = compressedData;
        switch (this.settings.compression) {
            case 'high':
                decompressedData = this.decompressHigh(compressedData);
                break;
            case 'medium':
                decompressedData = this.decompressMedium(compressedData);
                break;
            case 'low':
                decompressedData = this.decompressLow(compressedData);
                break;
        }
        
        const pcmData = new Int16Array(decompressedData.buffer);
        const floatData = new Float32Array(pcmData.length);
        
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] < 0 ? pcmData[i] / 0x8000 : pcmData[i] / 0x7FFF;
        }
        
        return floatData;
    }

    /**
     * Decompress high compression data
     * @param {Uint8Array} data Compressed data
     * @returns {Uint8Array} Decompressed data
     */
    decompressHigh(data) {
        const decompressed = new Uint8Array(data.length * 4);
        for (let i = 0; i < data.length; i++) {
            decompressed[i * 4] = data[i];
            decompressed[i * 4 + 1] = data[i];
            decompressed[i * 4 + 2] = data[i];
            decompressed[i * 4 + 3] = data[i];
        }
        return decompressed;
    }

    /**
     * Decompress medium compression data
     * @param {Uint8Array} data Compressed data
     * @returns {Uint8Array} Decompressed data
     */
    decompressMedium(data) {
        const decompressed = new Uint8Array(data.length * 2);
        for (let i = 0; i < data.length; i++) {
            decompressed[i * 2] = data[i];
            decompressed[i * 2 + 1] = data[i];
        }
        return decompressed;
    }

    /**
     * Decompress low compression data
     * @param {Uint8Array} data Compressed data
     * @returns {Uint8Array} Decompressed data
     */
    decompressLow(data) {
        const decompressed = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            decompressed[i] = data[i] * 2;
        }
        return decompressed;
    }

    /**
     * Play received audio data
     * @param {Uint8Array} compressedData Compressed audio data to play
     */
    async playAudio(compressedData) {
        if (!this.audioContext) {
            await this.initialize();
        }

        const startTime = performance.now();
        const audioData = this.processReceivedAudio(compressedData);
        const buffer = this.audioContext.createBuffer(1, audioData.length, this.settings.sampleRate);
        buffer.getChannelData(0).set(audioData);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start();

        // Update latency metrics
        const latency = performance.now() - startTime;
        if (window.statsMonitor) {
            window.statsMonitor.updateLatency(latency);
        }
    }

    /**
     * Stop audio capture
     */
    stopCapture() {
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.isInitialized = false;
        this.onAudioData = null;
        this.bufferQueue = [];
    }
}

// Export the controller
window.AudioController = AudioController;
