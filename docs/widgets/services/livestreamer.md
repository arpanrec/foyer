---
title: Live Streamer
description: Stream status and live channels from Twitch and other platforms
---

This widget lists channels from live streaming platforms such as Twitch, showing avatars, live badges, category, viewer counts, and hover stream previews.

```yaml
widget:
    type: livestreamer
    channels:
        - twitch:jembawls
        - twitch:xqc
    sortBy: viewers # optional - viewers | live | name, defaults to viewers
    hideOffline: false # optional - hide offline channels, defaults to false
    showPreview: true # optional - hover stream preview on live channels, defaults to true
    collapseAfter: 5 # optional - channels shown before "Show more", -1 to never collapse, defaults to 5
```

## Channels

`channels` is a list of channel references in `<platform>:<name>` format:

- `platform`: the streaming platform (currently `twitch`).
- `name`: the channel name or login on that platform. Twitch channel names must be 3 to 25 alphanumeric characters or underscores.

The widget refuses to load and shows an error if `channels` is missing or empty, if an entry is missing the `<platform>:` prefix, or if an unknown platform or invalid channel name is specified.

## Options

| Option          | Description                                                                    | Default   |
| --------------- | ------------------------------------------------------------------------------ | --------- |
| `channels`      | List of `<platform>:<name>` channel references                                 | Required  |
| `sortBy`        | Sort order: `viewers` (viewer count), `live` (live channels first), or `name`  | `viewers` |
| `hideOffline`   | When set to `true`, offline channels are omitted from the list                 | `false`   |
| `showPreview`   | When set to `true`, hovering over a live channel displays a stream snapshot    | `true`    |
| `collapseAfter` | Number of channels shown before a "Show more" toggle appears (`-1` to disable) | `5`       |

## Notes

Channel information is fetched by foyer, not your browser, and cached in memory for 60 seconds.

Twitch integration uses Twitch's public GraphQL endpoint and requires no API key or credentials. Because it uses Twitch's persisted GraphQL queries, it relies on Twitch maintaining those query hashes.
