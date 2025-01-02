import AudioController from './audioController.js';
import BluetoothController from './bluetoothController.js';
import PerformanceMonitor from './performanceMonitor.js';
import NotificationManager from './notificationManager.js';
import AudioVisualizer from './audioVisualizer.js';
import ReceiverController from './receiverController.js';

class App {
    constructor() {
        this.initializeComponents();
        this.setupEventListeners();
        this.currentRole = 'host'; // Default role
    }

    /**
     * Initializes app components
     * @private
     */
    async initializeComponents() {
        // Initialize managers and controllers
        this.notificationManager = new NotificationManager();
        this.performanceMonitor = new PerformanceMonitor();
        
        // Create audio context but don't start it yet
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });
        this.audioContext.suspend(); // Suspend until user interaction
        
        // Initialize controllers
        this.audioController = new AudioController(
            this.audioContext,
            this.notificationManager,
            this.performanceMonitor
        );
        
        this.bluetoothController = new BluetoothController(
            this.notificationManager,
            this.performanceMonitor
        );
        
        this.receiverController = new ReceiverController(
            this.audioContext,
            this.notificationManager,
            this.performanceMonitor
        );

        // Initialize visualizers
        this.hostVisualizer = new AudioVisualizer('micVisualizer', {
            primaryColor: '#2196F3',
            secondaryColor: '#1976D2'
        });
        
        this.receiverVisualizer = new AudioVisualizer('receiverVisualizer', {
            primaryColor: '#4CAF50',
            secondaryColor: '#388E3C'
        });

        // Add overlay for first interaction
        this.showStartOverlay();
    }

    /**
     * Shows an overlay to capture first user interaction
     * @private
     */
    showStartOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'start-overlay';
        overlay.innerHTML = `
            <div class="start-content">
                <h2>Welcome to Bluetooth Audio Broadcasting</h2>
                <p>Click anywhere to start the application</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Handle click to start
        overlay.addEventListener('click', async () => {
            try {
                await this.audioContext.resume();
                overlay.remove();
                this.notificationManager.success('Audio system initialized');
            } catch (error) {
                console.error('Failed to start audio context:', error);
                this.notificationManager.error('Failed to initialize audio system');
            }
        });
    }

    /**
     * Sets up event listeners for UI controls
     * @private
     */
    setupEventListeners() {
        // Role selection
        document.getElementById('hostBtn').addEventListener('click', () => this.switchRole('host'));
        document.getElementById('receiverBtn').addEventListener('click', () => this.switchRole('receiver'));

        // Host controls
        document.getElementById('startBroadcast').addEventListener('click', () => this.toggleBroadcast());
        document.getElementById('toggleMic').addEventListener('click', () => this.toggleMicrophone());
        document.getElementById('broadcastVolume').addEventListener('input', (e) => this.setHostVolume(e.target.value));
        document.getElementById('audioQuality').addEventListener('change', (e) => this.setAudioQuality(e.target.value));

        // Receiver controls
        document.getElementById('startListening').addEventListener('click', () => this.toggleReceiver());
        document.getElementById('receiverVolume').addEventListener('input', (e) => this.setReceiverVolume(e.target.value));
    }

    /**
     * Switches between host and receiver roles
     * @param {string} role - The role to switch to ('host' or 'receiver')
     */
    async switchRole(role) {
        // Clean up current role
        await this.cleanup();

        this.currentRole = role;
        document.getElementById('hostBtn').classList.toggle('active', role === 'host');
        document.getElementById('receiverBtn').classList.toggle('active', role === 'receiver');
        document.getElementById('hostInterface').classList.toggle('hidden', role !== 'host');
        document.getElementById('receiverInterface').classList.toggle('hidden', role !== 'receiver');

        this.notificationManager.success(`Switched to ${role} mode`);
    }

    /**
     * Toggles broadcasting state
     */
    async toggleBroadcast() {
        const button = document.getElementById('startBroadcast');
        const isStarting = button.textContent.includes('Start');

        try {
            if (isStarting) {
                await this.audioController.startBroadcasting();
                button.innerHTML = '<i class="fas fa-stop"></i><span>Stop Broadcasting</span>';
                this.hostVisualizer.initialize(this.audioContext, this.audioController.getSourceNode());
            } else {
                await this.audioController.stopBroadcasting();
                button.innerHTML = '<i class="fas fa-play"></i><span>Start Broadcasting</span>';
                this.hostVisualizer.stop();
            }
        } catch (error) {
            this.notificationManager.error('Failed to toggle broadcasting');
            console.error('Broadcasting error:', error);
        }
    }

    /**
     * Toggles receiver state
     */
    async toggleReceiver() {
        const button = document.getElementById('startListening');
        const isStarting = button.textContent.includes('Connect');

        try {
            if (isStarting) {
                await this.receiverController.connect();
                await this.receiverController.startPlaying();
                button.innerHTML = '<i class="fas fa-stop"></i><span>Disconnect</span>';
                this.receiverVisualizer.initialize(this.audioContext, this.receiverController.audioWorklet);
            } else {
                await this.receiverController.disconnect();
                button.innerHTML = '<i class="fas fa-search"></i><span>Connect to Host</span>';
                this.receiverVisualizer.stop();
            }
        } catch (error) {
            this.notificationManager.error('Failed to toggle receiver');
            console.error('Receiver error:', error);
        }
    }

    /**
     * Toggles microphone state
     */
    async toggleMicrophone() {
        const button = document.getElementById('toggleMic');
        try {
            const isMuted = await this.audioController.toggleMicrophone();
            button.innerHTML = `<i class="fas fa-microphone${isMuted ? '-slash' : ''}"></i>
                              <span>Microphone ${isMuted ? 'Off' : 'On'}</span>`;
        } catch (error) {
            this.notificationManager.error('Failed to toggle microphone');
            console.error('Microphone error:', error);
        }
    }

    /**
     * Sets the host volume
     * @param {number} value - Volume value (0-100)
     */
    setHostVolume(value) {
        const volume = value / 100;
        this.audioController.setVolume(volume);
        document.querySelector('#broadcastVolume + .volume-value').textContent = `${value}%`;
    }

    /**
     * Sets the receiver volume
     * @param {number} value - Volume value (0-100)
     */
    setReceiverVolume(value) {
        const volume = value / 100;
        this.receiverController.setVolume(volume);
        document.querySelector('#receiverVolume + .volume-value').textContent = `${value}%`;
    }

    /**
     * Sets the audio quality
     * @param {string} quality - Quality level ('high', 'medium', 'low')
     */
    setAudioQuality(quality) {
        this.audioController.setQuality(quality);
        this.notificationManager.success(`Audio quality set to ${quality}`);
    }

    /**
     * Cleans up resources
     * @private
     */
    async cleanup() {
        if (this.currentRole === 'host') {
            await this.audioController.stopBroadcasting();
            this.hostVisualizer.stop();
        } else {
            await this.receiverController.disconnect();
            this.receiverVisualizer.stop();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
