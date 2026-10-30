import type { ApiQueryValue } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import type { WidgetMapping } from "@/types/widget-definition";
import createLogger from "@/utils/logger";
import widgets from "@/widgets/widgets";

const logger = createLogger("validateWidgetData");

export default function validateWidgetData(widget: Pick<WidgetConfig, "type">, endpoint: ApiQueryValue, data: unknown) {
    let valid = true;
    let dataParsed: unknown = data;
    let error: unknown;
    let mapping: WidgetMapping | undefined;
    const mappings = widgets[widget.type]?.mappings;
    if (mappings) {
        mapping = Object.values(mappings).find((m) => m.endpoint === endpoint);
    }

    if (mapping?.allowEmpty && Buffer.isBuffer(data) && data.length === 0) return true;

    if (Buffer.isBuffer(data)) {
        try {
            dataParsed = JSON.parse(data.toString());
        } catch (e) {
            try {
                // try once more stripping whitespace
                dataParsed = JSON.parse(data.toString().replace(/\s/g, ""));
            } catch (e2) {
                error = e || e2;
                valid = false;
            }
        }
    }

    if (dataParsed && typeof dataParsed === "object" && Object.entries(dataParsed).length) {
        const record = dataParsed as Record<string, unknown>;
        mapping?.validate?.forEach((key: string) => {
            if (record[key] === undefined) {
                valid = false;
            }
        });
    }

    if (!valid) {
        logger.error(
            `Invalid data for widget '${widget.type}' endpoint '${endpoint}':\nExpected:${mapping?.validate}\nParse error: ${
                error ?? "none"
            }\nData: ${JSON.stringify(data)}`
        );
    }

    return valid;
}
