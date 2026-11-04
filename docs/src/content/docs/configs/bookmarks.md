---
title: Bookmarks
description: Bookmark Configuration
---

Bookmarks are configured in the `bookmarks` member of the [config file](/configs/), written on this page as `bookmarks.jsonc.njk`. They function much the same as [Services](/configs/services/), in how groups and lists work. They're just much simpler, smaller, and contain no extra features other than being a link out.

The design of foyer expects `abbr` to be 2 letters, but is not otherwise forced.

You can also use an icon for bookmarks similar to the [options for service icons](/configs/services/#icons). If both icon and abbreviation are supplied, the icon takes precedence.

By default, the description will use the hostname of the link, but you can override it with a custom description.

```jsonc
[
    {
        "Developer": [
            {
                "Github": [
                    {
                        "abbr": "GH",
                        "href": "https://github.com/",
                    },
                ],
            },
        ],
    },
    {
        "Social": [
            {
                "Reddit": [
                    {
                        "icon": "reddit.png",
                        "href": "https://reddit.com/",
                        "description": "The front page of the internet",
                    },
                ],
            },
        ],
    },
    {
        "Entertainment": [
            {
                "YouTube": [
                    {
                        "abbr": "YT",
                        "href": "https://youtube.com/",
                    },
                ],
            },
        ],
    },
]
```

which renders to (depending on your theme, etc.):

<img width="1000" alt="Bookmarks" src="/assets/bookmarks_demo.png">
