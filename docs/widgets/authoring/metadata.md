---
title: Metadata Guide
description: Explore all the metadata properties that can be used to configure a widget in Foyer.
---

Here, we will go over how to create and configure Foyer widget metadata. Metadata is a TypeScript object that contains information about the widget, such as the API endpoint, proxy handler, and mappings. This metadata is used by Foyer to fetch data from the API and pass it to the widget.

## Widgets Configuration

Here are some examples of how to configure a widget's metadata object.

=== "Basic Example"

    ```ts
    import type { WidgetDefinition } from "@/types/widget-definition";
    import genericProxyHandler from "@/utils/proxy/handlers/generic";

    const widgetExample = {
      api: "{url}/api/{endpoint}",
      proxyHandler: genericProxyHandler,

      mappings: {
        stats: { endpoint: "stats" },
      },
    } satisfies WidgetDefinition;
    ```

=== "Advanced Example"

    ```ts
    import type { WidgetDefinition } from "@/types/widget-definition";
    import { asJson, jsonArrayFilter } from "@/utils/proxy/api-helpers";
    import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";
    import type { Notice } from "@/widgets/yourwidget/types";

    const widgetExample = {
      api: "{url}/api/{endpoint}",
      proxyHandler: credentialedProxyHandler,

      mappings: {
        stats: {
          endpoint: "stats",
          validate: ["total", "average"],
          params: ["start", "end"],
        },
        notices: {
          endpoint: "notices",
          map: (data: unknown) => ({
            total: asJson<Notice[]>(data).length,
          }),
        },
        warnings: {
          endpoint: "notices",
          map: (data: unknown) => ({
            total: jsonArrayFilter<Notice>(data, (alert) => alert.type === "warning").length,
          }),
        },
      },
    } satisfies WidgetDefinition;
    ```

`satisfies WidgetDefinition` checks the metadata against the `WidgetDefinition` type. The response types, such as `Notice` above, live in the widget's `types.ts`.

A widget's metadata is quite powerful and can be configured in many different ways.

## Configuration Properties

### `api`

The `api` property is a string that represents the URL of the API endpoint that the widget will use to fetch data. The URL can contain placeholders that will be replaced with actual values at runtime. For example, the `{url}` placeholder will be replaced with the URL of the configured widget, and the `{endpoint}` placeholder will be replaced with the value of the `endpoint` property in the `mappings` object.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
};
```

Any key of the user's widget configuration can be a placeholder, such as `{key}` or a widget-specific option like `{env}`. Placeholders are filled in two passes, so a placeholder inside a mapping's `endpoint` is filled too. Trailing slashes are removed from `{url}`. An `api` without `{url}` must be an absolute `http://` or `https://` URL.

### `proxyHandler`

The `proxyHandler` property is a function that will be used to make the API request. Foyer includes some built-in proxy handlers that can be used out of the box:

Here is an example of the generic proxy handler that makes unauthenticated requests to the specified API endpoint.

=== "widget.ts"

    ```ts
    const widgetExample = {
      api: "{url}/api/{endpoint}",
      proxyHandler: genericProxyHandler,
    };
    ```

=== "services.yaml"

    ```yaml
    - Services:
        - Your Widget:
            icon: yourwidget.svg
            href: https://example.com/
            widget:
              type: yourwidget
              url: http://127.0.0.1:1337
    ```

If you are looking to learn more about proxy handlers, please refer to the guide here: [Proxies Guide](proxies.md).

### `mappings`

The `mappings` property is an object that contains information about the API endpoint, such as the endpoint name, validation rules, and parameter names. The `mappings` object can contain multiple endpoints, each with its own configuration.

!!! note "Security Note"

    The `mappings` or `allowedEndpoints` property is required for the widget to fetch data from more than a static URL. Foyer uses a whitelist approach to ensure that widgets only access allowed endpoints.

