/**
 * Handles audio visualization for both host and receiver
 */
class AudioVisualizer {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isActive = false;
        this.animationFrame = null;
        
        this.options = {
            barWidth: options.barWidth || 2,
            barGap: options.barGap || 1,
            barMinHeight: options.barMinHeight || 2,
            smoothingTimeConstant: options.smoothingTimeConstant || 0.8,
            fftSize: options.fftSize || 256,
            primaryColor: options.primaryColor || '#2196F3',
            secondaryColor: options.secondaryColor || '#1976D2',
            backgroundColor: options.backgroundColor || 'transparent'
        };

        this.setupCanvas();
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * Sets up the canvas and its dimensions
     * @private
     */
    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
    }

    /**
     * Handles window resize events
     * @private
     */
    handleResize() {
        this.setupCanvas();
    }

    /**
     * Initializes the audio analyzer
     * @param {AudioContext} audioContext - The audio context to use
     * @param {MediaStreamAudioSourceNode} source - The audio source node
     */
    initialize(audioContext, source) {
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = this.options.fftSize;
        this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;
        
        source.connect(this.analyser);
        
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        
        this.isActive = true;
        this.draw();
    }

    /**
     * Draws the visualization
     * @private
     */
    draw() {
        if (!this.isActive) return;

        this.animationFrame = requestAnimationFrame(this.draw.bind(this));
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        const barCount = Math.min(this.bufferLength, Math.floor(width / (this.options.barWidth + this.options.barGap)));
        const barWidth = this.options.barWidth;
        const gap = this.options.barGap;
        
        for (let i = 0; i < barCount; i++) {
            const percent = this.dataArray[i] / 255;
            const barHeight = Math.max(
                this.options.barMinHeight,
                (height * percent)
            );
            
            const x = (barWidth + gap) * i;
            const y = height - barHeight;
            
            const gradient = this.ctx.createLinearGradient(x, y, x, height);
            gradient.addColorStop(0, this.options.primaryColor);
            gradient.addColorStop(1, this.options.secondaryColor);
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, y, barWidth, barHeight);
        }
    }

    /**
     * Updates the visualization options
     * @param {Object} newOptions - New options to apply
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Stops the visualization
     */
    stop() {
        this.isActive = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Clear the canvas
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        this.ctx.clearRect(0, 0, width, height);
    }
}

export default AudioVisualizer;
