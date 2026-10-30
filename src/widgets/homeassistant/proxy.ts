import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";
import type { HomeassistantBlock, HomeassistantOptions, HomeassistantQuery } from "@/widgets/homeassistant/types";

const logger = createLogger("homeassistantProxyHandler");

const defaultQueries: HomeassistantQuery[] = [
    {
        template:
            "{{ states.person|selectattr('state','equalto','home')|list|length }} / {{ states.person|list|length }}",
        label: "homeassistant.people_home",
    },
    {
        template: "{{ states.light|selectattr('state','equalto','on')|list|length }} / {{ states.light|list|length }}",
        label: "homeassistant.lights_on",
    },
    {
        template:
            "{{ states.switch|selectattr('state','equalto','on')|list|length }} / {{ states.switch|list|length }}",
        label: "homeassistant.switches_on",
    },
];

function formatOutput(output: string, data: Record<string, unknown>) {
    return output.replace(/\{.*?\}/g, (match) =>
        String(
            match
                .replace(/\{|\}/g, "")
                .split(".")
                .reduce<unknown>(
                    (o, p) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : ""),
                    data
                ) ?? ""
        )
    );
}

type QueryOutcome = {
    result: [status: number, contentType: string | null | undefined, data: unknown, ...rest: unknown[]];
    output?: (data: unknown) => HomeassistantBlock;
};

async function getQuery(query: HomeassistantQuery, { url, key }: WidgetConfig): Promise<QueryOutcome> {
    const headers = { Authorization: `Bearer ${key}` };
    const { state, template, label, value } = query;
    if (state) {
        return {
            result: await httpProxy(new URL(`${url}/api/states/${state}`), {
                headers,
                method: "GET",
            }),
            output: (data: unknown) => {
                const jsonData = JSON.parse(String(data)) as Record<string, unknown>;
                return {
                    label: formatOutput(label ?? "{attributes.friendly_name}", jsonData),
                    value: formatOutput(value ?? "{state} {attributes.unit_of_measurement}", jsonData),
                };
            },
        };
    }
    if (template) {
        return {
            result: await httpProxy(new URL(`${url}/api/template`), {
                headers,
                method: "POST",
                body: JSON.stringify({ template }),
            }),
            output: (data: unknown) => ({ label, value: String(data) }),
        };
    }
    return { result: [500, null, { error: { message: `invalid query ${JSON.stringify(query)}` } }] };
}

export default async function homeassistantProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;

    if (!group || !service) {
        logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget<HomeassistantOptions>(group, service, index);
    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    let queries: HomeassistantQuery[] = defaultQueries;
    if (!widget.fields && widget.custom) {
        if (typeof widget.custom === "string") {
            try {
                widget.custom = JSON.parse(widget.custom) as HomeassistantQuery[];
            } catch (error) {
                logger.debug("Error parsing HASS widget custom label: %s", JSON.stringify(error));
                return res.status(400).json({ error: "Error parsing widget custom label" });
            }
        }
        queries = widget.custom.slice(0, 4);
    }

    const results = await Promise.all(queries.map((q) => getQuery(q, widget)));

    const err = results.find((r) => {
        const data = r.result[2];
        return Boolean(data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error);
    });
    if (err) {
        const [status, , data] = err.result;
        return res.status(status).send(data);
    }

    return res.status(200).send(
        results.map((r) => {
            const [status, , data] = r.result;
            return status === 200 && r.output ? r.output(data) : { label: status, value: String(data) };
        })
    );
}
