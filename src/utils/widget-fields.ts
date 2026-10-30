import type { WidgetService, WidgetServiceWithFields } from "@/types/service";

export default function withWidgetFields(
    service: WidgetService,
    defaultFields: string[],
    maxFields = 4
): WidgetServiceWithFields {
    const configuredFields = service.widget.fields;
    const fields = (configuredFields?.length ? configuredFields : defaultFields).slice(0, maxFields);

    return {
        ...service,
        widget: {
            ...service.widget,
            fields,
        },
    };
}
