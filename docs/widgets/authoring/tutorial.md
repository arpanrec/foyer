---
title: Widget Tutorial
description: Follow along with this guide to learn how to create a custom widget for Foyer. We'll cover the basic structure of a widget, how to use translations, and how to fetch data from an API.
---

In this guide, we'll walk through the process of creating a custom widget for Foyer. We'll cover the basic structure of a widget, how to use translations, and how to fetch data from an API. By the end of this guide, you'll have a solid understanding of how to build your own custom widget.

**Prerequisites:**

- Basic knowledge of React and TypeScript
- Familiarity with the Foyer platform
- Understanding of JSON and API interactions

Throughout this guide, we'll use `yourwidget` as a placeholder for the unique name of your custom widget. Replace `yourwidget` with the actual name of your widget. It should contain only lowercase letters and no spaces.

This guide makes use of a fake API, which would return a JSON response as such, when called with the `v1/info` endpoint:

```json
{ "key1": 123, "key2": 456, "key3": 789 }
```

## Declare the types

Create a new folder for your widget in the `src/widgets` directory. Name the folder `yourwidget`.

Inside the `yourwidget` folder, create a new file named `types.ts`. It holds the type of the API response, so the component knows which fields `data` has.

```ts title="src/widgets/yourwidget/types.ts"
export type YourWidgetInfo = {
    key1: number;
    key2: number;
    key3: number;
};
```

A widget that reads its own options from the user's configuration also declares an options type here, with every property optional.

## Set up the widget definition

Inside the `yourwidget` folder, create a new file named `widget.ts`. This file will contain the metadata for your widget.

Open the `widget.ts` file and add the following code:

```ts title="src/widgets/yourwidget/widget.ts"
import type { WidgetDefinition } from "@/types/widget-definition";
import genericProxyHandler from "@/utils/proxy/handlers/generic"; // (1)!

const widget = /* (2)! */ {
    api: "{url}/{endpoint}" /* (3)! */,
    proxyHandler: genericProxyHandler /* (1)! */,

    mappings: /* (4)! */ {
        info: /* (5)! */ {
            endpoint: "v1/info" /* (6)! */,
        },
    },
} satisfies WidgetDefinition;

export default widget;
```

1. We import the `genericProxyHandler` from the `utils/proxy/handlers/generic` module. The `genericProxyHandler` is a generic handler that can be used to fetch data from an API. We then assign the `genericProxyHandler` to the `proxyHandler` property of the `widget` object. There are other handlers available that you can use depending on your requirements. You can also create custom handlers if needed.
2. We define a `widget` object that contains the metadata for the widget. `satisfies WidgetDefinition` makes TypeScript check its shape.
3. The API endpoint to fetch data from. You can use placeholders like `{url}` and `{endpoint}` to dynamically generate the API endpoint based on the widget configuration.
4. An object that contains mappings for different endpoints. Each mapping should have an `endpoint` property that specifies the endpoint to fetch data from.
5. A mapping named `info` that specifies the `v1/info` endpoint to fetch data from. This would be called from the component as such: `#!ts useWidgetAPI(widget, "info");`
6. The `endpoint` property of the `info` mapping specifies the endpoint to fetch data from. There are other properties you can pass to the mapping, such as `method`, `headers`, and `body`.

!!! warning "Important"

    All widgets that fetch data from dynamic endpoints should have either `mappings` or an `allowedEndpoints` property.

## Add the translation strings

Every label in a widget is a translation key. Open `public/locales/en/common.json` and add an object named after your widget:

```json title="public/locales/en/common.json"
"yourwidget": {
    "key1": "Key 1",
    "key2": "Key 2",
    "key3": "Key 3"
}
```

Add English only. The other languages are translated separately. The [translations guide](translations.md) lists the shared `common.*` formatting keys and labels you can reuse.

## Create the widget component

Create a new file for your widgets component, named `component.tsx`, in the `src/widgets/yourwidget` directory. We'll build the contents of the `component.tsx` file step by step.

First, we'll import the necessary dependencies:

