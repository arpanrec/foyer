// Anything can be thrown, so `message` is read only when the value carries one
export function errorMessage(error: unknown): string | undefined {
    return (error as { message?: string } | null | undefined)?.message;
}

// Next.js attaches `digest` to errors forwarded from Server Components, in place of the original message
export function errorDigest(error: unknown): string | undefined {
    return (error as { digest?: string } | null | undefined)?.digest;
}
