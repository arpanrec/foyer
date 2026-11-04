import type { ApiQueryValue, ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetMapFn } from "@/types/widget-definition";
import { withAuth } from "@/utils/auth";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import genericProxyHandler from "@/utils/proxy/handlers/generic";
import calendarProxyHandler from "@/widgets/calendar/proxy";
import widgets from "@/widgets/widgets";

const logger = createLogger("servicesProxy");

/**
 * Parses the JSON `query` parameter of a service proxy request into a map of widget option values.
 *
 * @param rawQuery The raw query-string value.
 * @returns The parsed object, or null when it is not valid JSON or not a plain object.
 */
function parseQueryParams(rawQuery: string): Record<string, unknown> | null {
    let queryParams: unknown;
    try {
        queryParams = JSON.parse(rawQuery);
    } catch {
        return null;
    }
    if (!queryParams || typeof queryParams !== "object" || Array.isArray(queryParams)) return null;
    return queryParams as Record<string, unknown>;
}

/**
 * Validates the endpoint path segments a request supplies against the names the widget allows.
 *
 * @param rawSegments The JSON-encoded segment map from the query.
 * @param allowedSegments The segment names the endpoint mapping declares.
 * @returns The URL-encoded segment values, or null when a name is missing, extra or unsafe.
 */
function getSafeSegments(rawSegments: ApiQueryValue, allowedSegments: string[] | undefined) {
    if (typeof rawSegments !== "string" || !Array.isArray(allowedSegments)) return null;

    let segments: unknown;
    try {
        segments = JSON.parse(rawSegments);
    } catch {
        return null;
    }

    if (!segments || typeof segments !== "object" || Array.isArray(segments)) return null;

    const segmentValues = segments as Record<string, unknown>;
    const keys = Object.keys(segmentValues);
    if (keys.length !== allowedSegments.length || !keys.every((key) => allowedSegments.includes(key))) return null;

    const safeSegments: Record<string, string> = {};
    for (const key of allowedSegments) {
        const value = segmentValues[key];
        if (
            typeof value !== "string" ||
            value.length === 0 ||
            value.includes("%") ||
            value.includes("/") ||
            value.includes("\\") ||
            value.includes("..")
        ) {
            return null;
        }
        safeSegments[key] = encodeURIComponent(value);
    }

    return safeSegments;
}

/**
 * Routes a service widget request to the proxy handler for the widget type, applying endpoint mappings, method checks and parameter validation.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
async function handler(req: ApiRequest, res: ApiResponse) {
    try {
        const { service, group, index } = req.query;
        const serviceWidget = await getServiceWidget(group, service, index);
        let type = serviceWidget?.type;

        // exceptions
        if (type === "calendar") type = "ical";
        else if (service === "unifi_console" && group === "unifi_console") type = "unifi_console";

        const widget = type ? widgets[type] : undefined;

        if (!widget) {
            logger.warn("Unknown proxy service type: %s", type);
            return res.status(403).json({ error: "Unknown proxy service type" });
        }

        const serviceProxyHandler = widget.proxyHandler || genericProxyHandler;

        if (serviceProxyHandler instanceof Function) {
            const endpointParam = Array.isArray(req.query["endpoint"])
                ? req.query["endpoint"][0]
                : req.query["endpoint"];
            // quick return for no endpoint services, calendar is an exception
            if (!endpointParam || serviceProxyHandler === calendarProxyHandler) {
                req.method = "GET";
                req.body = undefined;
                return await serviceProxyHandler(req, res);
            }

            // map opaque endpoints to their actual endpoint
            if (widget?.mappings) {
                const mapping = widget?.mappings?.[endpointParam];
                const mappingParams = mapping?.params;
                const optionalParams = mapping?.optionalParams;
                const map = mapping?.map as WidgetMapFn | undefined;
                const endpoint = mapping?.endpoint;
                const endpointProxy = mapping?.proxyHandler || serviceProxyHandler;

                if (mapping?.method && mapping.method !== req.method) {
                    logger.warn("Unsupported method: %s", req.method);
                    return res.status(403).json({ error: "Unsupported method" });
                }

                if (!endpoint) {
                    logger.warn("Unsupported service endpoint: %s", type);
                    return res.status(403).json({ error: "Unsupported service endpoint" });
                }

                req.method = mapping?.method || "GET";
                req.body = mapping?.body;
                req.query["endpoint"] = endpoint;

                if (mapping.segments || req.query["segments"]) {
                    const segments = getSafeSegments(req.query["segments"], mapping.segments);
                    if (!segments) {
                        logger.warn(
                            'Unsupported segments for the %s widget of service "%s" in group "%s"',
                            type,
                            service,
                            group
                        );
                        return res.status(403).json({ error: "Unsupported segment" });
                    }
                    req.query["endpoint"] = formatApiCall(endpoint, segments);
                }

                const rawQuery = Array.isArray(req.query["query"]) ? req.query["query"][0] : req.query["query"];
                if (rawQuery && (mappingParams || optionalParams)) {
                    const queryParams = parseQueryParams(rawQuery);
                    if (!queryParams) {
                        logger.warn(
                            'The query parameter is not a JSON object for the %s widget of service "%s" in group "%s"',
                            type,
                            service,
                            group
                        );
                        return res.status(400).json({ error: "Invalid query" });
                    }

                    let filteredOptionalParams: string[] = [];
                    if (optionalParams)
                        filteredOptionalParams = optionalParams.filter((p: string) => queryParams[p] !== undefined);

                    let params: string[] = [];
                    if (Array.isArray(mappingParams)) params = params.concat(mappingParams);
                    if (filteredOptionalParams) params = params.concat(filteredOptionalParams);

                    // a mapped param the widget did not send is left out instead of sent upstream as "undefined"
                    const query = new URLSearchParams(
                        params.flatMap((p): [string, string][] =>
                            queryParams[p] === undefined ? [] : [[p, String(queryParams[p])]]
                        )
                    );
                    req.query["endpoint"] = `${req.query["endpoint"]}?${query}`;
                }

                if (mapping?.headers) {
                    req.extraHeaders = mapping.headers;
                }

                if (endpointProxy instanceof Function) {
                    return await endpointProxy(req, res, map);
                }

                return await serviceProxyHandler(req, res, map);
            }

            if (widget.allowedEndpoints instanceof RegExp) {
                if (widget.allowedEndpoints.test(endpointParam)) {
                    req.method = "GET";
                    req.body = undefined;
                    return await serviceProxyHandler(req, res);
                }
            }

            logger.debug("Unmapped proxy request.");
            return res.status(403).json({ error: "Unmapped proxy request." });
        }

        logger.warn("Unknown proxy service type: %s", type);
        return res.status(403).json({ error: "Unknown proxy service type" });
    } catch (e) {
        logger.error(
            "Unexpected error proxying service '%s' in group '%s': %s",
            req.query["service"],
            req.query["group"],
            errorMessage(e) ?? String(e)
        );
        logger.debug("%o", e);
        return res.status(500).send({ error: "Unexpected error" });
    }
}

export default withAuth(handler);
