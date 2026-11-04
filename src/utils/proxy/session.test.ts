import { beforeEach, describe, expect, it } from "vitest";

import cache from "@/utils/cache";
import { cachedSession } from "@/utils/proxy/session";

describe("utils/proxy/session", () => {
    beforeEach(async () => {
        await cache.clear();
    });

    it("keeps a session for its ttl", async () => {
        let logins = 0;
        const login = async () => ({ value: `t${++logins}`, ttlMs: 60_000 });

        expect(await cachedSession("k", login)).toBe("t1");
        expect(await cachedSession("k", login)).toBe("t1");
    });

    it("hands back the token when the service gave an expiry that is not a number", async () => {
        const login = async () => ({ value: "t", ttlMs: Number.NaN });

        await expect(cachedSession("nan", login)).resolves.toBe("t");
    });
});
