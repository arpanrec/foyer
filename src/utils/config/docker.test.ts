import { describe, expect, it, vi } from "vitest";

const { fs, store } = vi.hoisted(() => ({
    fs: {
        readFileSync: vi.fn((filePath) => Buffer.from(String(filePath))),
    },
    store: {
        getConfig: vi.fn(),
    },
}));

vi.mock("fs", () => ({
    readFileSync: fs.readFileSync,
}));

vi.mock("@/utils/config/store", () => ({ getConfig: store.getConfig }));

import getDockerArguments, { getDefaultDockerArgs } from "@/utils/config/docker";

describe("utils/config/docker", () => {
    it("getDefaultDockerArgs returns a socketPath on linux and host on darwin", async () => {
        expect(getDefaultDockerArgs("linux")).toEqual({ socketPath: "/var/run/docker.sock" });
        expect(getDefaultDockerArgs("darwin")).toEqual({ host: "127.0.0.1" });
    });

    it("returns default args when no server is given", async () => {
        store.getConfig.mockReturnValueOnce({});

        const args = await getDockerArguments();

        // if running on linux, should return socketPath
        if (process.platform !== "win32" && process.platform !== "darwin") {
            expect(args).toEqual({ socketPath: "/var/run/docker.sock" });
        } else {
            // otherwise, should return host
            expect(args).toEqual(expect.objectContaining({ host: expect.any(String) }));
        }
    });

    it("returns socket config when server has a socket", async () => {
        store.getConfig.mockReturnValueOnce({
            "docker-local": { socket: "/tmp/docker.sock", swarm: true },
        });

        const args = await getDockerArguments("docker-local");

        expect(args).toEqual({ conn: { socketPath: "/tmp/docker.sock" }, swarm: true });
    });

    it("returns host/port/tls/protocol/headers config when provided", async () => {
        store.getConfig.mockReturnValueOnce({
            remote: {
                host: "10.0.0.1",
                port: 2376,
                swarm: false,
                protocol: "http",
                headers: { "X-Test": "1" },
                tls: { caFile: "/certs/ca.pem", certFile: "certs/cert.pem", keyFile: "key.pem" },
            },
        });

        const args = await getDockerArguments("remote");

        expect(args).toEqual(
            expect.objectContaining({
                swarm: false,
                conn: expect.objectContaining({
                    host: "10.0.0.1",
                    port: 2376,
                    protocol: "http",
                    headers: { "X-Test": "1" },
                    ca: Buffer.from("/certs/ca.pem"),
                    cert: Buffer.from("certs/cert.pem"),
                    key: Buffer.from("key.pem"),
                }),
            })
        );
        // opened as written, relative paths included
        expect(fs.readFileSync.mock.calls.map(([filePath]) => filePath)).toEqual([
            "/certs/ca.pem",
            "certs/cert.pem",
            "key.pem",
        ]);
    });

    it("returns null when server is not configured", async () => {
        store.getConfig.mockReturnValueOnce({ other: { host: "x" } });
        expect(await getDockerArguments("missing")).toBeNull();
    });

    it("returns the raw server config when it has no host/socket overrides", async () => {
        store.getConfig.mockReturnValueOnce({
            raw: { swarm: true, something: "else" },
        });

        expect(await getDockerArguments("raw")).toEqual({ swarm: true, something: "else" });
    });
});
