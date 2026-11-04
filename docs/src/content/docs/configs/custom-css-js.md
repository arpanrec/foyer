---
title: Custom CSS & JS
description: Adding Custom CSS or JS
---

Foyer supports adding your own custom css & javascript. Please do so **at your own risk**.

Custom CSS goes in the `customCss` member of the [config file](/configs/) and custom JavaScript in `customJs`, each as a string. You can then target elements in foyer with various classes / ids to customize things to your liking. Foyer serves them to the browser as `/api/config/custom.css` and `/api/config/custom.js`, and serves a missing member as empty.

Foyer reads `customCss` and `customJs` when it loads the config, so click the reload button in the dashboard footer, or restart Foyer, after changing them.

:::caution
When Foyer authentication is enabled, the custom CSS remains publicly accessible so it can style the sign-in page. Do not include secrets or sensitive internal URLs in `customCss`. The custom JavaScript remains protected and is only loaded after authentication.
:::

## Inline CSS and JS

A few rules or lines fit straight into the config file as JSON strings. This example makes the dashboard use the full width of the screen and logs a line once the dashboard has loaded:

```jsonc
{
    // ...
    "customCss": "#inner_wrapper > .container { max-width: 100%; padding-left: 1rem; padding-right: 1rem; }",
    "customJs": "console.log('Foyer custom script loaded');",
}
```

The [`fullWidth`](/configs/settings/#full-width) setting removes the width limit as well. The CSS above is useful when you want to choose the side padding or set your own maximum width.

## CSS and JS in their own files

Longer stylesheets and scripts are easier to edit in their own `.css` and `.js` files, where your editor highlights and checks them. The config template includes each file into a variable and writes it as a JSON string with the `dump` filter. A relative path is relative to the config file:

```text
config/
├── foyer.config.jsonc.njk
├── custom.css
└── custom.js
```

```jsonc title="foyer.config.jsonc.njk"
{% set customCss %}{% include "./custom.css" %}{% endset %}
{% set customJs %}{% include "./custom.js" %}{% endset %}
{
    // ...
    "customCss": {{ customCss | dump }},
    "customJs": {{ customJs | dump }},
}
```

Nunjucks renders an included file as a template, and JavaScript in particular can contain `{{`, `{%` or `{#`. Wrap each file in a `{% raw %}` block, with the tags inside comments so the file stays valid CSS or JavaScript; the tags render to empty comments:

```css title="custom.css"
/* {% raw %} */
#information-widgets {
    gap: 2rem;
}
/* {% endraw %} */
```

When Foyer runs in Docker, keep the files in the folder you mount for the config file, so the include finds them inside the container too.

A missing file fails the load, so the dashboard shows the error until the file exists and you reload. To make a file optional, use `ignore missing`, which includes nothing when the file is not there:

```jsonc
{% set customCss %}{% include "./custom.css" ignore missing %}{% endset %}
```

A larger `custom.css` could look like this:

```css
/* {% raw %} */
/* Full-width dashboard with a little side padding */
#inner_wrapper > .container {
    max-width: 100%;
    padding-left: 1rem;
    padding-right: 1rem;
}

/* Space out the information widgets */
#information-widgets {
    gap: 2rem;
}

/* Bigger clock in the datetime widget */
.information-widget-datetime span {
    font-size: 2rem;
}

/* Highlight one service, given id: "myserviceid" in its config */
#myserviceid {
    outline: 2px solid rgb(244 63 94);
    border-radius: 0.375rem;
}
/* {% endraw %} */
```

And a `custom.js`:

```js
/* {% raw %} */
// The dashboard re-renders as data arrives, so changes made to the page once can be undone.
// Watch the page and apply them again whenever it changes.
function markService() {
    const service = document.getElementById("myserviceid");
    if (service && !service.dataset.marked) {
        service.dataset.marked = "true";
        service.title = "Managed by the platform team";
    }
}

markService();
new MutationObserver(markService).observe(document.body, { childList: true, subtree: true });
/* {% endraw %} */
```

## Targeting services and bookmarks

You can also set a specific `id` for a service or bookmark to target with your custom css or javascript, e.g.

```jsonc
{
    "Service": {
        "id": "myserviceid",
        "icon": "icon.png",
        // ...
    },
},
```
