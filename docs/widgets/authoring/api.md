---
title: API Guide
description: Get comfortable with making API calls from inside your widget.
---

Foyer provides the `useWidgetAPI` hook to help you fetch data from an API. This hook ensures that the data is fetched through the Foyer proxy, which keeps credentials on the server.

Here is an example of how the `useWidgetAPI` hook looks:

```tsx title="Fetch data from the stats endpoint"
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { StatsResponse } from "@/widgets/example/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;
    const { data, error } = useWidgetAPI<StatsResponse>(widget, "stats");
}
```

## `useWidgetAPI`

`useWidgetAPI<T>` takes four possible arguments:

- `widget`: The widget configuration from the `service` prop.
- `endpoint`: The name of the endpoint to fetch data from.
- `params`: An optional object containing query parameters to pass to the API.
- `swrConfig`: An optional [SWR configuration](https://swr.vercel.app/docs/api#options) object, for example to set `refreshInterval`.

The type argument `T` is the shape of the response body, declared in the widget's `types.ts`. The hook returns `{ data, error, mutate }`. `data` is `T` once the request succeeds and `undefined` while it loads. When the proxy answers with an `{ error }` body, for example after an upstream HTTP error, that error is returned as `error`.

### `widget`

The `widget` argument is the widget's configuration from the `service` prop (`service.widget`). The hook only uses its service group, service name and index to tell the server which widget to call. The server then loads the full configuration, with credentials, itself. The browser never receives them.

### `endpoint`

The `endpoint` argument is the name of the endpoint to fetch data from. This is [defined in the widget metadata object](metadata.md#endpoint). The `useWidgetAPI` hook uses this argument to determine which endpoint to fetch data from.

If no endpoint is provided, the `useWidgetAPI` hook will call the API endpoint defined in the widget metadata object directly.

An empty string skips the request. Use it to wait until a required option is set:

```tsx
const { data, error } = useWidgetAPI<StatsResponse>(widget, widget.env ? "stats" : "");
```

The hook always sends `GET`. For an endpoint whose mapping sets another method, see [`method`](metadata.md#method).

### `params`

The `params` argument is an optional object containing query parameters to pass to the API. This is useful for filtering data or passing additional information to the API. This object is passed directly to the API endpoint as query parameters.

Here is an example of how to use the `params` argument:

```tsx title="Fetch data from the stats endpoint with query parameters"
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { StatsResponse } from "@/widgets/example/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;
    const { data, error } = useWidgetAPI<StatsResponse>(widget, "stats", { start: "2021-01-01", end: "2021-12-31" });
}
```

The `params` must be [whitelisted in the widget metadata object](metadata.md#params). This is done to prevent arbitrary query parameters from being passed to the API.

### Refreshing

By default SWR uses its own refresh behavior. To poll an endpoint on an interval, set `refreshInterval` (in milliseconds) either as a key on `params` or in the fourth `swrConfig` argument:

```tsx
const { data, error } = useWidgetAPI<StatsResponse>(widget, "stats", { refreshInterval: 60000 });
// or, when there are no other params:
const { data, error } = useWidgetAPI<StatsResponse>(widget, "stats", undefined, { refreshInterval: 60000 });
```
