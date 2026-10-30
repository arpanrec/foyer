import { describe, it } from "vitest";

import { expectWidgetConfigShape } from "@/test-utils/widget-config";
import widget from "@/widgets/gatus/widget";

describe("gatus widget config", () => {
    it("exports a valid widget config", () => {
        expectWidgetConfigShape(widget);
    });
});
