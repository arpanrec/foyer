---
title: MJPEG
description: MJPEG Stream Widget Configuration
---

![camera-preview](/assets/widget_mjpeg_demo.gif)

Pass the stream URL from a service like [µStreamer](https://github.com/pikvm/ustreamer) or [camera-streamer](https://github.com/ayufan/camera-streamer).

```jsonc
"widget": {
    "type": "mjpeg",
    "stream": "http://mjpeg.host.or.ip/webcam/stream",
    "fit": "contain", // optional, one of contain (default), cover, fill, none, scale-down
    "ignoreTls": false, // optional, defaults to false, set to true to skip the TLS certificate check of an https stream
},
```

Foyer checks the TLS certificate of an `https` stream. If the camera uses a self-signed certificate, set `ignoreTls: true` to skip the check. Only do this for a camera on a network you trust, since anyone who can intercept the connection can then read the username and password in the stream URL.

A stream given as a path, such as `/webcam/?action=stream`, is opened on `FOYER_EXTERNAL_URL` when it is set, otherwise on the host of the request. With `FOYER_ALLOWED_HOSTS=*` and no `FOYER_EXTERNAL_URL`, a path is refused, because any client could then choose the host.

Foyer opens the stream itself, follows up to five redirects, and passes it on to the browser, so the camera only needs to be reachable from the Foyer server. Foyer serves only a `multipart/x-mixed-replace` stream or a single JPEG, PNG, GIF, WebP, AVIF or BMP image, and answers any other content type, SVG included, with an error. A redirect from `https` to `http` on the same host does not carry the username and password along. The stream URL never reaches the browser, which makes it safe to put a username and password in it (`http://user:password@host/stream`). Each widget opens two connections to the camera, one for the blurred background and one for the picture.
