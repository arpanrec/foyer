# MJPEG test stack

A camera stand-in for trying the `mjpeg` widget. ffmpeg loops `video/file_example_AVI_1920_2_3MG.avi` as an MJPEG stream, and Caddy puts basic auth in front of it.

```bash
docker compose up --build -d
```

Then add the widget to a service in your config:

```ts
widget: { type: "mjpeg", stream: "http://cam:secret@127.0.0.1:8091/stream", fit: "cover" },
```

The password defaults to `secret`; set `CAM_PASS` before `docker compose up` to change it. Without credentials the stream answers 401, which is a quick way to test the failure case:

```bash
curl -s -m 2 -u cam:secret http://127.0.0.1:8091/stream | head -c 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8091/stream
```

`stream.test.ts` checks the stack end to end: the proxy refuses missing and wrong credentials, frames arrive with the right ones, two viewers can watch at once, and Foyer's own stream code and `/api/mjpeg` route work through it.

```bash
pnpm exec vitest run --config test/mjpeg/vitest.config.ts
```

The run builds and starts the stack with `docker compose up`, waits until the proxy answers, and runs `docker compose down` afterwards. A stack that is already running, or one at another address (`MJPEG_TEST_URL`), is left alone and not stopped. Set `MJPEG_TEST_KEEP_STACK=1` to leave a stack the run started up afterwards. If you changed the password, set `CAM_PASS` (or `MJPEG_TEST_PASS`, with `MJPEG_TEST_USER` for the user). The regular `pnpm test` does not include these tests.

Each viewer gets its own ffmpeg process, so the two connections the widget opens do not interfere. `docker compose down` stops the stack.
