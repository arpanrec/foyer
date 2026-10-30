import { createHash } from "node:crypto";
import { decode as decodeQueryString } from "node:querystring";

import type { NextRequest } from "next/server";

import type { ApiRequest, ApiResponse as ApiResponseContract } from "@/types/api";
import createLogger from "@/utils/logger";

// Route handlers keep the Node-style (req, res) API handlers. This adapter gives them the
// request and response objects the Pages Router built, including its body parsing and send().

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };
type ApiHandler = (req: ApiRequest, res: ApiResponseContract) => unknown;

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const BODY_LIMIT_BYTES = 1024 * 1024;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

class ApiError extends Error {
    constructor(
        readonly statusCode: number,
        message: string
    ) {
        super(message);
    }
}

function buildQuery(searchParams: URLSearchParams, params: RouteParams) {
    const query: Record<string, string | string[]> = {};
    for (const key of new Set(searchParams.keys())) {
        const values = searchParams.getAll(key);
        query[key] = values.length > 1 ? values : values[0];
    }
    // Dynamic route segments win over query parameters with the same name
    return { ...query, ...params };
}

async function readBody(request: Request) {
    const [rawType, ...parameters] = (request.headers.get("content-type") || "text/plain").split(";");
    const type = rawType.trim().toLowerCase();
    const charset = parameters
        .map((parameter) => parameter.trim().split("="))
        .find(([name]) => name.toLowerCase() === "charset")?.[1];

    const declaredLength = Number(request.headers.get("content-length"));
    if (declaredLength > BODY_LIMIT_BYTES) throw new ApiError(413, "Body exceeded 1mb limit");

    let buffer: Buffer;
    try {
        buffer = Buffer.from(await request.arrayBuffer());
    } catch {
        throw new ApiError(400, "Invalid body");
    }
    if (buffer.length > BODY_LIMIT_BYTES) throw new ApiError(413, "Body exceeded 1mb limit");

    const body = new TextDecoder(charset || "utf-8").decode(buffer);
    if (type === "application/json" || type === "application/ld+json") {
        if (body.length === 0) return {};
        try {
            return JSON.parse(body);
        } catch {
            throw new ApiError(400, "Invalid JSON");
        }
    }
    if (type === "application/x-www-form-urlencoded") {
        return decodeQueryString(body);
    }
    return body;
}

function etagFor(payload: string | Buffer) {
    return `W/"${createHash("sha1").update(payload).digest("base64url").slice(0, 27)}"`;
}

