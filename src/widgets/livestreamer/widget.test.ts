import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "@/test-utils/widget-config";
import widget from "@/widgets/livestreamer/widget";

describe("livestreamer widget config", () => {
    it("exports a valid widget config", () => {
        expectWidgetConfigShape(widget);
        expect(widget.proxyHandler).toBeTypeOf("function");
    });
});
