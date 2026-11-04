import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { buildCsp, cspHeader, cspMode, frameSources } from "@/utils/csp";
import { resetWarnOnce } from "@/utils/warn-once";

const directive = (policy: string, name: string) =>
    policy
        .split("; ")
        .find((entry) => entry.startsWith(`${name} `))
        ?.slice(name.length + 1);

describe("utils/csp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetWarnOnce();
    });
    afterEach(() => vi.unstubAllEnvs());

    describe("buildCsp", () => {
        it("lets the page load only from its own origin", () => {
            const policy = buildCsp();

            expect(directive(policy, "default-src")).toBe("'self'");
            for (const name of ["img-src", "font-src", "connect-src", "media-src", "manifest-src", "worker-src"]) {
                expect(directive(policy, name)).toMatch(/^'self'/);
            }
            // nothing in the policy names another host or a wildcard
            expect(policy).not.toMatch(/https?:|\*/);
        });

        it("allows images from data: and blob: only besides itself, for the generated favicon and charts", () => {
            expect(directive(buildCsp(), "img-src")).toBe("'self' data: blob:");
        });

        it("forbids plugins and restricts base and form targets", () => {
            const policy = buildCsp();
            expect(directive(policy, "object-src")).toBe("'none'");
            expect(directive(policy, "base-uri")).toBe("'self'");
            expect(directive(policy, "form-action")).toBe("'self'");
        });

        it("allows eval only in development", () => {
            expect(directive(buildCsp(), "script-src")).not.toContain("unsafe-eval");
            expect(directive(buildCsp({ development: true }), "script-src")).toContain("'unsafe-eval'");
        });

        it("frames itself, plus the sources it is given", () => {
            expect(directive(buildCsp(), "frame-src")).toBe("'self'");
            expect(
                directive(buildCsp({ frameSrc: ["https://grafana.lan", "https://*.example.com"] }), "frame-src")
            ).toBe("'self' https://grafana.lan https://*.example.com");
        });
    });

    describe("cspMode", () => {
        it("enforces by default", () => {
            expect(cspMode()).toBe("enforce");
        });

        it("reads FOYER_CSP in any case", () => {
            vi.stubEnv("FOYER_CSP", "Report-Only");
            expect(cspMode()).toBe("report-only");
            vi.stubEnv("FOYER_CSP", "OFF");
            expect(cspMode()).toBe("off");
        });

        it("enforces and warns once for a value it does not know", () => {
            vi.stubEnv("FOYER_CSP", "maybe");
            expect(cspMode()).toBe("enforce");
            expect(cspMode()).toBe("enforce");
            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("FOYER_CSP"), "maybe");
        });
    });

    describe("frameSources", () => {
        it("reads space and comma separated sources", () => {
            vi.stubEnv("FOYER_CSP_FRAME_SRC", "https://a.lan, https://b.lan:8443/app  *.c.lan");
            expect(frameSources()).toEqual(["https://a.lan", "https://b.lan:8443/app", "*.c.lan"]);
        });

        it("is empty without the variable", () => {
            expect(frameSources()).toEqual([]);
        });

        it("drops a source that could add a directive or a keyword, and warns naming it", () => {
            vi.stubEnv(
                "FOYER_CSP_FRAME_SRC",
                "https://ok.lan https://x.lan;script-src 'unsafe-inline' 'none' https://a'b.lan"
            );
            expect(frameSources()).toEqual(["https://ok.lan"]);
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining("FOYER_CSP_FRAME_SRC"),
                expect.any(String)
            );
        });
    });

    describe("cspHeader", () => {
        it("is an enforcing header by default", () => {
            const header = cspHeader();
            expect(header?.name).toBe("Content-Security-Policy");
            expect(header?.value).toContain("default-src 'self'");
        });

        it("is a report-only header in report-only mode", () => {
            vi.stubEnv("FOYER_CSP", "report-only");
            expect(cspHeader()?.name).toBe("Content-Security-Policy-Report-Only");
        });

        it("is absent when the policy is off", () => {
            vi.stubEnv("FOYER_CSP", "off");
            expect(cspHeader()).toBeUndefined();
        });

        it("carries the frame sources from the environment", () => {
            vi.stubEnv("FOYER_CSP_FRAME_SRC", "https://grafana.lan");
            expect(directive(cspHeader()!.value, "frame-src")).toBe("'self' https://grafana.lan");
        });
    });
});