function isFresh(requestHeaders: Record<string, string>, etag: string) {
    const ifNoneMatch = requestHeaders["if-none-match"];
    if (!ifNoneMatch || /(?:^|,)\s*no-cache\s*(?:,|$)/.test(requestHeaders["cache-control"] ?? "")) return false;
    const strip = (tag: string) => tag.trim().replace(/^W\//, "");
    return ifNoneMatch.trim() === "*" || ifNoneMatch.split(",").some((tag) => strip(tag) === strip(etag));
}

class ApiResponse implements ApiResponseContract {
    statusCode = 200;
    statusMessage = "";
    finished = false;

    private readonly headers = new Map<string, string | string[]>();
    private readonly chunks: Buffer[] = [];
    private resolveFinished: () => void = () => {};
    readonly whenFinished = new Promise<void>((resolve) => {
        this.resolveFinished = resolve;
    });

    constructor(private readonly requestHeaders: Record<string, string>) {}

    get headersSent() {
        return this.finished;
    }

    status(statusCode: number) {
        this.statusCode = statusCode;
        return this;
    }

    setHeader(name: string, value: string | number | readonly string[]) {
        this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.map(String) : String(value));
        return this;
    }

    getHeader(name: string) {
        return this.headers.get(name.toLowerCase());
    }

    getHeaders() {
        return Object.fromEntries(this.headers);
    }

    hasHeader(name: string) {
        return this.headers.has(name.toLowerCase());
    }

    removeHeader(name: string) {
        this.headers.delete(name.toLowerCase());
    }

    writeHead(statusCode: number, headers: Record<string, string | number | string[]> = {}) {
        this.statusCode = statusCode;
        Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
        return this;
    }

    write(chunk: string | Uint8Array) {
        this.chunks.push(Buffer.from(chunk));
        return true;
    }

    end(chunk?: string | Uint8Array) {
        if (this.finished) return this;
        if (chunk !== undefined && chunk !== null) this.write(chunk);
        this.finished = true;
        this.resolveFinished();
        return this;
    }

    json(body: unknown) {
        this.setHeader("Content-Type", JSON_CONTENT_TYPE);
        return this.send(JSON.stringify(body));
    }

    send(body?: unknown) {
        if (body === null || body === undefined) return this.end();

        if (this.statusCode === 204 || this.statusCode === 304) {
            this.removeHeader("Content-Type");
            this.removeHeader("Content-Length");
            this.removeHeader("Transfer-Encoding");
            return this.end();
        }

        const isJSONLike = ["object", "number", "boolean"].includes(typeof body);
        const payload = Buffer.isBuffer(body) ? body : isJSONLike ? JSON.stringify(body) : String(body);
        const etag = etagFor(payload);
        this.setHeader("ETag", etag);
        if (isFresh(this.requestHeaders, etag)) {
            this.statusCode = 304;
            return this.end();
        }

        if (Buffer.isBuffer(body)) {
            if (!this.hasHeader("Content-Type")) this.setHeader("Content-Type", "application/octet-stream");
        } else if (isJSONLike) {
            this.setHeader("Content-Type", JSON_CONTENT_TYPE);
        }
        this.setHeader("Content-Length", Buffer.byteLength(payload));
        return this.end(payload);
    }

    redirect(statusOrUrl: number | string, url?: string) {
        const [statusCode, location] = typeof statusOrUrl === "string" ? [307, statusOrUrl] : [statusOrUrl, url];
        this.writeHead(statusCode, { Location: location ?? "" });
        return this.end(location);
    }

    toResponse(method: string) {
        const headers = new Headers();
        this.headers.forEach((value, name) => {
            [value].flat().forEach((item) => headers.append(name, item));
        });
        const hasBody = method !== "HEAD" && this.statusCode !== 204 && this.statusCode !== 304;
        return new Response(hasBody ? Buffer.concat(this.chunks) : null, {
            status: this.statusCode,
            statusText: this.statusMessage,
            headers,
        });
    }
}

function sendError(res: ApiResponse, statusCode: number, message: string) {
    res.statusCode = statusCode;
    res.statusMessage = message;
    res.end(message);
}

export function toRouteHandler(handler: ApiHandler) {
    return async function routeHandler(request: NextRequest, context: RouteContext) {
        const url = request.nextUrl ?? new URL(request.url);
        const requestHeaders = Object.fromEntries(request.headers);
        const req: ApiRequest = {
            method: request.method,
            url: `${url.pathname}${url.search}`,
            headers: requestHeaders,
            query: buildQuery(url.searchParams, (await context?.params) ?? {}),
            cookies: Object.fromEntries(request.cookies?.getAll().map(({ name, value }) => [name, value]) ?? []),
        };
        const res = new ApiResponse(requestHeaders);

        try {
            req.body = await readBody(request);
            await handler(req, res);
            await res.whenFinished;
        } catch (error) {
            if (error instanceof ApiError) {
                sendError(res, error.statusCode, error.message);
            } else {
                createLogger("api").error("Unhandled error in %s %s: %s", request.method, req.url, error);
                if (!res.finished) sendError(res, 500, "Internal Server Error");
            }
        }

        return res.toResponse(request.method);
    };
}

// Pages Router API routes answered every method, so each route handler exports all of them
export function toRouteHandlers(handler: ApiHandler) {
    const routeHandler = toRouteHandler(handler);
    return Object.fromEntries(METHODS.map((method) => [method, routeHandler])) as Record<
        (typeof METHODS)[number],
        typeof routeHandler
    >;
}
