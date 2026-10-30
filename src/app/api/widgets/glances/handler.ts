import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getPrivateWidgetOptions } from "@/utils/config/widget-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { parseVersionForUrl } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";

const logger = createLogger("glances");

type GlancesPrivateOptions = {
    url?: string;
    username?: string;
    password?: string;
    version: number | string | null;
};

async function retrieveFromGlancesAPI(privateWidgetOptions: GlancesPrivateOptions, endpoint: string) {
    let errorMessage;
    const url = privateWidgetOptions?.url;
    if (!url) {
        errorMessage = "Missing Glances URL";
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    const apiUrl = `${url}/api/${privateWidgetOptions.version}/${endpoint}`;
    const headers: Record<string, string> = {
        "Accept-Encoding": "application/json",
    };
    if (privateWidgetOptions.username && privateWidgetOptions.password) {
        headers.Authorization = `Basic ${Buffer.from(
            `${privateWidgetOptions.username}:${privateWidgetOptions.password}`
        ).toString("base64")}`;
    }
    const params = { method: "GET", headers };

    const [status, , data] = await httpProxy(apiUrl, params);

    if (status === 401) {
        errorMessage = `Authorization failure getting data from glances API. Data: ${String(data)}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    if (status !== 200) {
        errorMessage = `HTTP ${status} getting data from glances API. Data: ${String(data)}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    return JSON.parse(Buffer.from(data as Buffer | string).toString());
}

async function handler(req: ApiRequest, res: ApiResponse) {
    const { index, cputemp: includeCpuTemp, uptime: includeUptime, disk: includeDisks, version } = req.query;

    const privateWidgetOptions: GlancesPrivateOptions = {
        ...(await getPrivateWidgetOptions("glances", index as string)),
        version: parseVersionForUrl(version, 3),
    };

    try {
        const cpuData = await retrieveFromGlancesAPI(privateWidgetOptions, "cpu");
        const loadData = await retrieveFromGlancesAPI(privateWidgetOptions, "load");
        const memoryData = await retrieveFromGlancesAPI(privateWidgetOptions, "mem");
        const data: Record<string, unknown> = {
            cpu: cpuData,
            load: loadData,
            mem: memoryData,
        };

        // Disabled by default, dont call unless needed
        if (includeUptime) {
            data.uptime = await retrieveFromGlancesAPI(privateWidgetOptions, "uptime");
        }

        if (includeCpuTemp) {
            data.sensors = await retrieveFromGlancesAPI(privateWidgetOptions, "sensors");
        }

        if (includeDisks) {
            data.fs = await retrieveFromGlancesAPI(privateWidgetOptions, "fs");
        }

        return res.status(200).send(data);
    } catch (e) {
        return res.status(400).json({ error: errorMessage(e) });
    }
}

export default withAuth(handler);
