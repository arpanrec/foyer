import WebSocket from "ws";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import type { WidgetMapFn } from "@/types/widget-definition";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { formatApiCall, sanitizeErrorURL } from "@/utils/proxy/api-helpers";
import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";
import validateWidgetData from "@/utils/proxy/validate-widget-data";
import type { TruenasRpcMessage } from "@/widgets/truenas/types";
import widgets from "@/widgets/widgets";

const logger = createLogger("truenasProxyHandler");

// Returns a value to settle the wait (an Error rejects), or undefined to keep waiting
type EventHandler = (payload: unknown) => unknown;

function waitForEvent(ws: WebSocket, handler: EventHandler, { event = "message", parseJson = true } = {}) {
    return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("TrueNAS websocket wait timed out"));
        }, 10000);

        const handleEvent = (payload: unknown) => {
            try {
                let parsed = payload;
                if (parseJson) {
                    if (Buffer.isBuffer(payload)) {
                        parsed = JSON.parse(payload.toString());
                    } else if (typeof payload === "string") {
                        parsed = JSON.parse(payload);
                    }
                }
                const handlerResult = handler(parsed);
                if (handlerResult !== undefined) {
                    cleanup();
                    if (handlerResult instanceof Error) {
                        reject(handlerResult);
                    } else {
                        resolve(handlerResult);
                    }
                }
            } catch (err) {
                cleanup();
                reject(err);
            }
        };

        const handleError = (err: Error) => {
            cleanup();
            logger.error("TrueNAS websocket error: %s", errorMessage(err) ?? err);
            reject(err);
        };

        const handleClose = () => {
            cleanup();
            logger.debug("TrueNAS websocket connection closed unexpectedly");
            reject(new Error("TrueNAS websocket closed the connection"));
        };

        function cleanup() {
            clearTimeout(timeout);
            ws.off(event, handleEvent);
            ws.off("error", handleError);
            ws.off("close", handleClose);
        }

        ws.on(event, handleEvent);
        ws.on("error", handleError);
        ws.on("close", handleClose);
    });
}

let nextId = 1;
async function sendMethod(ws: WebSocket, method: string, params: unknown[] = []) {
    const id = nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    ws.send(JSON.stringify(payload));

    return waitForEvent(ws, (raw: unknown) => {
        const message = raw as TruenasRpcMessage | null | undefined;
        if (message?.id !== id) return undefined;
        if (message?.error) {
            return new Error(message.error?.message || JSON.stringify(message.error));
        }
        return message?.result ?? message;
    });
}

async function authenticate(ws: WebSocket, widget: WidgetConfig) {
    if (widget?.key) {
        try {
            const apiKeyResult = await sendMethod(ws, "auth.login_with_api_key", [widget.key]);
            if (apiKeyResult === true) return;
            logger.warn("TrueNAS API key authentication failed, falling back to username/password when available.");
        } catch (err) {
            logger.error("TrueNAS API key authentication failed: %s", errorMessage(err) ?? err);
        }
    }

    if (widget?.username && widget?.password) {
        const loginResult = await sendMethod(ws, "auth.login", [widget.username, widget.password]);
        if (loginResult === true) return;
        logger.warn("TrueNAS username/password authentication failed.");
    }

    throw new Error("TrueNAS authentication failed");
}

export default async function truenasProxyHandler(req: ApiRequest, res: ApiResponse, map?: WidgetMapFn) {
    const { group, service, endpoint, index } = req.query;
    if (!group || !service) {
        logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    if (!endpoint) {
        return res.status(204).end();
    }

    const version = Number(widget.version ?? 1);
    if (Number.isNaN(version) || version < 2) {
        // Use legacy REST proxy for version 1
        return credentialedProxyHandler(req, res, map);
    }

    const mappingEntry = Object.values(widgets[widget.type].mappings ?? {}).find(
        (mapping) => mapping.endpoint === endpoint
    );
    const wsMethod = mappingEntry?.wsMethod;

    if (!wsMethod) {
        logger.debug("Missing wsMethod mapping for TrueNAS endpoint %s", endpoint);
        return res.status(500).json({ error: "Missing wsMethod mapping." });
    }

    try {
        let data;
        const wsUrl = new URL(formatApiCall(widgets[widget.type].wsAPI ?? "", { ...widget }));
        const useSecure = wsUrl.protocol === "https:" || Boolean(widget.key); // API key requires secure connection
        wsUrl.protocol = useSecure ? "wss:" : "ws:";
        const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
        await waitForEvent(ws, () => true, { event: "open", parseJson: false }); // wait for open
        try {
            await authenticate(ws, widget);
            data = await sendMethod(ws, wsMethod);
        } finally {
            ws.close();
        }

        if (!validateWidgetData(widget, endpoint, data)) {
            return res
                .status(500)
                .json({ error: { message: "Invalid data", url: sanitizeErrorURL(widget.url ?? ""), data } });
        }

        if (map) data = map(data);

        return res.status(200).json(data);
    } catch (err) {
        const { status } = (err ?? {}) as { status?: number };
        if (status) {
            return res.status(status).json({ error: errorMessage(err) });
        }
        logger.error("Websocket call for TrueNAS failed: %s", errorMessage(err) ?? err);
        return res.status(500).json({ error: errorMessage(err) ?? "TrueNAS websocket call failed" });
    }
}
