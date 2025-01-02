class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.volume = 1.0;
        this.lastProcessTime = currentTime;
        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage(event) {
        if (event.data.type === 'volume') {
            this.volume = event.data.value;
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !input[0]) return true;

        // Process audio data
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        // Apply volume and process audio
        for (let i = 0; i < inputChannel.length; i++) {
            outputChannel[i] = inputChannel[i] * this.volume;
        }

        // Calculate and report latency
        const currentLatency = currentTime - this.lastProcessTime;
        this.port.postMessage({ type: 'latency', value: currentLatency });
        this.lastProcessTime = currentTime;

        // Send processed audio data back to main thread
        this.port.postMessage({
            type: 'processedAudio',
            buffer: outputChannel
        });

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
