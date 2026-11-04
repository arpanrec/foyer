import { spawn } from "node:child_process";
import { createServer } from "node:http";

const video = process.env["VIDEO"] ?? "/video/file_example_AVI_1920_2_3MG.avi";
const port = Number(process.env["PORT"] ?? "8090");
const boundary = "frame";

// Every viewer gets its own ffmpeg that loops the file, so any number of clients can watch at once. The camera
// widget opens two connections, one for the blurred background and one for the picture.
const server = createServer((req, res) => {
    if (req.url !== "/stream") {
        res.writeHead(404).end();
        return;
    }

    res.writeHead(200, {
        "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
        "Cache-Control": "no-store",
    });
    console.log("viewer connected");

    const ffmpeg = spawn(
        "ffmpeg",
        [
            ...["-loglevel", "error", "-re", "-stream_loop", "-1", "-i", video, "-an"],
            ...["-vf", "scale=640:-2,fps=15", "-c:v", "mjpeg", "-q:v", "5"],
            ...["-f", "mpjpeg", "-boundary_tag", boundary, "-"],
        ],
        { stdio: ["ignore", "pipe", "inherit"] }
    );
    ffmpeg.stdout.pipe(res);

    res.on("close", () => {
        ffmpeg.kill();
        console.log("viewer gone");
    });
});

server.listen(port, () => console.log(`Streaming ${video} on :${port}/stream`));
