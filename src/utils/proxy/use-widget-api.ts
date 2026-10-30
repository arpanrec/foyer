import useSWR, { type SWRConfiguration } from "swr";

import type { WidgetConfig } from "@/types/service";
import { formatProxyUrl } from "@/utils/proxy/api-helpers";

// The proxy answers a failed upstream call with `{ error }` instead of the widget's data
type WidgetApiError = { error?: unknown };

export default function useWidgetAPI<T = unknown>(
    widget: Pick<WidgetConfig, "service_group" | "service_name" | "index">,
    endpoint?: string | null,
    queryParams?: Record<string, unknown> & { refreshInterval?: number },
    swrConfig: SWRConfiguration = {}
) {
    const config = { ...swrConfig };
    if (queryParams?.refreshInterval) {
        config.refreshInterval = queryParams.refreshInterval;
    }
    let url: string | null = formatProxyUrl(widget, endpoint, queryParams);
    if (endpoint === "") {
        url = null;
    }
    const { data, error, mutate } = useSWR<T & WidgetApiError>(url, config);
    // make the data error the top-level error
    return { data, error: data?.error ?? error, mutate };
}
