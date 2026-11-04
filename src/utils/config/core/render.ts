import { isAbsolute } from "path";

import nunjucks from "nunjucks";

// Every name that is not an absolute path is relative to the template that includes, imports or extends it, so a
// config split across folders works from wherever it lives. The search path is the filesystem root, which lets an
// absolute path point anywhere.
class ConfigTemplateLoader extends nunjucks.FileSystemLoader {
    constructor() {
        super("/", { noCache: true });
    }

    override isRelative(filename: string) {
        return !isAbsolute(filename);
    }
}

// Only environment variables with this prefix reach the template, under their full name, so the rest of the server's
// environment (Foyer's own settings, NEXTAUTH_SECRET, the host's variables) cannot be printed into the dashboard.
const TEMPLATE_VARIABLE_PREFIX = "FOYER_VAR_";

function templateVariables(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(process.env).filter(
            (entry): entry is [string, string] =>
                entry[0].startsWith(TEMPLATE_VARIABLE_PREFIX) && entry[1] !== undefined
        )
    );
}

// Renders the template at `file` with the FOYER_VAR_* environment variables as its only variables. Output is not
// escaped, since it is JSONC rather than HTML, and a variable that is not set fails the render instead of printing
// nothing.
export function renderConfigTemplate(file: string): string {
    const environment = new nunjucks.Environment(new ConfigTemplateLoader(), {
        autoescape: false,
        throwOnUndefined: true,
    });
    return environment.render(file, templateVariables());
}
