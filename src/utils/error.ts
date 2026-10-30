// Anything can be thrown, so `message` is read only when the value carries one
export function errorMessage(error: unknown): string | undefined {
    return (error as { message?: string } | null | undefined)?.message;
}
