const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');
const cmd = `${ffmpeg} -y -stimeout 10000000 -rtsp_transport tcp -i "rtsp://admin:QATech999@192.168.100.100:554/Streaming/tracks/301?starttime=20260820T064900Z&endtime=20260820T065000Z" -c:v libx264 -preset ultrafast -c:a aac -movflags frag_keyframe+empty_moov+default_base_moof -f mp4 test_cmd.mp4`;
console.log(cmd);
try {
    cp.execSync(cmd, {stdio: 'inherit'});
} catch (e) {
    console.error("FFmpeg failed:", e.message);
}
