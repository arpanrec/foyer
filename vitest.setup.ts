import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, vi } from "vitest";

afterEach(() => {
    // Node-environment tests shouldn't require jsdom; guard cleanup accordingly.
    if (typeof document !== "undefined") cleanup();
});

beforeEach(() => {
    if (typeof window !== "undefined") {
        class MemoryStorage implements Storage {
            private store = new Map<string, string>();
            get length() {
                return this.store.size;
            }
            clear() {
                this.store.clear();
            }
            getItem(key: string) {
                return this.store.get(key) ?? null;
            }
            key(index: number) {
                return Array.from(this.store.keys())[index] ?? null;
            }
            removeItem(key: string) {
                this.store.delete(key);
            }
            setItem(key: string, value: string) {
                this.store.set(key, String(value));
            }
        }

        const memoryStorage = new MemoryStorage();
        Object.defineProperty(globalThis, "localStorage", {
            value: memoryStorage,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, "localStorage", {
            value: memoryStorage,
            configurable: true,
            writable: true,
        });
    }
});

process.env.FOYER_ALLOWED_HOSTS = "*";

// Avoid NextAuth client-side fetches during unit tests.
vi.mock("next-auth/react", () => ({
    SessionProvider: ({ children }: { children: ReactNode }) => children ?? null,
}));

// implement a couple of common formatters mocked in next-i18next
vi.mock("next-i18next/pages", () => ({
    // Keep app/page components importable in unit tests.
    appWithTranslation: (Component: ComponentType) => Component,
    useTranslation: () => ({
        i18n: { language: "en" },
        t: (key: string, opts?: { value?: unknown }) => {
            if (key === "common.number") return String(opts?.value ?? "");
            if (key === "common.percent") return String(opts?.value ?? "");
            if (key === "common.bytes") return String(opts?.value ?? "");
            if (key === "common.bbytes") return String(opts?.value ?? "");
            if (key === "common.byterate") return String(opts?.value ?? "");
            if (key === "common.bibyterate") return String(opts?.value ?? "");
            if (key === "common.bitrate") return String(opts?.value ?? "");
            if (key === "common.duration") return String(opts?.value ?? "");
            if (key === "common.ms") return String(opts?.value ?? "");
            if (key === "common.date") return String(opts?.value ?? "");
            if (key === "common.relativeDate") return String(opts?.value ?? "");
            return key;
        },
    }),
}));
