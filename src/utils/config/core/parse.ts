import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

import { CONFIG_MEMBERS, SCHEMA_KEY } from "@/utils/config/core/constants";
import { isRecord } from "@/utils/config/types";

// Line and column, both from 1, of an offset in the text
function position(text: string, offset: number) {
    const before = text.slice(0, offset).split("\n");
    return { line: before.length, column: before[before.length - 1]!.length + 1 };
}

// Parses the rendered template as JSONC: comments and trailing commas are allowed. Throws on the first syntax error,
// naming its position in the rendered text.
export function parseConfigText(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
    const first = errors[0];
    if (first) {
        const { line, column } = position(text, first.offset);
        const error = new Error(
            `${printParseErrorCode(first.error)} at line ${line}, column ${column} of the rendered config`
        );
        error.name = "SyntaxError";
        throw error;
    }
    return value;
}

function describe(value: unknown) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "an array";
    return `a ${typeof value}`;
}

// The rendered config is an object, and every key it has names a member or the schema
export function checkConfigShape(value: unknown): asserts value is Record<string, unknown> {
    if (!isRecord(value)) {
        throw new Error(`The config must be a JSON object, not ${describe(value)}`);
    }
    const unknown = Object.keys(value).filter(
        (key) => key !== SCHEMA_KEY && !(CONFIG_MEMBERS as readonly string[]).includes(key)
    );
    if (unknown.length > 0) {
        throw new Error(
            `The config has unknown members: ${unknown.join(", ")}. The members are ${CONFIG_MEMBERS.join(", ")}`
        );
    }
}
