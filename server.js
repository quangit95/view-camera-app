require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { request } = require('urllib');
const xml2js = require('xml2js');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const configPath = path.join(__dirname, 'config.json');

// Default config
let currentConfig = {
    nvrType: 'hikvision',
    nvrIp: '192.168.100.100',
    httpPort: '80',
    nvrPort: '554',
    nvrUsername: 'qatech',
    nvrPassword: 'QATech999'
};

// Load config if exists
if (fs.existsSync(configPath)) {
    try {
        const fileData = fs.readFileSync(configPath, 'utf8');
        currentConfig = { ...currentConfig, ...JSON.parse(fileData) };
    } catch (err) {
        console.error('Failed to load config.json:', err);
    }
}

// Function to save config
function saveConfig(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
}

const downloadsDir = path.join(__dirname, 'public', 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Config API Endpoints
app.get('/api/config', (req, res) => {
    // Send config without password for security on the frontend,
    // though the user might want to edit it. We'll send it back so they can see what is set.
    res.json(currentConfig);
});

app.post('/api/config', (req, res) => {
    try {
        saveConfig(req.body);
        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

app.post('/api/test-connection', (req, res) => {
    const { nvrType, nvrIp, nvrPort, nvrUsername, nvrPassword } = req.body;
    
    if (!nvrIp || !nvrUsername || !nvrPassword) {
        return res.status(400).json({ error: 'Missing required connection details' });
    }

    const auth = `${nvrUsername}:${nvrPassword}`;
    let rtspUrl = '';

    if (nvrType === 'dahua') {
        rtspUrl = `rtsp://${auth}@${nvrIp}:${nvrPort}/cam/realmonitor?channel=1&subtype=0`;
    } else {
        rtspUrl = `rtsp://${auth}@${nvrIp}:${nvrPort}/Streaming/channels/101`;
    }

    console.log(`Testing connection to: ${rtspUrl}`);

    ffmpeg.ffprobe(rtspUrl, (err, metadata) => {
        if (err) {
            console.error('Connection test failed:', err.message);
            // In a real scenario without an NVR this will fail.
            // For testing the UI behavior even if it fails we return the error.
            return res.status(400).json({ success: false, error: 'Connection failed: ' + err.message });
        }
        
        console.log('Connection test successful.');
        res.json({ success: true, message: 'Connection successful. NVR is reachable.' });
    });
});

app.get('/api/channels', async (req, res) => {
    const { nvrType, nvrIp, httpPort, nvrUsername, nvrPassword } = currentConfig;
    
    if (nvrType !== 'hikvision') {
        return res.status(400).json({ error: 'Auto-fetching channels is currently only supported for Hikvision.' });
    }

    const port = httpPort || '80';
    const url = `http://${nvrIp}:${port}/ISAPI/Streaming/channels`;
    
    try {
        console.log(`Fetching channels from: ${url}`);
        const response = await request(url, {
            digestAuth: `${nvrUsername}:${nvrPassword}`,
            timeout: 10000
        });

        if (response.status !== 200) {
            return res.status(response.status).json({ error: `NVR returned status ${response.status}` });
        }

        const xmlData = response.data.toString('utf8');
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlData);

        const channelList = result.StreamingChannelList?.StreamingChannel;
        let channels = [];
        
        if (Array.isArray(channelList)) {
            channels = channelList
                .filter(ch => ch.id.endsWith('01')) // Only show Main Stream channels
                .map(ch => ({
                    id: ch.id.substring(0, ch.id.length - 2), // Remove '01' to get actual channel number (e.g. '101' -> '1')
                    name: ch.channelName || `Channel ${ch.id.substring(0, ch.id.length - 2)}`
                }));
        } else if (channelList && channelList.id.endsWith('01')) {
            channels = [{
                id: channelList.id.substring(0, channelList.id.length - 2),
                name: channelList.channelName || `Channel ${channelList.id.substring(0, channelList.id.length - 2)}`
            }];
        }

        res.json({ success: true, channels });
    } catch (error) {
        console.error('Error fetching channels:', error.message);
        res.status(500).json({ error: 'Failed to fetch channels. Ensure HTTP port and credentials are correct.' });
    }
});

// Function to generate RTSP playback URL based on NVR type
function getRtspPlaybackUrl(channel, startTime, endTime) {
    const { nvrType, nvrUsername, nvrPassword, nvrIp, nvrPort } = currentConfig;
    const auth = `${nvrUsername}:${nvrPassword}`;
    const baseUrl = `rtsp://${auth}@${nvrIp}:${nvrPort}`;

    if (nvrType === 'dahua') {
        // Dahua format: rtsp://user:pass@ip:port/cam/playback?channel=1&starttime=2023_01_01_00_00_00&endtime=2023_01_01_00_10_00
        // Expected format: YYYY_MM_DD_HH_mm_ss
        const formatDahuaTime = (dateStr) => {
            const m = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
            if (m) {
                return `${m[1]}_${m[2]}_${m[3]}_${m[4]}_${m[5]}_${m[6]}`;
            }
            return dateStr;
        };
        const start = formatDahuaTime(startTime);
        const end = formatDahuaTime(endTime);
        return `${baseUrl}/cam/playback?channel=${channel}&starttime=${start}&endtime=${end}`;
    } else {
        // Hikvision format: rtsp://user:pass@ip:port/Streaming/tracks/101?starttime=20230101T000000Z&endtime=20230101T001000Z
        const trackId = `${channel}01`; // Assuming channel 1 maps to track 101
        return `${baseUrl}/Streaming/tracks/${trackId}?starttime=${startTime}&endtime=${endTime}`;
    }
}

function parseDatetime(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}Z`;
}

app.get('/api/stream', (req, res) => {
    const { channel, start, end, download } = req.query;

    if (!channel || !start || !end) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const startStr = parseDatetime(start);
    const endStr = parseDatetime(end);
    
    if (!startStr || !endStr) {
        return res.status(400).json({ error: 'Invalid date format' });
    }
    
    // Check if start time is before end time
    const startTimeParts = startStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
    const endTimeParts = endStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
    
    if (startTimeParts && endTimeParts) {
        const startDate = new Date(Date.UTC(startTimeParts[1], startTimeParts[2]-1, startTimeParts[3], startTimeParts[4], startTimeParts[5], startTimeParts[6]));
        const endDate = new Date(Date.UTC(endTimeParts[1], endTimeParts[2]-1, endTimeParts[3], endTimeParts[4], endTimeParts[5], endTimeParts[6]));
        
        if (startDate >= endDate) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }
    }

    const rtspUrl = getRtspPlaybackUrl(channel, startStr, endStr);
    console.log(`Streaming video from: ${rtspUrl}`);

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    
    if (download === '1') {
        const filename = `clip_ch${channel}_${Date.now()}.mp4`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
        res.setHeader('Content-Disposition', 'inline');
    }

    // Use empty_moov and frag_keyframe to enable progressive MP4 streaming over HTTP
    const command = ffmpeg(rtspUrl)
        .inputOptions([
            '-rtsp_transport tcp'
        ])
        .setStartTime(0) // Start from beginning of the provided RTSP playback window
        .outputOptions([
            '-c:v libx264', // Transcode to H.264 because Chrome doesn't support H.265 natively
            '-preset ultrafast', // Fast transcoding for streaming
            '-crf 28',
            '-c:a aac',  // Re-encode audio to AAC since pcm_mulaw isn't supported in MP4
            '-movflags frag_keyframe+empty_moov+default_base_moof', // Enable progressive streaming
            '-f mp4' // Force format
        ])
        .on('stderr', (stderrLine) => {
            console.log('ffmpeg: ' + stderrLine);
        })
        .on('end', () => {
            console.log(`Video streaming finished for channel ${channel}`);
        })
        .on('error', (err) => {
            if (err.message.includes('SIGKILL') || err.message.includes('Output stream closed')) {
                console.log('Stream closed by client, timeout, or manually killed');
            } else {
                console.error('Error processing video stream:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to extract video: ' + err.message });
                }
            }
        });

    // Detect if no data is received (e.g., no recording exists for this time)
    const { PassThrough } = require('stream');
    const pt = new PassThrough();
    let dataReceived = false;
    
    const timeoutId = setTimeout(() => {
        if (!dataReceived) {
            console.error(`No video data received from NVR for channel ${channel} after 10s. Likely no recording exists.`);
            command.kill('SIGKILL');
            if (!res.headersSent) {
                res.status(404).json({ error: 'No video recording found for this time period.' });
            } else {
                res.end(); // Close the connection so the browser stops spinning
            }
        }
    }, 10000);

    pt.once('data', () => {
        dataReceived = true;
        clearTimeout(timeoutId);
    });

    pt.pipe(res);

    // If client disconnects, kill the ffmpeg process
    req.on('close', () => {
        console.log('Client disconnected, killing ffmpeg process');
        clearTimeout(timeoutId);
        command.kill('SIGKILL');
    });

    command.pipe(pt, { end: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`View-Camera server is running on port ${PORT}`);
});
