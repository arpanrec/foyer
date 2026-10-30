import { describe, it } from "vitest";

import { expectWidgetConfigShape } from "@/test-utils/widget-config";
import widget from "@/widgets/calibreweb/widget";

describe("calibreweb widget config", () => {
    it("exports a valid widget config", () => {
        expectWidgetConfigShape(widget);
    });
});
