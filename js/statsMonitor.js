/**
 * Monitors and reports system performance metrics
 */
class StatsMonitor {
    constructor() {
        this.metrics = {
            latency: 0,
            dataRate: 0,
            cpuUsage: 0,
            packetLoss: 0,
            signalStrength: 0,
            bufferHealth: 100
        };
        
        this.lastUpdateTime = performance.now();
        this.totalBytesTransferred = 0;
        this.updateInterval = null;
    }

    /**
     * Start monitoring performance metrics
     */
    startMonitoring() {
        this.updateInterval = setInterval(() => this.updateUI(), 1000);
    }

    /**
     * Stop monitoring performance metrics
     */
    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Record data transfer for calculating data rate
     * @param {number} bytes Number of bytes transferred
     */
    recordDataTransfer(bytes) {
        this.totalBytesTransferred += bytes;
    }

    /**
     * Update latency measurement
     * @param {number} latency Measured latency in milliseconds
     */
    updateLatency(latency) {
        this.metrics.latency = latency;
    }

    /**
     * Update signal strength measurement
     * @param {number} strength Signal strength as a percentage
     */
    updateSignalStrength(strength) {
        this.metrics.signalStrength = Math.max(0, Math.min(100, strength));
    }

    /**
     * Update buffer health measurement
     * @param {number} health Buffer health as a percentage
     */
    updateBufferHealth(health) {
        this.metrics.bufferHealth = Math.max(0, Math.min(100, health));
    }

    /**
     * Update packet loss measurement
     * @param {number} loss Packet loss as a percentage
     */
    updatePacketLoss(loss) {
        this.metrics.packetLoss = loss;
    }

    /**
     * Calculate current data rate
     * @returns {number} Data rate in KB/s
     */
    calculateDataRate() {
        const now = performance.now();
        const timeDiff = (now - this.lastUpdateTime) / 1000; // Convert to seconds
        const dataRate = this.totalBytesTransferred / timeDiff / 1024; // Convert to KB/s
        
        // Reset for next calculation
        this.totalBytesTransferred = 0;
        this.lastUpdateTime = now;
        
        return dataRate;
    }

    /**
     * Update UI elements with current metrics
     */
    updateUI() {
        // Update data rate
        this.metrics.dataRate = this.calculateDataRate();
        
        // Update CPU usage (if available)
        if (window.performance && performance.memory) {
            this.metrics.cpuUsage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
        }

        // Update UI elements
        document.getElementById('latencyValue').textContent = `${Math.round(this.metrics.latency)} ms`;
        document.getElementById('dataRateValue').textContent = `${Math.round(this.metrics.dataRate)} KB/s`;
        document.getElementById('cpuUsageValue').textContent = `${Math.round(this.metrics.cpuUsage)}%`;
        
        // Update connection quality indicators
        const signalStrength = document.getElementById('signalStrength');
        if (signalStrength) {
            signalStrength.style.width = `${this.metrics.signalStrength}%`;
            this.updateProgressBarColor(signalStrength, this.metrics.signalStrength);
        }

        const bufferHealth = document.getElementById('bufferHealth');
        if (bufferHealth) {
            bufferHealth.style.width = `${this.metrics.bufferHealth}%`;
            this.updateProgressBarColor(bufferHealth, this.metrics.bufferHealth);
        }

        const packetLoss = document.getElementById('packetLoss');
        if (packetLoss) {
            packetLoss.textContent = `${Math.round(this.metrics.packetLoss)}%`;
        }
    }

    /**
     * Update progress bar color based on value
     * @param {HTMLElement} element Progress bar element
     * @param {number} value Current value
     */
    updateProgressBarColor(element, value) {
        element.classList.remove('bg-success', 'bg-warning', 'bg-danger');
        
        if (value >= 70) {
            element.classList.add('bg-success');
        } else if (value >= 30) {
            element.classList.add('bg-warning');
        } else {
            element.classList.add('bg-danger');
        }
    }
}

// Export the monitor
window.StatsMonitor = StatsMonitor;
