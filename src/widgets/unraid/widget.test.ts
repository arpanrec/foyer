import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "@/test-utils/widget-config";
import widget from "@/widgets/unraid/widget";

describe("unraid widget config", () => {
    it("exports a valid widget config", () => {
        expectWidgetConfigShape(widget);
        expect((widget as Record<string, unknown>).api).toBeUndefined();
    });
});
