// Anything can be thrown, so `message` is read only when the value carries one
export function errorMessage(error: unknown): string | undefined {
    return (error as { message?: string } | null | undefined)?.message;
}

// Next.js attaches `digest` to errors forwarded from Server Components, in place of the original message
export function errorDigest(error: unknown): string | undefined {
    return (error as { digest?: string } | null | undefined)?.digest;
}

// Full text for an expandable details view: the stack (which starts with "Name: message") for an Error,
// otherwise whatever was thrown, serialized
export function errorDetails(error: unknown): string | undefined {
    if (error === null || error === undefined) {
        return undefined;
    }
    if (error instanceof Error) {
        return error.stack || `${error.name}: ${error.message}`;
    }
    if (typeof error === "object") {
        try {
            return JSON.stringify(error, null, 2);
        } catch {
            return String(error);
        }
    }
    return String(error);
}