```tsx title="src/widgets/yourwidget/component.tsx"
import { useTranslation } from "next-i18next/pages"; // (1)!

import Block from "@/components/services/widget/block"; // (2)!
import Container from "@/components/services/widget/container"; // (3)!
import type { WidgetProps } from "@/types/service"; // (4)!
import useWidgetAPI from "@/utils/proxy/use-widget-api"; // (5)!
import type { YourWidgetInfo } from "@/widgets/yourwidget/types"; // (6)!
```

1. `#!ts useTranslation()` is a hook provided by `next-i18next` that allows us to access the translation strings
2. `#!jsx <Block>` is a custom component that we'll use to show one value.
3. `#!jsx <Container>` is a custom component that we'll use to structure our widget.
4. `#!ts WidgetProps` types the props every widget component receives.
5. `#!ts useWidgetAPI(widget, endpoint)` is a custom hook that we'll use to fetch data from an API.
6. The response type we declared in `types.ts`.

---

Next, we'll define a functional component named `Component` that takes a `service` prop.

```tsx title="src/widgets/yourwidget/component.tsx"
export default function Component({ service }: WidgetProps) {}
```

---

We grab the helper functions from the `useTranslation` hook.

```tsx title="src/widgets/yourwidget/component.tsx"
const { t } = useTranslation();
```

---

We destructure the `widget` object from the `service` prop. The `widget` object contains the metadata for the widget, such as the API endpoint to fetch data from.

```tsx title="src/widgets/yourwidget/component.tsx"
const { widget } = service;
```

---

Now, the fun part! We use the `useWidgetAPI` hook to fetch data from an API. The `useWidgetAPI` hook takes two arguments: the `widget` object and the API endpoint to fetch data from. The type argument is the shape of the response, so `data.key1` is a `number`. The `useWidgetAPI` hook returns an object with `data` and `error` properties.

```tsx title="src/widgets/yourwidget/component.tsx"
const { data, error } = useWidgetAPI<YourWidgetInfo>(widget, "info");
```

!!! tip "API Tips"

    You'll see here how part of the API url is built using the `url` and `endpoint` properties from the widget definition.

    In this case, we're fetching data from the `info` endpoint.  The `info` endpoint is defined in the `mappings` object.  So the full API endpoint will be `"{url}/v1/info"`.

    The mapping and endpoint are often the same, but must be defined regardless.

---

Next, we check if there's an error or no data.

If there's an error, we return a `Container` and pass it the `service` and `error` as props. The `Container` component will handle displaying the error message.

```tsx title="src/widgets/yourwidget/component.tsx"
if (error) {
    return <Container service={service} error={error} />;
}
```

---

If there's no data, we return a `Container` component with three `Block` components, each with a `label`.

```tsx title="src/widgets/yourwidget/component.tsx"
if (!data) {
    return (
        <Container service={service}>
            <Block label="yourwidget.key1" />
            <Block label="yourwidget.key2" />
            <Block label="yourwidget.key3" />
        </Container>
    );
}
```

This will render the widget with placeholders for the data, i.e., a skeleton view.

!!! tip "Translation Tips"

      The `label` prop in the `Block` component corresponds to the translation key we defined earlier in the `common.json` file.  All text and numerical content should be translated.

---

If there is data, we return a `Container` component with three `Block` components, each with a `label` and a `value`.

Here we use the `t` function from the `useTranslation` hook to translate the data values. The `t` function takes the translation key and an object with variables to interpolate into the translation string.

We're using the `common.number` translation key to format the data values as numbers. This allows for easy localization of numbers, such as using commas or periods as decimal separators.

There are a large number of `common` numerical translation keys available, which you can learn more about in the [Translation Guide](translations.md).

```tsx title="src/widgets/yourwidget/component.tsx"
return (
    <Container service={service}>
        <Block label="yourwidget.key1" value={t("common.number", { value: data.key1 })} />
        <Block label="yourwidget.key2" value={t("common.number", { value: data.key2 })} />
        <Block label="yourwidget.key3" value={t("common.number", { value: data.key3 })} />
    </Container>
);
```

---

Here's the complete `component.tsx` file:

