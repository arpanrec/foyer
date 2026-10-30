import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getServiceWidget, validateWidgetData, logger } = vi.hoisted(() => ({
    getServiceWidget: vi.fn(),
    validateWidgetData: vi.fn(() => true),
    logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));
vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));
vi.mock("@/utils/proxy/validate-widget-data", () => ({
    default: validateWidgetData,
}));
vi.mock("@/utils/proxy/handlers/credentialed", () => ({
    default: vi.fn(),
}));
vi.mock("@/widgets/widgets", () => ({
    default: {
        truenas: {
            wsAPI: "{url}/websocket",
            mappings: {
                stats: { endpoint: "stats", wsMethod: "system.info" },
            },
        },
    },
}));

vi.mock("ws", () => {
    class FakeWebSocket {
        url: string;
        _handlers: Map<string, Set<(...args: unknown[]) => void>>;

        constructor(url: string) {
            this.url = url;
            this._handlers = new Map();
        }
        on(event: string, cb: (...args: unknown[]) => void) {
            const set = this._handlers.get(event) ?? new Set();
            set.add(cb);
            this._handlers.set(event, set);
            if (event === "open") {
                queueMicrotask(() => cb());
            }
        }
        off(event: string, cb: (...args: unknown[]) => void) {
            const set = this._handlers.get(event);
            if (set) set.delete(cb);
        }
        send(payload: string) {
            const msg = JSON.parse(payload);
            let result: unknown = true;
            if (msg.method === "system.info") {
                result = { ok: true };
            }
            queueMicrotask(() => {
                const set = this._handlers.get("message");
                if (!set) return;
                set.forEach((cb) => cb(JSON.stringify({ id: msg.id, result })));
            });
        }
        close() {}
    }

    return { default: FakeWebSocket };
});

import truenasProxyHandler from "@/widgets/truenas/proxy";

describe("widgets/truenas/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        validateWidgetData.mockReturnValue(true);
    });

    it("uses websocket calls for v2+ and returns JSON result", async () => {
        getServiceWidget.mockResolvedValue({
            type: "truenas",
            url: "http://tn",
            version: 2,
            key: "apikey",
        });

        const req = { query: { group: "g", service: "svc", endpoint: "stats", index: "0" } };
        const res = createMockRes();

        await truenasProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
