/**
 * Monitors and reports system performance metrics
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            audioLatency: 0,
            bluetoothLatency: 0,
            cpuUsage: 0,
            batteryLevel: 100,
            signalStrength: 0
        };

        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.audioStartTime = 0;
        this.latencyBuffer = [];
        this.maxLatencyBufferSize = 50;
        this.latencyThreshold = 200; // milliseconds
        
        // Initialize battery monitoring if available
        if (navigator.getBattery) {
            this.initializeBatteryMonitoring();
        }
    }

    /**
     * Starts monitoring audio performance
     */
    startAudioMonitoring() {
        this.audioStartTime = performance.now();
        this.isMonitoring = true;
        this.startPerformanceMonitoring();
    }

    /**
     * Stops audio performance monitoring
     */
    stopAudioMonitoring() {
        this.isMonitoring = false;
        this.audioStartTime = 0;
        this.latencyBuffer = [];
        this.stopPerformanceMonitoring();
    }

    /**
     * Updates audio latency measurements
     * @param {number} latency - Measured latency in milliseconds
     */
    updateLatency(latency) {
        // Add to rolling buffer
        this.latencyBuffer.push(latency);
        if (this.latencyBuffer.length > this.maxLatencyBufferSize) {
            this.latencyBuffer.shift();
        }

        // Calculate average latency
        const avgLatency = this.latencyBuffer.reduce((a, b) => a + b, 0) / this.latencyBuffer.length;
        this.metrics.audioLatency = avgLatency;

        // Check if latency exceeds threshold
        if (avgLatency > this.latencyThreshold) {
            this.dispatchAlert({
                type: 'warning',
                message: 'High audio latency detected',
                value: avgLatency
            });
        }

        this.updateMetricsDisplay();
    }

    /**
     * Updates Bluetooth connection metrics
     * @param {boolean} isConnected - Connection status
     */
    updateConnectionStatus(isConnected) {
        if (!isConnected) {
            this.metrics.signalStrength = 0;
            this.metrics.bluetoothLatency = 0;
        }
        this.updateMetricsDisplay();
    }

    /**
     * Updates signal strength measurement
     * @param {number} rssi - RSSI value in dBm
     */
    updateSignalStrength(rssi) {
        // Convert RSSI to percentage (-100 dBm to -50 dBm range)
        const signalStrength = Math.min(100, Math.max(0, 2 * (rssi + 100)));
        this.metrics.signalStrength = signalStrength;

        // Alert on poor signal strength
        if (signalStrength < 30) {
            this.dispatchAlert({
                type: 'warning',
                message: 'Poor signal strength',
                value: signalStrength
            });
        }

        this.updateMetricsDisplay();
    }

    /**
     * Updates Bluetooth latency measurement
     * @param {number} latency - Measured latency in milliseconds
     */
    updateBluetoothLatency(latency) {
        this.metrics.bluetoothLatency = latency;
        
        if (latency > 100) {
            this.dispatchAlert({
                type: 'warning',
                message: 'High Bluetooth latency',
                value: latency
            });
        }

        this.updateMetricsDisplay();
    }

    /**
     * Initializes battery monitoring
     * @private
     */
    async initializeBatteryMonitoring() {
        try {
            const battery = await navigator.getBattery();
            
            const updateBattery = () => {
                this.metrics.batteryLevel = battery.level * 100;
                this.updateMetricsDisplay();

                if (battery.level < 0.2 && !battery.charging) {
                    this.dispatchAlert({
                        type: 'warning',
                        message: 'Low battery',
                        value: this.metrics.batteryLevel
                    });
                }
            };

            battery.addEventListener('levelchange', updateBattery);
            battery.addEventListener('chargingchange', updateBattery);
            updateBattery();
        } catch (error) {
            console.warn('Battery monitoring not available:', error);
        }
    }

    /**
     * Starts continuous performance monitoring
     * @private
     */
    startPerformanceMonitoring() {
        if (this.monitoringInterval) return;

        this.monitoringInterval = setInterval(() => {
            this.updateCPUUsage();
        }, 2000);
    }

    /**
     * Stops continuous performance monitoring
     * @private
     */
    stopPerformanceMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Updates CPU usage measurement
     * @private
     */
    async updateCPUUsage() {
        if (!this.isMonitoring) return;

        try {
            const currentTime = performance.now();
            const timeDiff = currentTime - this.lastCPUCheck;
            
            if (timeDiff > 1000) { // Check every second
                const usage = await this.measureCPUUsage();
                this.metrics.cpuUsage = usage;

                if (usage > 80) {
                    this.dispatchAlert({
                        type: 'warning',
                        message: 'High CPU usage',
                        value: usage
                    });
                }

                this.lastCPUCheck = currentTime;
                this.updateMetricsDisplay();
            }
        } catch (error) {
            console.warn('CPU monitoring error:', error);
        }
    }

    /**
     * Measures current CPU usage
     * @private
     * @returns {Promise<number>} CPU usage percentage
     */
    async measureCPUUsage() {
        if (!window.performance || !performance.memory) {
            return 0;
        }

        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.totalJSHeapSize;
        return Math.round((used / total) * 100);
    }

    /**
     * Updates the metrics display in the UI
     * @private
     */
    updateMetricsDisplay() {
        // Update latency display
        const latencyValue = document.querySelector('.latency-value');
        if (latencyValue) {
            latencyValue.textContent = `${Math.round(this.metrics.audioLatency)}ms`;
        }

        // Update signal strength display
        const signalValue = document.querySelector('.signal-value');
        if (signalValue) {
            signalValue.textContent = `${Math.round(this.metrics.signalStrength)}%`;
        }

        // Update CPU usage display
        const cpuValue = document.querySelector('.cpu-value');
        if (cpuValue) {
            cpuValue.textContent = `${Math.round(this.metrics.cpuUsage)}%`;
        }

        // Update battery level display
        const batteryValue = document.querySelector('.battery-value');
        if (batteryValue) {
            batteryValue.textContent = `${Math.round(this.metrics.batteryLevel)}%`;
        }
    }

    /**
     * Dispatches a performance alert
     * @private
     * @param {Object} alert - Alert details
     */
    dispatchAlert(alert) {
        window.dispatchEvent(new CustomEvent('performance:alert', {
            detail: alert
        }));
    }

    /**
     * Gets current performance metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
}

export default PerformanceMonitor;
