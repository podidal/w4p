# Bluetooth Audio Broadcasting System

Transform your mobile devices into a network of Bluetooth speakers. This application allows a host to broadcast audio to multiple connected devices with minimal latency.

## Features

### Audio Broadcasting
- Real-time audio broadcasting via microphone
- Multiple compression levels for quality/performance balance
- Adaptive buffer management
- Low latency optimization

### Bluetooth Connectivity
- Multiple device connections
- Signal strength monitoring
- Connection quality indicators
- Automatic device discovery

### Performance Monitoring
- Real-time latency measurement
- Data rate tracking
- CPU usage monitoring
- Buffer health tracking
- Packet loss detection

### User Interface
- Simple and intuitive controls
- Quality settings management
- Performance metrics display
- Toast notifications for events

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

## Usage

### Host Mode
1. Click "Host Mode" button
2. Adjust audio quality settings as needed:
   - Sample Rate: Higher for better quality, lower for better performance
   - Buffer Size: Smaller for lower latency, larger for stability
   - Compression: None for best quality, High for best performance
3. Click "Start Broadcasting" to begin
4. Monitor performance metrics in real-time

### Receiver Mode
1. Click "Receiver Mode" button
2. Click "Search for Host" to discover available broadcasters
3. Monitor connection quality indicators
4. Enjoy synchronized audio playback

## Development Guidelines

### Code Structure
- Maximum file length: 200 lines
- One class/module per file
- Modular code structure

### Naming Conventions
- camelCase: variables, functions
- PascalCase: classes
- UPPER_SNAKE_CASE: constants

### Documentation
- JSDoc documentation for functions/classes
- Inline comments for complex logic
- Regular TODO review (see TODO.md)

## Performance Considerations
- Buffer size affects latency and stability
- Compression level affects quality and performance
- Monitor CPU usage and battery consumption
- Check network conditions for optimal settings

## Browser Support
- Chrome 56+
- Edge 79+
- Opera 43+
- Android Browser 119+

## License

MIT
