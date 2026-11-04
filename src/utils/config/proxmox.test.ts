import { describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({
    store: {
        getConfig: vi.fn(),
    },
}));

vi.mock("@/utils/config/store", () => ({ getConfig: store.getConfig }));

import { getProxmoxConfig } from "@/utils/config/proxmox";

describe("utils/config/proxmox", () => {
    it("reads the proxmox config", async () => {
        store.getConfig.mockReturnValueOnce({ pve: { url: "http://pve" } });

        expect(await getProxmoxConfig()).toEqual({ pve: { url: "http://pve" } });
        expect(store.getConfig).toHaveBeenCalledWith("proxmox");
    });
});
