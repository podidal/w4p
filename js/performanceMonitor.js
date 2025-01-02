/**
 * Monitors and optimizes system performance
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            audioLatency: new MovingAverage(50),
            bluetoothLatency: new MovingAverage(50),
            processingTime: new MovingAverage(50),
            batteryLevel: null,
            cpuUsage: new MovingAverage(10)
        };

        this.thresholds = {
            audioLatency: 100, // ms
            bluetoothLatency: 200, // ms
            processingTime: 50, // ms
            batteryLevel: 0.2 // 20%
        };

        this.listeners = new Set();
        this.isMonitoring = false;
    }

    /**
     * Starts performance monitoring
     */
    start() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        // Monitor battery level
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                this.metrics.batteryLevel = battery.level;
                battery.addEventListener('levelchange', () => {
                    this.metrics.batteryLevel = battery.level;
                    this.checkThresholds();
                });
            });
        }

        // Start periodic monitoring
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
        }, 1000);
    }

    /**
     * Updates performance metrics
     * @private
     */
    updateMetrics() {
        // Update CPU usage
        if ('performance' in window) {
            const cpuUsage = performance.now() % 100; // Simplified CPU usage estimation
            this.metrics.cpuUsage.add(cpuUsage);
        }

        this.checkThresholds();
        this.notifyListeners();
    }

    /**
     * Adds a new latency measurement
     * @param {string} type - Type of latency ('audio' or 'bluetooth')
     * @param {number} value - Latency value in milliseconds
     */
    addLatencyMeasurement(type, value) {
        switch (type) {
            case 'audio':
                this.metrics.audioLatency.add(value);
                break;
            case 'bluetooth':
                this.metrics.bluetoothLatency.add(value);
                break;
        }
        this.checkThresholds();
    }

    /**
     * Adds processing time measurement
     * @param {number} time - Processing time in milliseconds
     */
    addProcessingTime(time) {
        this.metrics.processingTime.add(time);
        this.checkThresholds();
    }

    /**
     * Checks if any metrics exceed their thresholds
     * @private
     */
    checkThresholds() {
        const alerts = [];

        if (this.metrics.audioLatency.average() > this.thresholds.audioLatency) {
            alerts.push({
                type: 'warning',
                message: 'High audio latency detected',
                value: this.metrics.audioLatency.average()
            });
        }

        if (this.metrics.bluetoothLatency.average() > this.thresholds.bluetoothLatency) {
            alerts.push({
                type: 'warning',
                message: 'High Bluetooth latency detected',
                value: this.metrics.bluetoothLatency.average()
            });
        }

        if (this.metrics.processingTime.average() > this.thresholds.processingTime) {
            alerts.push({
                type: 'warning',
                message: 'High processing time detected',
                value: this.metrics.processingTime.average()
            });
        }

        if (this.metrics.batteryLevel !== null && 
            this.metrics.batteryLevel < this.thresholds.batteryLevel) {
            alerts.push({
                type: 'warning',
                message: 'Low battery level',
                value: this.metrics.batteryLevel
            });
        }

        if (alerts.length > 0) {
            this.notifyListeners({ type: 'alerts', alerts });
        }
    }

    /**
     * Adds a performance update listener
     * @param {Function} listener - Callback function for updates
     */
    addListener(listener) {
        this.listeners.add(listener);
    }

    /**
     * Removes a performance update listener
     * @param {Function} listener - Callback function to remove
     */
    removeListener(listener) {
        this.listeners.delete(listener);
    }

    /**
     * Notifies all listeners of performance updates
     * @private
     */
    notifyListeners() {
        const update = {
            audioLatency: this.metrics.audioLatency.average(),
            bluetoothLatency: this.metrics.bluetoothLatency.average(),
            processingTime: this.metrics.processingTime.average(),
            batteryLevel: this.metrics.batteryLevel,
            cpuUsage: this.metrics.cpuUsage.average()
        };

        this.listeners.forEach(listener => {
            try {
                listener(update);
            } catch (error) {
                console.error('Error in performance listener:', error);
            }
        });
    }

    /**
     * Stops performance monitoring
     */
    stop() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}

/**
 * Calculates moving average for performance metrics
 */
class MovingAverage {
    constructor(size) {
        this.size = size;
        this.values = [];
        this.sum = 0;
    }

    add(value) {
        this.values.push(value);
        this.sum += value;
        
        if (this.values.length > this.size) {
            this.sum -= this.values.shift();
        }
    }

    average() {
        return this.values.length === 0 ? 0 : this.sum / this.values.length;
    }
}

export default PerformanceMonitor;
