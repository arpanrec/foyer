import { JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import widgets from "@/widgets/widgets";

const logger = createLogger("jsonrpcProxyHandler");

export async function sendJsonRpcRequest(
    url: string | URL,
    method: string,
    params: unknown,
    widget?: Pick<WidgetConfig, "username" | "password" | "key">
): Promise<[status: number, contentType: string, body: string]> {
    const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json",
    };

    if (widget?.username && widget?.password) {
        headers.Authorization = `Basic ${Buffer.from(`${widget.username}:${widget.password}`).toString("base64")}`;
    }

    if (widget?.key) {
        headers.Authorization = `Bearer ${widget.key}`;
    }

    const client: JSONRPCClient = new JSONRPCClient(async (rpcRequest) => {
        const body = JSON.stringify(rpcRequest);
        const httpRequestParams = {
            method: "POST",
            headers,
            body,
        };

        const [status, _contentType, data] = await httpProxy(url, httpRequestParams);
        if (status === 200) {
            const json = JSON.parse(String(data));

            if (json.id === null) {
                json.id = 1;
            }

            // in order to get access to the underlying error object in the JSON response
            // you must set `result` equal to undefined
            if (json.error && json.result === null) {
                json.result = undefined;
            }
            return client.receive(json);
        }

        return Promise.reject(
            typeof data === "object" && data !== null && "error" in data && data.error ? data : new Error(String(data))
        );
    });

    try {
        const response = await client.request(method, params);
        return [200, "application/json", JSON.stringify(response)];
    } catch (e) {
        if (e instanceof JSONRPCErrorException) {
            logger.debug("Error calling JSONPRC endpoint: %s.  %s", url, e.message);
            return [
                200,
                "application/json",
                JSON.stringify({ result: null, error: { code: e.code, message: e.message } }),
            ];
        }

        logger.warn("Error calling JSONPRC endpoint: %s.  %s", url, e);
        return [500, "application/json", JSON.stringify({ result: null, error: { code: 2, message: String(e) } })];
    }
}

export default async function jsonrpcProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint: method, index } = req.query;

    if (group && service && typeof group === "string" && typeof service === "string" && typeof method === "string") {
        const widget = await getServiceWidget(group, service, index);
        const api = widget ? widgets[widget.type]?.api : undefined;

        if (!widget || !api) {
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        const mapping = Object.values(widgets[widget.type].mappings ?? {}).find((value) => value.endpoint === method);
        if (!mapping) {
            return res.status(403).json({ error: "Unsupported service endpoint" });
        }

        const url = formatApiCall(api, { ...widget });
        const [status, , data] = await sendJsonRpcRequest(url, method, mapping.params ?? null, widget);
        return res.status(status).end(data);
    }

    logger.debug("Invalid or missing proxy service type '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
}
