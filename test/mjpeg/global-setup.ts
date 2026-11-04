import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const composeFile = fileURLToPath(new URL("compose.yaml", import.meta.url));
const streamUrl = process.env["MJPEG_TEST_URL"] ?? "http://127.0.0.1:8091/stream";

let startedHere = false;

// Any answer, even a 401, means the proxy and the stream behind it are up
async function answers() {
    try {
        const res = await fetch(streamUrl, { signal: AbortSignal.timeout(2000) });
        await res.body?.cancel();
        return true;
    } catch {
        return false;
    }
}

function compose(...args: string[]) {
    execFileSync("docker", ["compose", "-f", composeFile, ...args], { stdio: "inherit" });
}

// Starts the stack before the tests and stops it after them. A stack that is already running, or one at another
// address (MJPEG_TEST_URL), belongs to whoever started it and is left alone.
export async function setup() {
    if (process.env["MJPEG_TEST_URL"] || (await answers())) return;

    compose("up", "--build", "--detach");
    startedHere = true;

    const deadline = Date.now() + 60_000;
    while (!(await answers())) {
        if (Date.now() > deadline) throw new Error(`The stack did not answer on ${streamUrl} within 60 seconds`);
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

export function teardown() {
    if (startedHere && !process.env["MJPEG_TEST_KEEP_STACK"]) compose("down");
}
