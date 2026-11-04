import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http";

import type { JsonValue } from "@/types/json";

// The Node-style request and response that route handlers receive from `toRouteHandlers`
// (`utils/api-route.ts`).
export type ApiQueryValue = string | string[] | undefined;

export type ApiRequest = {
    method?: string;
    url?: string;
    headers?: IncomingHttpHeaders;
    query: Record<string, ApiQueryValue>;
    cookies?: Record<string, string>;
    body?: unknown;
    // Set by the services proxy from a widget mapping
    extraHeaders?: Record<string, string>;
};

export type ApiResponse = {
    statusCode: number;
    statusMessage?: string;
    readonly headersSent?: boolean;
    status(statusCode: number): ApiResponse;
    setHeader(name: string, value: string | number | readonly string[]): unknown;
    getHeader(name: string): string | number | string[] | undefined;
    hasHeader?(name: string): boolean;
    removeHeader?(name: string): unknown;
    writeHead(statusCode: number, headers?: OutgoingHttpHeaders): unknown;
    write?(chunk: string | Uint8Array): unknown;
    end(chunk?: string | Uint8Array): unknown;
    json(body: unknown): unknown;
    send(body?: unknown): unknown;
    redirect(statusOrUrl: number | string, url?: string): unknown;
};

export type ApiJsonBody = JsonValue;
