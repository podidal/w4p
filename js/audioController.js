/**
 * Handles audio capture and broadcasting
 */
class AudioController {
    constructor(audioContext, notificationManager, performanceMonitor) {
        this.audioContext = audioContext;
        this.notificationManager = notificationManager;
        this.performanceMonitor = performanceMonitor;
        this.mediaStream = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.audioWorklet = null;
        this.isBroadcasting = false;
        this.isMuted = false;
        this.quality = 'medium';
        
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

        try {
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
            console.error('Failed to load audio worklet:', error);
            this.notificationManager.error('Failed to initialize audio processing');
        }
    }

    /**
     * Starts broadcasting audio
     */
    async startBroadcasting() {
        if (this.isBroadcasting) return;

        try {
            await this.audioContext.resume();
            
            // Get microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create and connect source node
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.sourceNode.connect(this.audioWorklet);

            this.isBroadcasting = true;
            this.notificationManager.success('Started broadcasting');
            
            // Start performance monitoring
            this.performanceMonitor.startAudioMonitoring();
        } catch (error) {
            console.error('Broadcasting failed:', error);
            this.notificationManager.error('Failed to start broadcasting');
            throw error;
        }
    }

    /**
     * Stops broadcasting audio
     */
    async stopBroadcasting() {
        if (!this.isBroadcasting) return;

        // Stop all tracks in the media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Disconnect nodes
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        this.isBroadcasting = false;
        this.notificationManager.success('Stopped broadcasting');
        this.performanceMonitor.stopAudioMonitoring();
    }

    /**
     * Toggles microphone mute state
     * @returns {boolean} New mute state
     */
    async toggleMicrophone() {
        this.isMuted = !this.isMuted;
        
        if (this.gainNode) {
            this.gainNode.gain.value = this.isMuted ? 0 : 1;
        }

        return this.isMuted;
    }

    /**
     * Sets the broadcasting volume
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Sets the audio quality
     * @param {string} quality - Quality level ('high', 'medium', 'low')
     */
    setQuality(quality) {
        this.quality = quality;
        if (this.audioWorklet) {
            this.audioWorklet.port.postMessage({
                type: 'setQuality',
                quality: quality
            });
        }
    }

    /**
     * Gets the audio source node
     * @returns {MediaStreamAudioSourceNode}
     */
    getSourceNode() {
        return this.sourceNode;
    }

    /**
     * Cleans up resources
     */
    dispose() {
        this.stopBroadcasting();
        if (this.audioWorklet) {
            this.audioWorklet.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
    }
}

export default AudioController;
