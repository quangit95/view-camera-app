# View-Camera

A web application designed for tennis players to easily fetch and download highlight videos from Hikvision and Dahua NVR/DVR systems.

## Prerequisites

- **Node.js**: v16.x or later.
- **FFmpeg**: Must be installed on the system and available in the system PATH. 

### Installing FFmpeg
- **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) or use `winget install ffmpeg`.
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`

## Setup Instructions

1. Clone or download this repository.
2. Navigate to the project directory:
   ```bash
   cd D:\WEB\View-camera
   ```
3. Install Node modules:
   ```bash
   npm install
   ```
4. Configure your NVR details in `.env`.
   - Update `NVR_TYPE`, `NVR_IP`, `NVR_USERNAME`, and `NVR_PASSWORD`.
5. Start the server:
   ```bash
   node server.js
   ```
6. Open your browser and navigate to `http://localhost:3000`.

## Architecture
- **Backend**: Node.js + Express.js. Handles API requests and interfaces with `fluent-ffmpeg` to connect to NVR RTSP streams.
- **Frontend**: Vanilla JS, HTML5, Tailwind CSS. A mobile-first UI for selecting time ranges and downloading the extracted MP4s.
- **Storage**: Extracted videos are saved to `public/downloads/` and automatically cleaned up after 1 hour by a background interval task.

## Disclaimer
In the current code state, the `server.js` provides placeholders for the Dahua and Hikvision RTSP playback URLs. Ensure that the RTSP server is accessible and that the time formats match your specific NVR firmware expectations.
