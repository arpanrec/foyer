import { describe, expect, it } from "vitest";

import { isPublicAddress } from "@/utils/public-address";

describe("utils/public-address", () => {
    it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("accepts %s", (ip) => {
        expect(isPublicAddress(ip)).toBe(true);
    });

    it.each([
        "10.0.0.5",
        "127.0.0.1",
        "0.0.0.0",
        "169.254.169.254",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.1.10",
        "100.64.0.1",
        "224.0.0.1",
        "255.255.255.255",
        "::",
        "::1",
        "fe80::1",
        "fd00::1",
        "::ffff:10.0.0.5",
        "::ffff:7f00:1",
        "not an ip",
        "localhost",
    ])("refuses %s", (ip) => {
        expect(isPublicAddress(ip)).toBe(false);
    });
});
