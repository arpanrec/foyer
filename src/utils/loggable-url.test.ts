import { describe, expect, it } from "vitest";

import { loggableUrl } from "@/utils/loggable-url";

describe("utils/loggable-url", () => {
    it("keeps the protocol, host and path and drops the query, hash and credentials", () => {
        expect(loggableUrl("https://user:pass@api.example.com:8443/v1/data?appid=SECRET#frag")).toBe(
            "https://api.example.com:8443/v1/data"
        );
        expect(loggableUrl(new URL("http://host/path?token=SECRET"))).toBe("http://host/path");
    });

    it("does not echo something that is not a URL", () => {
        expect(loggableUrl("not a url with SECRET")).toBe("an invalid URL");
    });
});
