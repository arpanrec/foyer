import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";
import { type XmlCompactNode, xmlToCompact } from "@/utils/xml";
import { fritzboxDefaultFields } from "@/widgets/fritzbox/fields";

const logger = createLogger("fritzboxProxyHandler");

// The SOAP reply is Envelope > Body > <Action>Response, and the response holds one element per returned value
function firstChild(node: XmlCompactNode | undefined): XmlCompactNode | undefined {
    const child = Object.entries(node ?? {}).find(([name]) => !name.startsWith("_"))?.[1];
    return (Array.isArray(child) ? child[0] : child) as XmlCompactNode | undefined;
}

function textOf(node: XmlCompactNode | XmlCompactNode[] | undefined): string {
    const text = (Array.isArray(node) ? node.at(-1) : node)?._text;
    return (Array.isArray(text) ? text[0] : text) || "";
}

async function requestEndpoint(apiBaseUrl: string, service: string, action: string): Promise<Record<string, string>> {
    const servicePath = service === "WANIPConnection" ? "WANIPConn1" : "WANCommonIFC1";
    const params = {
        method: "POST",
        headers: {
            "Content-Type": "text/xml; charset='utf-8'",
            SoapAction: `urn:schemas-upnp-org:service:${service}:1#${action}`,
        },
        body:
            "<?xml version='1.0' encoding='utf-8'?>" +
            "<s:Envelope s:encodingStyle='http://schemas.xmlsoap.org/soap/encoding/' xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'>" +
            "<s:Body>" +
            `<u:${action} xmlns:u='urn:schemas-upnp-org:service:${service}:1' />` +
            "</s:Body>" +
            "</s:Envelope>",
    };
    const apiUrl = `${apiBaseUrl}/igdupnp/control/${servicePath}`;
    const [status, , data] = await httpProxy(apiUrl, params);
    if (status !== 200) {
        logger.debug(`HTTP ${status} performing SoapRequest for ${service}->${action}`, data);
        throw new Error(`Failed fetching '${action}'`);
    }
    const response: Record<string, string> = {};
    try {
        const envelope = firstChild(xmlToCompact(String(data)));
        const soapResponse = firstChild(firstChild(envelope));
        for (const [name, element] of Object.entries(soapResponse ?? {})) {
            if (!name.startsWith("_")) response[name] = textOf(element as XmlCompactNode | XmlCompactNode[]);
        }
    } catch (e) {
        logger.debug(`Failed parsing ${service}->${action} response:`, data);
        throw new Error(`Failed parsing '${action}' response`);
    }

    return response;
}

export default async function fritzboxProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const serviceWidget = await getServiceWidget(group, service, index);

    if (!serviceWidget) {
        res.status(500).json({ error: { message: "Service widget not found" } });
        return;
    }

    if (!serviceWidget.url) {
        res.status(500).json({ error: { message: "Service widget url not configured" } });
        return;
    }

    const serviceWidgetUrl = new URL(serviceWidget.url);
    const port = serviceWidgetUrl.protocol === "https:" ? 49443 : 49000;
    const apiBaseUrl = `${serviceWidgetUrl.protocol}//${serviceWidgetUrl.hostname}:${port}`;

    const fields = serviceWidget.fields?.length ? serviceWidget.fields : fritzboxDefaultFields;
    serviceWidget.fields = fields;
    const requestStatusInfo = ["connectionStatus", "uptime"].some((field) => fields.includes(field));
    const requestLinkProperties = ["maxDown", "maxUp"].some((field) => fields.includes(field));
    const requestAddonInfos = ["down", "up", "received", "sent"].some((field) => fields.includes(field));
    const requestExternalIPAddress = ["externalIPAddress"].some((field) => fields.includes(field));
    const requestExternalIPv6Address = ["externalIPv6Address"].some((field) => fields.includes(field));
    const requestExternalIPv6Prefix = ["externalIPv6Prefix"].some((field) => fields.includes(field));

    await Promise.all([
        // as per http://fritz.box:49000/igddesc.xml specifications (fritz.box is a hostname of your router)
        requestStatusInfo ? requestEndpoint(apiBaseUrl, "WANIPConnection", "GetStatusInfo") : null,
        requestLinkProperties
            ? requestEndpoint(apiBaseUrl, "WANCommonInterfaceConfig", "GetCommonLinkProperties")
            : null,
        requestAddonInfos ? requestEndpoint(apiBaseUrl, "WANCommonInterfaceConfig", "GetAddonInfos") : null,
        requestExternalIPAddress ? requestEndpoint(apiBaseUrl, "WANIPConnection", "GetExternalIPAddress") : null,
        requestExternalIPv6Address
            ? requestEndpoint(apiBaseUrl, "WANIPConnection", "X_AVM_DE_GetExternalIPv6Address")
            : null,
        requestExternalIPv6Prefix ? requestEndpoint(apiBaseUrl, "WANIPConnection", "X_AVM_DE_GetIPv6Prefix") : null,
    ])
        .then(
            ([statusInfo, linkProperties, addonInfos, externalIPAddress, externalIPv6Address, externalIPv6Prefix]) => {
                const ipv6Prefix = externalIPv6Prefix?.["NewIPv6Prefix"];
                const ipv6Len = externalIPv6Prefix?.["NewPrefixLength"];

                res.status(200).json({
                    connectionStatus: statusInfo?.["NewConnectionStatus"] || "Unconfigured",
                    uptime: statusInfo?.["NewUptime"] || 0,
                    maxDown: linkProperties?.["NewLayer1DownstreamMaxBitRate"] || 0,
                    maxUp: linkProperties?.["NewLayer1UpstreamMaxBitRate"] || 0,
                    down: addonInfos?.["NewByteReceiveRate"] || 0,
                    up: addonInfos?.["NewByteSendRate"] || 0,
                    received: addonInfos?.["NewX_AVM_DE_TotalBytesReceived64"] || 0,
                    sent: addonInfos?.["NewX_AVM_DE_TotalBytesSent64"] || 0,
                    externalIPAddress: externalIPAddress?.["NewExternalIPAddress"] || null,
                    externalIPv6Address: externalIPv6Address?.["NewExternalIPv6Address"] || null,
                    externalIPv6Prefix:
                        ipv6Prefix && ipv6Len != null ? `${ipv6Prefix}/${ipv6Len}` : (ipv6Prefix ?? null),
                });
            }
        )
        .catch((error: Error) => {
            logger.error("Error getting data from the FRITZ!Box: %s", error.message);
            res.status(500).json({ error: { message: error.message } });
        });
}
