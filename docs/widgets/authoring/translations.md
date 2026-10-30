---
title: Translations Guide
description: Tips and tricks for translating and localizing Foyer widgets.
---

All text and numerical content in widgets should be translated and localized. English is the default language. Each other language has its own folder under `public/locales/`.

## Translations

Foyer uses the [next-i18next](https://github.com/i18next/next-i18next) library to handle translations. Components import `useTranslation` from `next-i18next/pages`. The library provides a set of hooks and utilities to help you localize your widgets, and Foyer has extended it to support additional features.

=== "component.tsx"

    ```tsx
    import { useTranslation } from "next-i18next/pages";

    import Block from "@/components/services/widget/block";
    import Container from "@/components/services/widget/container";
    import type { WidgetProps } from "@/types/service";

    export default function Component({ service }: WidgetProps) {
      const { t } = useTranslation();

      return (
        <Container service={service}>
          <Block label="yourwidget.key1" />
          <Block label="yourwidget.key2" />
          <Block label="yourwidget.key3" />
        </Container>
      );
    }
    ```

## Set up translation strings

Foyer uses translated and localized strings for **all text and numerical content** in widgets. English is the default language. Each other language has its own folder under `public/locales/`. To add the English translations for your widget, follow these steps:

Open the `public/locales/en/common.json` file.

Add a new object for your widget to the bottom of the list, like this:

```json
"yourwidget": {
  "key1": "Value 1",
  "key2": "Value 2",
  "key3": "Value 3"
}
```

!!! note

    Even if you natively speak another language, you should only add English translations.

## Common Translations

Foyer provides a set of common translations that you can use in your widgets. These translations are used to format numerical content, dates, and other common elements.

### Numbers

| Key                   | Translation  | Description                      |
| --------------------- | ------------ | -------------------------------- |
| `common.bytes`        | `1 kB`       | Format a number in bytes.        |
| `common.bits`         | `1 kbit`     | Format a number in bits.         |
| `common.bbytes`       | `1 kiB`      | Format a number in binary bytes. |
| `common.bbits`        | `1 kibit`    | Format a number in binary bits.  |
| `common.byterate`     | `1 kB/s`     | Format a byte rate.              |
| `common.bibyterate`   | `1 kiB/s`    | Format a binary byte rate.       |
| `common.bitrate`      | `1 kbit/s`   | Format a bit rate.               |
| `common.bibitrate`    | `1 kibit/s`  | Format a binary bit rate.        |
| `common.percent`      | `50%`        | Format a percentage.             |
| `common.number`       | `1,000`      | Format a number.                 |
| `common.ms`           | `1,000`      | Format a number of milliseconds. |
| `common.date`         | `2024-01-01` | Format a date.                   |
| `common.relativeDate` | `1 day ago`  | Format a relative date.          |
| `common.duration`     | `1d1h`       | Format a duration in seconds.    |

### Text

| Key                | Translation | Description        |
| ------------------ | ----------- | ------------------ |
| `resources.cpu`    | `CPU`       | CPU usage.         |
| `resources.mem`    | `MEM`       | Memory usage.      |
| `resources.total`  | `Total`     | Total resource.    |
| `resources.free`   | `Free`      | Free resource.     |
| `resources.used`   | `Used`      | Used resource.     |
| `resources.load`   | `Load`      | Load value.        |
| `resources.temp`   | `TEMP`      | Temperature value. |
| `resources.max`    | `Max`       | Maximum value.     |
| `resources.uptime` | `UP`        | Uptime.            |
