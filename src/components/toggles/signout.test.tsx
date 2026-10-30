// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOut, useSession } = vi.hoisted(() => ({
    signOut: vi.fn(),
    useSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signOut, useSession }));
vi.mock("next-i18next/pages", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import SignOut from "@/components/toggles/signout";

const key = "/api/services/proxy?x=1";

describe("components/toggles/signout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(["unauthenticated", "loading"])("renders nothing when session status is %s", (status) => {
        useSession.mockReturnValue({ status });

        const { container } = render(<SignOut />);

        expect(container).toBeEmptyDOMElement();
    });

    it("renders and signs out when authenticated", () => {
        useSession.mockReturnValue({ status: "authenticated" });

        const { getByRole } = render(<SignOut />);
        fireEvent.click(getByRole("button"));

        // Not "/", which would bounce straight back into the provider when auto-login is on
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/auth/signin?autologin=0" });
    });

    it("removes the saved widget cache before signing out", async () => {
        // the cleared flag lives in the module, so load a fresh copy
        vi.resetModules();
        const { default: FreshSignOut } = await import("@/components/toggles/signout");
        const { writePersistedCache: write } = await import("@/utils/swr-cache");
        useSession.mockReturnValue({ status: "authenticated" });
        write(window.localStorage, { keys: () => [key], get: () => ({ data: { count: 1 } }) });
        expect(window.localStorage.length).toBe(1);

        const { getByRole } = render(<FreshSignOut />);
        fireEvent.click(getByRole("button"));

        expect(window.localStorage.length).toBe(0);
        // the save on page unload must not bring it back
        write(window.localStorage, { keys: () => [key], get: () => ({ data: { count: 2 } }) });
        expect(window.localStorage.length).toBe(0);
    });
});
