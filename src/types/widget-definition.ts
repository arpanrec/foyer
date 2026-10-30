import type { IncomingHttpHeaders } from "node:http";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { JsonValue } from "@/types/json";

// Reshapes a proxied response. `data` is the raw upstream body (a Buffer) or an already parsed
// value, so a map narrows it with `asJson<T>(data)`.
export type WidgetMapFn = (data: unknown, headers?: IncomingHttpHeaders | null) => unknown;

export type ProxyHandler = (req: ApiRequest, res: ApiResponse, map?: WidgetMapFn) => Promise<unknown> | unknown;

// What a service widget's `widget.ts` exports and the proxy layer reads from it.
export type WidgetMapping = {
    endpoint?: string;
    method?: string;
    body?: JsonValue | Record<string, unknown>;
    // the query parameters a widget forwards, or (JSON-RPC) the call's params
    params?: string[] | Record<string, unknown>;
    optionalParams?: string[];
    segments?: string[];
    headers?: Record<string, string>;
    validate?: string[];
    allowEmpty?: boolean;
    // a function that reshapes the response, or (pyload) a bag of options for the widget's own proxy
    map?: WidgetMapFn | Record<string, unknown>;
    proxyHandler?: ProxyHandler;
    // Keys read by individual widget proxies (websocket, JSON-RPC and Synology calls)
    wsMethod?: string;
    apiName?: string;
    apiMethod?: string;
    [key: string]: unknown;
};

export type WidgetDefinition = {
    api?: string;
    headers?: Record<string, string>;
    proxyHandler?: ProxyHandler;
    mappings?: Record<string, WidgetMapping>;
    allowedEndpoints?: RegExp;
    // Keys read by individual widget proxies
    loginURL?: string;
    rpcUrl?: string;
    wsAPI?: string;
    [key: string]: unknown;
};
