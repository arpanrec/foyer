---
title: Vikunja
description: Vikunja Widget Configuration
---

Learn more about [Vikunja](https://vikunja.io).

Allowed fields: `["projects", "tasks7d", "tasksOverdue", "tasksInProgress"]`.

A list of the next 5 tasks ordered by due date is disabled by default, but can be enabled with the `enableTaskList` option. When enabled, clicking a task navigates directly to that task in Vikunja using the service `href` (or widget `url`).

| Vikunja Version | Foyer Widget Version |
| --------------- | -------------------- |
| < v1.0.0-rc4    | 1 (default)          |
| >= v1.0.0-rc4   | 2                    |

```yaml
widget:
    type: vikunja
    url: http[s]://vikunja.host.or.ip[:port]
    key: vikunjaapikey
    enableTaskList: true # optional, defaults to false
    version: 2 # optional, defaults to 1
```
