// `foyer init <dir>`: a starter config folder, after upstream Homepage's src/skeleton. The config template is split the
// way the docs suggest, one file per member that foyer.config.jsonc.njk includes, with custom.css and custom.js
// included as strings.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DOCS = "https://foyer.arpanrec.com/configs";

export const CONFIG_TEMPLATE = "foyer.config.jsonc.njk";

type Member = {
    name: string;
    docs: string;
    // The member's value as JSONC
    body: string;
};

const MEMBERS: Member[] = [
    {
        name: "settings",
        docs: `${DOCS}/settings/`,
        body: `{
    "title": "Foyer",
    "theme": "dark",
    "color": "slate",
    {# API keys for the weather widgets, from environment variables. A Nunjucks comment, since Nunjucks renders
       variables inside JSONC comments too.
    "providers": {
        "openweathermap": "{{ FOYER_VAR_OPENWEATHERMAP_API_KEY }}",
        "weatherapi": "{{ FOYER_VAR_WEATHERAPI_API_KEY }}",
    },
    #}
}`,
    },
    {
        name: "services",
        docs: `${DOCS}/services/`,
        body: `[
    {
        "My First Group": [
            {
                "My First Service": {
                    "href": "http://localhost/",
                    "description": "Foyer is awesome",
                },
            },
        ],
    },
    {
        "My Second Group": [
            {
                "My Second Service": {
                    "href": "http://localhost/",
                    "description": "Foyer is the best",
                },
            },
        ],
    },
    {
        "My Third Group": [
            {
                "My Third Service": {
                    "href": "http://localhost/",
                    "description": "Foyer is 😎",
                },
            },
        ],
    },
]`,
    },
    {
        name: "bookmarks",
        docs: `${DOCS}/bookmarks/`,
        body: `[
    {
        "Developer": [{ "Github": [{ "abbr": "GH", "href": "https://github.com/" }] }],
    },
    {
        "Social": [{ "Reddit": [{ "abbr": "RE", "href": "https://reddit.com/" }] }],
    },
    {
        "Entertainment": [{ "YouTube": [{ "abbr": "YT", "href": "https://youtube.com/" }] }],
    },
]`,
    },
    {
        name: "widgets",
        docs: `${DOCS}/info-widgets/`,
        body: `[
    {
        "resources": {
            "cpu": true,
            "memory": true,
            "disk": "/",
        },
    },
    {
        "search": {
            "provider": "duckduckgo",
            "target": "_blank",
        },
    },
]`,
    },
    {
        name: "docker",
        docs: `${DOCS}/docker/`,
        body: `{
    // "my-docker": {
    //     "host": "127.0.0.1",
    //     "port": 2375,
    // },
    // "my-docker": {
    //     "socket": "/var/run/docker.sock",
    // },
}`,
    },
    {
        name: "kubernetes",
        docs: `${DOCS}/kubernetes/`,
        body: `{
    "mode": "disabled",
}`,
    },
    {
        name: "proxmox",
        docs: `${DOCS}/proxmox/`,
        body: `{
    {#
    "pve": {
        "url": "https://proxmox.host.or.ip:8006",
        "token": "username@pam!Token ID",
        "secret": "{{ FOYER_VAR_PROXMOX_SECRET }}",
    },
    #}
}`,
    },
];

function memberFile(member: Member): string {
    return `{# For configuration options and examples, see ${member.docs} #}
${member.body}
`;
}

function configFile(version: string): string {
    const members = MEMBERS.map((member) => `    "${member.name}": {% include "./${member.name}.jsonc.njk" %},`).join(
        "\n"
    );
    return `{#
    For configuration options and examples, see ${DOCS}/
    Foyer renders this Nunjucks template, and the templates it includes, to JSONC. Environment variables that
    start with FOYER_VAR_ are its variables: "{{ FOYER_VAR_MY_VARIABLE }}". Click the reload button in the dashboard
    footer after a change.
    custom.css and custom.js sit next to this file; see ${DOCS}/custom-css-js/
#}
{% set customCss %}{% include "./custom.css" %}{% endset %}
{% set customJs %}{% include "./custom.js" %}{% endset %}
{
    "$schema": "https://cdn.jsdelivr.net/npm/@arpanrec/foyer@${version}/src/foyer-config/foyer.schema.json",
${members}
    "customCss": {{ customCss | dump }},
    "customJs": {{ customJs | dump }},
}
`;
}

// Included as templates too, so the raw blocks keep their text as written. The tags sit in comments, which leaves
// empty comments behind.
const CUSTOM_CSS = `/* {% raw %} */
/* Custom CSS for Foyer, see ${DOCS}/custom-css-js/
   When authentication is on, this file is served without a sign-in, so keep secrets out of it. */
/* {% endraw %} */
`;

const CUSTOM_JS = `/* {% raw %} */
// Custom JavaScript for Foyer, see ${DOCS}/custom-css-js/
// It runs in the browser once the dashboard has loaded.
/* {% endraw %} */
`;

// Every file of the starter folder, by name
export function templateFiles(version: string): Record<string, string> {
    const files: Record<string, string> = { [CONFIG_TEMPLATE]: configFile(version) };
    for (const member of MEMBERS) {
        files[`${member.name}.jsonc.njk`] = memberFile(member);
    }
    files["custom.css"] = CUSTOM_CSS;
    files["custom.js"] = CUSTOM_JS;
    return files;
}

// Creates `dir`, which must not exist, writes the starter files into it, and returns its absolute path and file names
export function initConfigDir(dir: string, version: string): { dir: string; files: string[] } {
    const target = resolve(dir);
    mkdirSync(dirname(target), { recursive: true });
    try {
        // Without `recursive`, mkdir fails when anything already has this name
        mkdirSync(target);
    } catch (e) {
        if (e instanceof Error && "code" in e && e.code === "EEXIST") {
            throw new Error(`${target} already exists; foyer init only creates a new directory`, { cause: e });
        }
        throw e;
    }

    const files = templateFiles(version);
    for (const [name, contents] of Object.entries(files)) {
        writeFileSync(join(target, name), contents, { flag: "wx" });
    }
    return { dir: target, files: Object.keys(files) };
}
