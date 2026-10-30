import * as yaml from "js-yaml";

const EMPTY_DOCUMENT_ERROR = "expected a document, but the input is empty";
const DEFAULT_SCHEMA = yaml.CORE_SCHEMA.withTags(yaml.timestampTag, yaml.mergeTag, yaml.legacyMapTag);

// Config documents have no fixed schema, so callers narrow the parsed value to the shape they read
export function loadYaml(input: string, options?: yaml.LoadOptions): unknown {
    try {
        return yaml.load(input, { schema: DEFAULT_SCHEMA, ...options });
    } catch (error) {
        // js-yaml v4 returned undefined for empty and comment-only documents.
        if ((error as { reason?: string } | undefined)?.reason === EMPTY_DOCUMENT_ERROR) return undefined;
        throw error;
    }
}
