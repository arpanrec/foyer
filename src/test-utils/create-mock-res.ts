import { vi } from "vitest";

import type { ApiResponse } from "@/types/api";

type HeaderValue = string | number | readonly string[];

// An ApiResponse that records what a handler sent. `B` is the body type a test expects to read back.
export type MockRes<B = unknown> = ApiResponse & {
    body: B;
    headers: Record<string, HeaderValue>;
    status: ReturnType<typeof vi.fn<(code: number) => MockRes<B>>>;
    json: ReturnType<typeof vi.fn<(body: unknown) => MockRes<B>>>;
    send: ReturnType<typeof vi.fn<(body?: unknown) => MockRes<B>>>;
    end: ReturnType<typeof vi.fn<(body?: string | Uint8Array) => MockRes<B>>>;
    setHeader: ReturnType<typeof vi.fn<(key: string, value: HeaderValue) => MockRes<B>>>;
};

class MockResponse<B> {
    // Null until a handler sets a status
    statusCode: number = null as never;
    // Null until a handler sends a body
    body = null as B;
    headers: Record<string, HeaderValue> = {};

    status = vi.fn((code: number) => {
        this.statusCode = code;
        return this;
    });

    json = vi.fn((body: unknown) => {
        this.body = body as B;
        return this;
    });

    send = vi.fn((body?: unknown) => {
        this.body = body as B;
        return this;
    });

    end = vi.fn((body?: string | Uint8Array) => {
        this.body = body as B;
        return this;
    });

    setHeader = vi.fn((key: string, value: HeaderValue) => {
        this.headers[key] = value;
        return this;
    });

    getHeader = (key: string) => {
        const value = this.headers[key];
        return typeof value === "object" ? [...value] : value;
    };

    writeHead = (statusCode: number) => {
        this.statusCode = statusCode;
        return this;
    };

    redirect = (statusOrUrl: number | string) => {
        if (typeof statusOrUrl === "number") this.statusCode = statusOrUrl;
        return this;
    };
}

export default function createMockRes<B = unknown>(): MockRes<B> {
    return new MockResponse<B>();
}
