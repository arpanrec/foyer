---
title: Settings
description: Service Configuration
---

The `settings` member of the [config file](/configs/) holds application level options. This page writes it as the content of `settings.jsonc.njk`, which the config file includes, and the snippets on this page are members of that object. The `settings` part of the [schema](/configs/#schema) lists every setting on this page and nothing else, so an editor that checks the config against it flags a misspelled or unknown key:

```jsonc
{
    "title": "My Foyer",
    "theme": "dark",
}
```

## Title

You can customize the title of the page if you'd like.

```jsonc
"title": "My Awesome Foyer",
```

## Description

You can customize the description of the page if you'd like.

```jsonc
"description": "A description of my awesome foyer",
```

## Start URL

You can customize the start_url as required for installable apps. The default is "/".

```jsonc
"startUrl": "https://custom.url",
```

## Background Image

A background, favicon or PWA icon given as a full URL is downloaded by the Foyer server and served to the browser from Foyer, so the image host only needs to be reachable from the server. Downloaded images are kept in memory and downloaded again after a restart. The background is also served to the sign-in page without a login.

:::caution[Heads Up!]
You will need to restart the container any time you add new local images so the server can discover them.
:::

:::caution[Heads Up!]
Do not create a bind mount to the entire `/app/public/` directory.
:::

If you'd like to use a background image instead of the solid theme color, you may provide a full URL to an image of your choice.

```jsonc
"background": "https://images.unsplash.com/photo-1502790671504-542ad42d5189?auto=format&fit=crop&w=2560&q=80",
```

Or you may pass the path to a local image relative to e.g. `/app/public/images` directory.

For example, inside of your Docker Compose file, mount a path to where your images are kept:

```yaml
volumes:
    - /my/foyer/images:/app/public/images
```

and then reference that image:

```jsonc
"background": "/images/background.png",
```

### Background Opacity & Filters

You can specify filters to apply over your background image for blur, saturation and brightness as well as opacity to blend with the background color. The first three filter settings use tailwind CSS classes, see notes below regarding the options for each. You do not need to specify all options.

```jsonc
"background": {
    "image": "/images/background.png",
    "blur": "sm", // sm, "", md, xl... see https://tailwindcss.com/docs/backdrop-blur
    "saturate": 50, // 0, 50, 100... see https://tailwindcss.com/docs/backdrop-saturate
    "brightness": 50, // 0, 50, 75... see https://tailwindcss.com/docs/backdrop-brightness
    "opacity": 50, // 0-100
},
```

### Card Background Blur

You can apply a blur filter to the service & bookmark cards. Note this option is incompatible with the background blur, saturate and brightness filters.

```jsonc
"cardBlur": "xs", // xs, md, etc... see https://tailwindcss.com/docs/backdrop-blur
```

## Favicon

If you'd like to use a custom favicon instead of the included one, you may provide a full URL to an image of your choice.

```jsonc
"favicon": "https://www.google.com/favicon.ico",
```

Or you may pass the path to a local image relative to the `/app/public` directory. See [Background Image](#background-image) for more detailed information on how to provide your own files.

## Theme

You can configure a fixed theme (and disable the theme switcher) by passing the `theme` option, like so:

```jsonc
"theme": "dark", // or light
```

## Color Palette

You can configure a fixed color palette (and disable the palette switcher) by passing the `color` option, like so:

```jsonc
"color": "slate",
```

Supported colors are: `slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `white`

## Block Highlight Levels

You can override the default Tailwind classes applied when a widget highlight rule resolves to the `good`, `warn`, or `danger` level.

```jsonc
"blockHighlights": {
    "levels": {
        "good": "bg-emerald-500/40 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-400",
        "warn": "bg-amber-300/30 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
        "danger": "bg-rose-700/45 text-rose-200 dark:bg-rose-950/70 dark:text-rose-400",
    },
},
```

Any unspecified level falls back to the built-in defaults.

## Progressive Web App (PWA)

A progressive web app is an app that can be installed on a device and provide user experience like a native app. Foyer comes with built-in support for PWA with some default configurations, but you can customize them.

More information on PWAs can be found in [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps).

### App icons

You can set custom icons for installable apps. More information about how you can set them can be found in the [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons).

The default value is the Foyer icon in sizes 192x192 and 512x512.

```jsonc
"pwa": {
    "icons": [
        {
            "src": "/android-chrome-192x192.png?v=2",
            "type": "image/png",
            "sizes": "192x192",
        },
        {
            "src": "/android-chrome-512x512.png?v=2",
            "type": "image/png",
            "sizes": "512x512",
        },
    ],
},
```

For icon `src` you can pass either full URL or a local path relative to the `/app/public` directory. See [Background Image](#background-image) for more detailed information on how to provide your own files.

### Shortcuts

Shortcuts can be used to specify links to tabs, to be preselected when the foyer is opened as an app.
More information about how you can set them can be found in the [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts).

```jsonc
"pwa": {
    "shortcuts": [
        {
            "name": "First",
            "url": "/#first", // opens the first tab
        },
        {
            "name": "Second",
            "url": "/#second", // opens the second tab
        },
        {
            "name": "Third",
            "url": "/#third", // opens the third tab
        },
    ],
},
```

### Other PWA configurations

Foyer sets a few other PWA configurations, based on global settings in `settings.jsonc.njk`:

- `name`, `short_name` - Equal to the [`title`](#title) setting.
- `theme_color`, `background_color` - Based on the [`color`](#color-palette) and [`theme`](#theme) settings.
- `display` - It is always set to "standalone".
- `start_url` - Equal to the [`startUrl`](#start-url) setting.

More information for wach of the PWA configurations can be found in the [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference).

## Layout

You can configure service and bookmarks sections to be either "column" or "row" based layouts, like so:

Assuming you have a group named `Media` in your `services.jsonc.njk` or `bookmarks.jsonc.njk` file,

```jsonc
"layout": {
    "Media": {
        "style": "row",
        "columns": 4,
    },
},
```

As an example, this would produce the following layout:

<img width="1260" alt="Screenshot 2022-09-15 at 8 03 57 PM" src="/assets/settings_layout.png">

### Icons-Only Layout

You can also specify the an icon-only layout for bookmarks, either like so:

```jsonc
"layout": {
    "Media": {
        "iconsOnly": true,
    },
},
```

or globally:

```jsonc
"bookmarksStyle": "icons",
```

### Sorting

Service groups and bookmark groups can be mixed in order, **but should use different group names**. If you do not specify any bookmark groups they will all show at the bottom of the page.

**_Using the same name for a service and bookmark group can cause unexpected behavior like a bookmark group being hidden_**

Groups will sort based on the order in the layout block. You can also mix in groups defined by docker labels, e.g.

```jsonc
"layout": [
    {
        "Auto-Discovered1": null,
    },
    {
        "Configured1": null,
    },
    {
        "Configured2": null,
    },
    {
        "Auto-Discovered2": null,
    },
    {
        "Configured3": {
            "style": "row",
            "columns": 3,
        },
    },
],
```

### Nested Groups

If your services config has nested groups, you can apply settings to these groups by nesting them in the layout block
and using the same settings. For example

```jsonc
"layout": {
    "Group A": {
        "style": "row",
        "columns": 4,
    },
    "Group C": {
        "style": "row",
        "columns": 2,
        "Nested Group A": {
            "style": "row",
            "columns": 2,
        },
        "Nested Group B": {
            "style": "row",
            "columns": 2,
        },
    },
},
```

### Headers

You can hide headers for each section in the layout as well by passing `header` as false, like so:

```jsonc
"layout": {
    "Section A": {
        "header": false,
    },
    "Section B": {
        "style": "row",
        "columns": 3,
        "header": false,
    },
},
```

### Category Icons

You can also add an icon to a category under the `layout` setting similar to the [options for service icons](/configs/services/#icons), e.g.

```jsonc
"layout": {
    "Home Management & Info": {
        "icon": "home-assistant.png",
    },
    "Server Tools": {
        "icon": "https://cdn-icons-png.flaticon.com/512/252/252035.png",
    },
    // ...
},
```

### Icon Style

The default style for icons (e.g. `icon: mdi-XXXX`) is a gradient, or you can specify that prefixed icons match your theme with a 'flat' style using the setting below.
More information about prefixed icons can be found in [options for service icons](/configs/services/#icons).

```jsonc
"iconStyle": "theme", // optional, defaults to gradient
```

### Tabs

Layouts can use a tabbed view. Tabs are only active if you set the `tab` field on at least one layout group.

Tabs are sorted based on the order in the layout block. If a group has no tab specified (and tabs are set on other groups), services and bookmarks will be shown on all tabs.

Every tab can be accessed directly by visiting Foyer URL with `#Group` (name lowercase and URI-encoded) at the end of the URL.

For example, the following would create four tabs:

```jsonc
"layout": {
    // ...
    "Bookmark Group on First Tab": {
        "tab": "First",
    },
    "First Service Group": {
        "tab": "First",
        "style": "row",
        "columns": 4,
    },
    "Second Service Group": {
        "tab": "Second",
        "columns": 4,
    },
    "Third Service Group": {
        "tab": "Third",
        "style": "row",
    },
    "Bookmark Group on Fourth Tab": {
        "tab": "Fourth",
    },
    "Service Group on every Tab": {
        "style": "row",
        "columns": 4,
    },
},
```

### Full Width

You can make foyer take up the entire window width by adding:

```jsonc
"fullWidth": true,
```

### Maximum Group Columns

You can set the maximum number of columns of groups on larger screen sizes (note this is only for groups with the default `style: columns`, not groups with `style: row`) by adding:

```jsonc
"maxGroupColumns": 8, // default is 4 for services, 6 for bookmarks, max 8
```

By default foyer will max out at 4 columns for services and 6 for bookmarks, thus the minimum for this setting is _5_. Of course, if you're setting this to higher numbers, you may want to consider enabling the [fullWidth](#full-width) option as well.

If you want to set the maximum columns for bookmark groups separately, you can do so by adding:

```jsonc
"maxBookmarkGroupColumns": 6, // default is 6, max 8
```

### Collapsible sections

You can disable the collapsible feature of services & bookmarks by adding:

```jsonc
"disableCollapse": true,
```

By default the feature is enabled.

### Initially collapsed sections

You can initially collapse sections by adding the `initiallyCollapsed` option to the layout group.

```jsonc
"layout": {
    "Section A": {
        "initiallyCollapsed": true,
    },
},
```

This can also be set globally using the `groupsInitiallyCollapsed` option.

```jsonc
"groupsInitiallyCollapsed": true,
```

The value set on a group will overwrite the global setting.

A collapsed section renders its contents the first time it is opened and shows a spinner until then.

By default the feature is disabled.

### Paused widgets

Widgets, pings, site monitors and status badges send no requests while they are hidden. A card is hidden when its section is collapsed, or when it sits more than about 300 pixels outside the visible part of the page. Hidden cards keep showing their last data. They fetch again as soon as they come back into view.

When the browser tab regains focus, visible cards refresh, but no more than once a minute.

### Use Equal Height Cards

You can enable equal height cards for groups of services, this will make all cards in a row the same height.

Global setting in `settings.jsonc.njk`:

```jsonc
"useEqualHeights": true,
```

Per layout group in `settings.jsonc.njk`:

```jsonc
"useEqualHeights": false,
"layout": {
    // ...
    "Group Name": {
        "useEqualHeights": true, // overrides global setting
    },
},
```

By default the feature is disabled

## Header Style

There are currently 4 options for header styles, you can see each one below.

<img width="1000" alt="underlined" src="/assets/settings_header_style_underlined.png">

```jsonc
"headerStyle": "underlined", // default style
```

---

<img width="1000" alt="boxed" src="/assets/settings_header_style_boxed.png">

```jsonc
"headerStyle": "boxed",
```

---

<img width="1000" alt="clean" src="/assets/settings_header_style_clean.png">

```jsonc
"headerStyle": "clean",
```

---

<img width="1000" alt="boxedWidgets" src="/assets/settings_header_style_boxed_widgets.png">

```jsonc
"headerStyle": "boxedWidgets",
```

## Card Style

Service and bookmark cards use a drop shadow by default. The `hairline` style replaces it with a thin border that brightens on hover.

<img width="896" alt="default cards" src="/assets/style-default.webp">

```jsonc
// default, shadowed cards
```

---

<img width="896" alt="hairline cards" src="/assets/card-style-hairline.webp">

```jsonc
"cardStyle": "hairline",
```

## Block Style

Widget blocks (the value / label pairs inside a service card) can use the `refined` style to make values heavier and easier to read.

<img width="896" alt="default blocks" src="/assets/style-default.webp">

```jsonc
// default, standard blocks
```

---

<img width="896" alt="refined blocks" src="/assets/block-style-refined.webp">

```jsonc
"blockStyle": "refined",
```

## Font

Foyer uses Manrope by default. You can switch to IBM Plex Mono instead, either everywhere or for data only.

<img width="896" alt="IBM Plex Mono everywhere" src="/assets/font-plex.webp">

```jsonc
"font": "plex", // the whole dashboard
```

---

<img width="896" alt="IBM Plex Mono for data only" src="/assets/font-plex-data.webp">

```jsonc
"font": "plexData", // only values, stats, the clock and status tags
```

With `plexData`, labels and names stay in Manrope while numbers line up in columns.

Manrope and IBM Plex Mono are bundled with Foyer, so no external requests are made.

## Base URL

In some proxy configurations, it may be necessary to set the documents base URL. You can do this by providing a `base` value, like so:

```jsonc
"base": "http://host.local/foyer",
```

**_The URL must be a full, absolute URL, or it will be ignored by the browser._**

This setting only changes how the browser resolves relative URLs.

## Language

Set your desired language using:

```jsonc
"language": "fr",
```

The value is the name of a locale folder under `public/locales/` in the Foyer source.

`zh-CN` is automatically mapped to `zh-Hans`.

You can also specify locales e.g. for the DateTime widget, e.g. en-AU, en-GB, etc.

## Link Target

Changes the behaviour of links on the foyer,

```jsonc
"target": "_blank", // Possible options include _blank, _self, and _top
```

Use `_blank` to open links in a new tab, `_self` to open links in the same tab, and `_top` to open links in a new window.

This can also be set for individual services. Setting this at the service level overrides the one in `settings.jsonc.njk`, e.g.:

```jsonc
{
    "Example Service": {
        "href": "https://example.com/",
        // ...
        "target": "_self",
    },
},
```

## Providers

The `providers` section allows you to define shared API provider options and secrets.

```jsonc
"providers": {
    "openweathermap": "openweathermapapikey",
    "weatherapi": "weatherapiapikey",
    "finnhub": "yourfinnhubapikeyhere",
    "longhorn": {
        "url": "https://longhorn.example.com",
        "username": "admin",
        "password": "LonghornPassword", // betterleaks:allow
    },
},
```

You can then pass `provider` instead of `apiKey` in your widget configuration.

```jsonc
[
    {
        "openweathermap": {
            "latitude": 50.449684,
            "longitude": 30.525026,
            "provider": "openweathermap",
        },
    },
]
```

## Quick Launch

You can use the 'Quick Launch' feature to search services, perform a web search or open a URL. To use Quick Launch, just start typing while on your foyer (as long as the search widget doesn't have focus).

<img width="1000" alt="quicklaunch" src="/assets/settings_quick_launch.png">

There are a few optional settings for the Quick Launch feature:

- `searchDescriptions`: which lets you control whether item descriptions are included in searches. This is false by default. When enabled, results that match the item name will be placed above those that only match the description.
- `showSearchSuggestions`: show search suggestions for the internet search. If this is not specified then the setting will be inherited from the search widget. If it is not specified there either, it will default to false. For custom providers the `suggestionUrl` needs to be set in order for this to work.
- `provider`: search engine provider. If none is specified it will try to use the provider set for the Search Widget, if neither are present then internet search will be disabled.
- `hideVisitURL`: disable detecting and offering an option to open URLs. This is false by default, enabling the feature.
- `mobileButtonPosition`: enables and sets the position of the mobile quicklaunch button. Options are `top-left`, `top-right`, `bottom-left`, `bottom-right`. This is empty by default, disabling the feature.

```jsonc
"quicklaunch": {
    "searchDescriptions": true,
    "showSearchSuggestions": true,
    "hideVisitURL": true,
    "provider": "google", // google, duckduckgo, bing, baidu, brave or custom
},
```

or for a custom search:

```jsonc
"quicklaunch": {
    "provider": "custom",
    "url": "https://www.ecosia.org/search?q=",
    "target": "_blank",
    "suggestionUrl": "https://ac.ecosia.org/autocomplete?type=list&q=",
},
```

## Foyer Version

By default the release version is displayed at the bottom of the page. To hide this, use the `hideVersion` setting, like so:

```jsonc
"hideVersion": true,
```

## Show Container Stats

You can show all docker or proxmox stats expanded in `settings.jsonc.njk`:

```jsonc
"showStats": true,
```

or per-service (`services.jsonc.njk`) with:

```jsonc
{
    "Example Service": {
        // ...
        "showStats": true,
    },
},
```

If you have both set the per-service settings take precedence.

## Status Style

You can choose from the following styles for docker or k8s status, site monitor and ping: `dot` or `basic`

- The default is no value, and displays the monitor and ping response time in ms and the docker / k8s container status
- `dot` shows a green dot for a successful monitor ping or healthy status.
- `basic` shows either UP or DOWN for monitor & ping

For example:

```jsonc
"statusStyle": "dot",
```

or per-service (`services.jsonc.njk`) with:

```jsonc
{
    "Example Service": {
        // ...
        "statusStyle": "dot",
    },
},
```

If you have both set, the per-service settings take precedence.

## Instance Name

Name used by automatic Docker and Kubernetes service discovery to differentiate between multiple foyer instances.

For example:

```jsonc
"instanceName": "public",
```

## Hide Widget Error Messages

Hide the visible API error messages either globally in `settings.jsonc.njk`:

```jsonc
"hideErrors": true,
```

or per service widget (`services.jsonc.njk`) with:

```jsonc
{
    "Example Service": {
        // ...
        "widget": {
            // ...
            "hideErrors": true,
        },
    },
},
```

If either value is set to true, the error message will be hidden.

## Disable Search Engine Indexing

You can request that search engines not to index your Foyer instance by enabling the `disableIndexing` setting.

```jsonc
"disableIndexing": true,
```

When enabled, this will:

- Disallow all crawlers in `robots.txt`
- Add `<meta name="robots" content="noindex, nofollow">` tags to prevent indexing

By default this feature is disabled.
