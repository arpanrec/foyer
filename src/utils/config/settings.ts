import type { Settings } from "@/types/service";
import { getConfig } from "@/utils/config/store";
import { isRecord } from "@/utils/config/types";

// instanceName is read from the settings config by the Docker and Kubernetes discovery
export type AppSettings = Settings & { instanceName?: string };

export async function getSettings(): Promise<AppSettings> {
    // the store turns a layout list into an object when the settings are loaded
    const loaded = await getConfig("settings");
    return (isRecord(loaded) ? loaded : {}) as AppSettings;
}
