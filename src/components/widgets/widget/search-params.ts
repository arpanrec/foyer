// Query string for an information widget's API route: the widget options, stringified as URLSearchParams does for a record
export function optionsToSearchParams(options: object, defaults: Record<string, string> = {}) {
    return new URLSearchParams(
        Object.entries({ ...defaults, ...options }).map(([key, value]): [string, string] => [key, String(value)])
    );
}