```ts
import { asJson } from "@/utils/proxy/api-helpers";
import type { Notice } from "@/widgets/yourwidget/types";

const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/stats?start=...&end=...`
        stats: {
            endpoint: "stats",
            validate: ["total", "average"],
            params: ["start", "end"],
        },
        // `/api/notices`
        notices: {
            endpoint: "notices",
            map: (data: unknown) => ({
                total: asJson<Notice[]>(data).length,
            }),
        },
    },
};
```

#### `endpoint`

The `endpoint` property is a string that represents the name of the API endpoint that the widget will use to fetch data. This value will be used to replace the `{endpoint}` placeholder in the `api` property.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/stats`
        stats: {
            endpoint: "stats",
        },
    },
};
```

#### `validate`

The `validate` property is an array of keys that the API response must contain. The built-in proxy handlers check them before running `map`. When a key is missing, or the body is not valid JSON, the proxy answers with an "Invalid data" error, which the widget shows as an API error.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/stats`
        stats: {
            endpoint: "stats",
            validate: ["total", "average"],
        },
    },
};
```

This configuration will ensure that the API response contains the `total` and `average` keys before the data reaches the widget.

#### `allowEmpty`

Set `allowEmpty: true` on a mapping whose endpoint can answer with an empty body. An empty body then passes validation instead of failing as invalid JSON.

#### `params`

The `params` property is an array of strings that represent the keys that should be passed as parameters to the API endpoint. These keys will be replaced with the actual values at runtime.

=== "widget.ts"

    ```ts
    const widgetExample = {
      api: "{url}/api/{endpoint}",
      mappings: {
        // `/api/stats?start=...&end=...`
        stats: {
          endpoint: "stats",
          params: ["start", "end"],
        },
      },
    };
    ```

=== "component.tsx"

      ```ts
      const { data: statsData, error: statsError } = useWidgetAPI(widget, "stats", {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      });
      ```

This configuration will pass the `start` and `end` keys as parameters to the API endpoint. The values are passed as an object to the `useWidgetAPI` hook.

#### `optionalParams`

The `optionalParams` property is an array of strings like `params`, but a key is only passed to the API endpoint when the component supplies a value for it.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/items` or `/api/items?status=...`
        items: {
            endpoint: "items",
            optionalParams: ["status"],
        },
    },
};
```

#### `segments`

The `segments` property is an array of names that fill `{name}` placeholders in the `endpoint`. `useWidgetAPI` does not send segments, so a component that needs them builds the request itself. It adds a `segments` query parameter holding a JSON object of the values, as `src/widgets/emby/component.tsx` does for its pause and unpause calls. Foyer URL-encodes each value. A value that is empty or contains `%`, `/`, `\` or `..` is rejected, and so is a request whose segment names differ from this list.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/queues/<queueId>/items`
        queue: {
            endpoint: "queues/{queueId}/items",
            segments: ["queueId"],
        },
    },
};
```

#### `map`

The `map` property is a function that will be used to transform the API response before it is passed to the widget. This function is passed the raw API response, a Buffer or an already parsed value, and should return the transformed data. `asJson<T>(data)` narrows the raw response to a type. The type argument of `useWidgetAPI<T>` in the component is the type this function returns, or the raw response type when the mapping has no `map`. An arrow function that returns an object literal wraps the literal in parentheses.

```ts
import { asJson } from "@/utils/proxy/api-helpers";
import type { Notice } from "@/widgets/yourwidget/types";

const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/notices`
        notices: {
            endpoint: "notices",
            map: (data: unknown) => ({
                total: asJson<Notice[]>(data).length,
            }),
        },
        // `/api/notices`
        warnings: {
            endpoint: "notices",
            map: (data: unknown) => ({
                total: asJson<Notice[]>(data).filter((alert) => alert.type === "warning").length,
            }),
        },
    },
};
```

#### `method`

The `method` property is the HTTP method used for the upstream request. The default value is `GET`.

The method of the request from the browser must match it, or the proxy answers with a 403 error. `useWidgetAPI` always sends `GET`, so a component that uses a `POST` mapping sends the request itself, as `src/widgets/uptimerobot/component.tsx` does:

```tsx
const res = await fetch(formatProxyUrl(widget, "getmonitors"), { method: "POST" });
```

Use `POST` only for APIs that require it to read data. Widgets must not change anything in the upstream service.

#### `headers`

The `headers` property is an object that contains additional headers that should be included in the API request. If your endpoint requires specific headers, you can include them here.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    mappings: {
        // `/api/stats`
        stats: {
            endpoint: "stats",
            headers: {
                "Content-Type": "application/json",
            },
        },
    },
};
```

#### `body`

The `body` property is the request body, sent together with a `method` such as `POST`. `genericProxyHandler` sends it only when it is a string, so serialize JSON with `JSON.stringify`. `credentialedProxyHandler` sends no body. A custom proxy handler can read an object `body` from the mapping itself, as `src/widgets/komodo/proxy.ts` does.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    proxyHandler: genericProxyHandler,
    mappings: {
        // `POST /api/graphql`
        stats: {
            endpoint: "graphql",
            method: "POST",
            body: JSON.stringify({ query: "query { stats { total average } }" }),
            headers: {
                "Content-Type": "application/json",
            },
        },
    },
};
```

#### `proxyHandler`

A mapping can set its own `proxyHandler`, which then runs for that endpoint instead of the widget's handler.

### `allowedEndpoints`

The `allowedEndpoints` property is a RegExp that represents the allowed endpoints that the widget can use. If the widget tries to access an endpoint that is not allowed, the request will be blocked.

`allowedEndpoints` can be used when endpoint validation is simple and can be done using a regular expression, and more control is not required.

!!! note "Security Note"

    The `mappings` or `allowedEndpoints` property is required for the widget to fetch data from more than a static URL. Foyer uses a whitelist approach to ensure that widgets only access allowed endpoints.

```ts
const widgetExample = {
    api: "{url}/api/{endpoint}",
    allowedEndpoints: /^(stats|notices)$/,
};
```

This configuration will only allow the widget to access the `stats` and `notices` endpoints.
