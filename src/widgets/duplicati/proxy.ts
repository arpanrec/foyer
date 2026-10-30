import { DateTime } from "luxon";

import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { asJson, formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type {
    DuplicatiBackup,
    DuplicatiLogin,
    DuplicatiNotification,
    DuplicatiProgressState,
    DuplicatiServerState,
    DuplicatiSummary,
    DuplicatiWidget,
} from "@/widgets/duplicati/types";
import widgets from "@/widgets/widgets";

const logger = createLogger("duplicatiProxyHandler");

function buildSummary(
    backups: DuplicatiBackup[],
    notifications: DuplicatiNotification[],
    serverstate: DuplicatiServerState,
    progressstate: DuplicatiProgressState
): DuplicatiSummary {
    const backupNotifications = notifications.filter((notification: DuplicatiNotification) => notification.BackupID);
    const summary = {
        jobs: backups.length,
        stored: 0,
        lastBackup: null as string | null,
        nextRun: null as string | null,
        running: serverstate?.ActiveTask && progressstate?.BackupID ? 1 : 0,
        warnings: backupNotifications.filter((notification: DuplicatiNotification) => notification.Type === "Warning")
            .length,
        errors: backupNotifications.filter((notification: DuplicatiNotification) => notification.Type === "Error")
            .length,
    };
    let latestBackupTime: DateTime | null = null;
    let nextRunTime: DateTime | null = null;

    for (const backup of backups) {
        const metadata = backup?.Backup?.Metadata ?? {};
        const lastBackup = DateTime.fromFormat(metadata.LastBackupFinished ?? "", "yyyyMMdd'T'HHmmss'Z'", {
            zone: "utc",
        });
        const nextRun = DateTime.fromISO(backup?.Schedule?.Time ?? "");

        summary.stored += Number(metadata?.TargetFilesSize) || 0;

        if (lastBackup.isValid && (!latestBackupTime || lastBackup > latestBackupTime)) {
            latestBackupTime = lastBackup;
        }

        if (nextRun.isValid && (!nextRunTime || nextRun < nextRunTime)) {
            nextRunTime = nextRun;
        }
    }

    return {
        ...summary,
        lastBackup: latestBackupTime?.toUTC().toISO() ?? null,
        nextRun: nextRunTime?.toUTC().toISO() ?? null,
    };
}

async function login(widget: DuplicatiWidget & { type: string }) {
    const loginUrl = new URL(formatApiCall(widgets[widget.type].api, { endpoint: "auth/login", ...widget }));
    const [status, , data] = await httpProxy(loginUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            Password: String(widget.password),
            RememberMe: true,
        }),
    });

    if (status !== 200) {
        throw new Error(`Unable to login to Duplicati (status ${status})`);
    }

    const body = asJson<DuplicatiLogin>(data);
    if (!body?.AccessToken) {
        throw new Error("Duplicati login response did not include an access token");
    }

    return body.AccessToken;
}

async function apiGet<T>(
    widget: DuplicatiWidget & { type: string },
    endpoint: string,
    accessToken: string,
    { allow404 = false } = {}
): Promise<T | null> {
    const url = new URL(formatApiCall(widgets[widget.type].api, { endpoint, ...widget }));
    const [status, , data] = await httpProxy(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    // e.g. progressstate 404s until a job has run
    if (status === 404 && allow404) {
        return null;
    }

    if (status !== 200) {
        throw new Error(`Duplicati request failed for ${endpoint}`);
    }

    return asJson<T>(data);
}

export default async function duplicatiProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    if (!widget.url || !widget.password) {
        return res.status(500).json({
            error: {
                message: `Duplicati widget is missing required url and password`,
            },
        });
    }

    try {
        const accessToken = await login(widget);
        const [backups, serverstate, notifications, progressstate] = await Promise.all([
            apiGet<DuplicatiBackup[]>(widget, "backups", accessToken),
            apiGet<DuplicatiServerState>(widget, "serverstate", accessToken),
            apiGet<DuplicatiNotification[]>(widget, "notifications", accessToken),
            apiGet<DuplicatiProgressState>(widget, "progressstate", accessToken, { allow404: true }),
        ]);

        const summary = buildSummary(
            Array.isArray(backups) ? backups : [],
            Array.isArray(notifications) ? notifications : [],
            serverstate ?? {},
            progressstate ?? {}
        );

        return res.status(200).json(summary);
    } catch (error) {
        logger.error("Error communicating with Duplicati: %s", error);
        return res.status(500).json({
            error: {
                message: "Error communicating with Duplicati",
            },
        });
    }
}

export { buildSummary, login };