```tsx title="src/widgets/yourwidget/component.tsx"
import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { YourWidgetInfo } from "@/widgets/yourwidget/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { widget } = service;
    const { data, error } = useWidgetAPI<YourWidgetInfo>(widget, "info");

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block label="yourwidget.key1" />
                <Block label="yourwidget.key2" />
                <Block label="yourwidget.key3" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="yourwidget.key1" value={t("common.number", { value: data.key1 })} />
            <Block label="yourwidget.key2" value={t("common.number", { value: data.key2 })} />
            <Block label="yourwidget.key3" value={t("common.number", { value: data.key3 })} />
        </Container>
    );
}
```

## Register the widget

Foyer finds widgets through two registries. Register the widget definition in the `src/widgets/widgets.ts` file.

Open the `src/widgets/widgets.ts` file and import the widget definition from your widget's `widget.ts` file. Please keep the alphabetical order.

```ts
// ...
import yourwidget from "@/widgets/yourwidget/widget";
// ...
```

Add `yourwidget` to the `widgets` object. Please keep the alphabetical order.

```ts
const widgets: Record<string, WidgetDefinition> = {
    // ...
    yourwidget,
    // ...
};
```

You also need to add the widget to the `components` object in the `src/widgets/components.ts` file.

Open the `src/widgets/components.ts` file and add a lazily loaded entry that imports the `Component` from your widget's `component.tsx` file.

Please keep the alphabetical order.

```ts
const components: Record<string, ComponentType<WidgetProps>> = {
    // ...
    yourwidget: dynamic(() => import("@/widgets/yourwidget/component")),
    // ...
};
```

## Using the widget

You can now use your custom widget in your Foyer. Open your `services.yaml` file and add a new service with the `yourwidget` widget.

```yaml
- Services:
      - Your Widget:
            icon: yourwidget.svg
            href: https://example.com/
            widget:
                type: yourwidget
                url: http://127.0.0.1:1337
```

!!! tip "API Tips"

    You'll see here how part of the API url is built using the `url` and `endpoint` properties from the widget definition.

    We defined the api endpoint as `"{url}/{endpoint}"`.  This is where the `url` is defined.  So the full API endpoint will be `http://127.0.0.1:1337/{endpoint}`.

## Pass widget options to the component

This widget only needs `url`, which stays on the server. If your component reads an option of its own, such as an environment ID, add it to the whitelist in `cleanServiceGroups` as described in the [Component Guide](component.md#props). Without that entry, the option is `undefined` in the browser.

## Write the tests

Add `widget.test.ts` and `component.test.tsx` next to the widget, and `proxy.test.ts` if it has a custom proxy. [What tests to include](getting-started.md#what-tests-to-include) lists what each one covers, and `src/widgets/adguard/` has a complete set to copy.

## Document the widget

Create `docs/widgets/services/yourwidget.md` with the configuration users need:

````md title="docs/widgets/services/yourwidget.md"
---
title: Your Widget
description: Your Widget Widget Configuration
---

Learn more about [Your Widget](https://example.com/).

Allowed fields: `["key1", "key2", "key3"]`.

```yaml
widget:
    type: yourwidget
    url: http://yourwidget.host.or.ip:port
```
````

State which credentials or API permissions the widget needs. Then add the page to the "Service Widgets" section of `mkdocs.yml` and to the list in `docs/widgets/services/index.md`, both in alphabetical order.

## Checklist

A new service widget touches these files:

- `src/widgets/yourwidget/types.ts`, `widget.ts`, `component.tsx`, and `proxy.ts` only when no built-in handler fits
- `src/widgets/yourwidget/widget.test.ts`, `component.test.tsx`, and `proxy.test.ts` for a custom proxy
- `src/widgets/widgets.ts` and `src/widgets/components.ts`
- `src/utils/config/service-helpers.ts`, when the component reads its own options
- `src/utils/proxy/handlers/credentialed.ts`, when the API key goes in a header other than `X-API-Key` (see the [Proxies Guide](proxies.md#credentialedproxyhandler))
- `public/locales/en/common.json`
- `docs/widgets/services/yourwidget.md`, `mkdocs.yml` and `docs/widgets/services/index.md`

Before opening a pull request, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm format`.
