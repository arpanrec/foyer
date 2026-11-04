import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";
import cache from "@/utils/cache";

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => ({
    httpProxy: vi.fn(),
    getServiceWidget: vi.fn(),
    logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));

vi.mock("@/utils/proxy/http", () => ({
    httpProxy,
}));

import releasesProxyHandler from "@/widgets/releases/proxy";
import type { ReleasesData } from "@/widgets/releases/types";

type ReleasesBody = ReleasesData & { error?: unknown };

const req = { query: { group: "g", service: "svc", index: "0" } };

const hostOf = (url: string) => new URL(url).hostname;
const gh = (repo: string) => ({ service: "github", repo });
const json = (body: unknown) => [200, "application/json", Buffer.from(JSON.stringify(body))];
const githubRelease = (tag: string, date: string) => ({
    tag_name: tag,
    html_url: `https://github.com/r/${tag}`,
    published_at: date,
});

describe("widgets/releases/proxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await cache.clear();
    });

    it.each([
        ["missing", undefined, "repositories must be a non-empty list of { service, repo }"],
        ["a single string", "a/b", "repositories must be a non-empty list of { service, repo }"],
        ["an empty list", [], "repositories must be a non-empty list of { service, repo }"],
        [
            "a list of strings",
            ["a/b"],
            'Invalid repository "a/b": each entry must have exactly the keys service and repo',
        ],
        [
            "an entry with extra keys",
            [gh("a/b"), { ...gh("c/d"), includePrereleases: true }],
            "each entry must have exactly the keys service and repo",
        ],
        ["an unsupported service", [{ service: "dockerhub", repo: "nginx" }], "service must be one of"],
        ["an invalid repo", [gh("a/b"), gh("../x")], 'Invalid repository {"service":"github","repo":"../x"}'],
        ["a duplicate entry", [gh("a/b"), gh("c/d"), gh("a/b")], "Duplicate repository in repositories: github:a/b"],
    ])("returns 400 when repositories is %s", async (_, repositories, message) => {
        getServiceWidget.mockResolvedValueOnce({ type: "releases", repositories });
        const res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain(message);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("returns 400 when servicesConfig is invalid", async () => {
        getServiceWidget.mockResolvedValueOnce({
            type: "releases",
            repositories: [gh("a/b")],
            servicesConfig: { codeberg: { token: "x" } },
        });
        const res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe("Unknown service in servicesConfig: codeberg. Supported: github, gitlab, forgejo");
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("fetches each service with its token and sorts newest first", async () => {
        getServiceWidget.mockResolvedValue({
            type: "releases",
            repositories: [gh("a/old"), { service: "gitlab", repo: "g/new" }, { service: "forgejo", repo: "f/mid" }],
            servicesConfig: { github: { token: "gh-token" }, gitlab: { token: "gl-token" } },
        });
        httpProxy.mockImplementation(async (url) => {
            if (hostOf(url) === "api.github.com") return json(githubRelease("1.0", "2026-01-01T00:00:00Z"));
            if (hostOf(url) === "gitlab.com") {
                return json({ tag_name: "2.0", released_at: "2026-03-01T00:00:00Z", _links: { self: "https://gl/r" } });
            }
            return json({ tag_name: "1.5", published_at: "2026-02-01T00:00:00Z", html_url: "https://cb/r" });
        });

        const res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body.failed).toBe(0);
        expect(res.body.releases.map((r) => `${r.source}:${r.name}@${r.version}`)).toEqual([
            "gitlab:g/new@v2.0",
            "forgejo:f/mid@v1.5",
            "github:a/old@v1.0",
        ]);

        const headersFor = (host: string) => httpProxy.mock.calls.find(([url]) => url.includes(host))?.[1].headers;
        expect(headersFor("api.github.com").Authorization).toBe("Bearer gh-token");
        expect(headersFor("gitlab.com")["PRIVATE-TOKEN"]).toBe("gl-token");
        expect(headersFor("codeberg.org")).not.toHaveProperty("Authorization");
    });

    it("uses custom endpoints and keeps their cache entries apart", async () => {
        const repositories = [{ service: "forgejo", repo: "o/r" }];
        getServiceWidget.mockResolvedValueOnce({ type: "releases", repositories }).mockResolvedValueOnce({
            type: "releases",
            repositories,
            servicesConfig: { forgejo: { endpoint: "https://git.example.com/api/v1/", token: "fj" } },
        });
        httpProxy.mockResolvedValue(json({ tag_name: "1.0", published_at: "2026-01-01T00:00:00Z", html_url: "x" }));

        await releasesProxyHandler(req, createMockRes() as ApiResponse);
        await releasesProxyHandler(req, createMockRes() as ApiResponse);

        expect(httpProxy.mock.calls.map(([url]) => url)).toEqual([
            "https://codeberg.org/api/v1/repos/o/r/releases/latest",
            "https://git.example.com/api/v1/repos/o/r/releases/latest",
        ]);
        expect(httpProxy.mock.calls[1]![1].headers.Authorization).toBe("token fj");
    });

    it("applies the limit, defaulting to 10", async () => {
        const repositories = Array.from({ length: 12 }, (_, i) => gh(`o/r${i}`));
        httpProxy.mockImplementation(async (url) => json(githubRelease(url.split("/")[5], "2026-01-01T00:00:00Z")));

        getServiceWidget.mockResolvedValueOnce({ type: "releases", repositories });
        let res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);
        expect(res.body.releases).toHaveLength(10);

        getServiceWidget.mockResolvedValueOnce({ type: "releases", repositories, limit: "3" });
        res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);
        expect(res.body.releases).toHaveLength(3);
    });

    it("reports partial failures and errors when everything fails", async () => {
        getServiceWidget.mockResolvedValue({ type: "releases", repositories: [gh("a/ok"), gh("a/missing")] });
        httpProxy.mockImplementation(async (url) =>
            url.includes("missing")
                ? [404, "application/json", Buffer.from("{}")]
                : json(githubRelease("1.0", "2026-01-01T00:00:00Z"))
        );

        const partial = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, partial as ApiResponse);
        expect(partial.statusCode).toBe(200);
        expect(partial.body.releases).toHaveLength(1);
        expect(partial.body.failed).toBe(1);
        expect(partial.body.failures).toEqual([{ service: "github", repo: "a/missing", reason: "HTTP 404" }]);
        expect(logger.error).toHaveBeenCalledWith(
            "Failed to fetch %s release for %s: %s",
            "github",
            "a/missing",
            expect.any(Error)
        );

        await cache.clear();
        httpProxy.mockResolvedValue([500, "application/json", Buffer.from("{}")]);
        const failed = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, failed as ApiResponse);
        expect(failed.statusCode).toBe(500);
        expect(failed.body).toEqual({ error: { message: "Unable to fetch any releases" } });
    });

    it("falls back to String(reason) when a failure rejects with a non-Error value", async () => {
        getServiceWidget.mockResolvedValue({ type: "releases", repositories: [gh("a/ok"), gh("a/broken")] });
        httpProxy.mockImplementation(async (url) =>
            url.includes("broken") ? Promise.reject("network down") : json(githubRelease("1.0", "2026-01-01T00:00:00Z"))
        );

        const res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);

        expect(res.body.failures).toEqual([{ service: "github", repo: "a/broken", reason: "network down" }]);
    });

    it("caches a successful fetch for 2 hours", async () => {
        vi.useFakeTimers();
        try {
            getServiceWidget.mockResolvedValue({ type: "releases", repositories: [gh("a/b")] });
            httpProxy.mockResolvedValue(json(githubRelease("1.0", "2026-01-01T00:00:00Z")));

            await releasesProxyHandler(req, createMockRes() as ApiResponse);
            vi.advanceTimersByTime(2 * 60 * 60 * 1000 - 1);
            await releasesProxyHandler(req, createMockRes() as ApiResponse);
            expect(httpProxy).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(1);
            await releasesProxyHandler(req, createMockRes() as ApiResponse);
            expect(httpProxy).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it.each([
        ["a server error", () => Promise.resolve([503, "application/json", Buffer.from("{}")]), "HTTP 503"],
        ["a rate limit", () => Promise.resolve([403, "application/json", Buffer.from("{}")]), "HTTP 403"],
        ["a release without a tag", () => Promise.resolve(json({})), "No releases found"],
        ["a rejection with a non-Error value", () => Promise.reject("network down"), "network down"],
    ])("caches %s for 10 minutes and logs it once", async (_name, failure, reason) => {
        vi.useFakeTimers();
        try {
            getServiceWidget.mockResolvedValue({ type: "releases", repositories: [gh("a/ok"), gh("a/bad")] });
            httpProxy.mockImplementation(async (url: string) =>
                url.includes("a/bad") ? failure() : json(githubRelease("1.0", "2026-01-01T00:00:00Z"))
            );
            const badCalls = () => httpProxy.mock.calls.filter(([url]) => String(url).includes("a/bad")).length;

            const first = createMockRes<ReleasesBody>();
            await releasesProxyHandler(req, first as ApiResponse);
            vi.advanceTimersByTime(10 * 60 * 1000 - 1);
            const cached = createMockRes<ReleasesBody>();
            await releasesProxyHandler(req, cached as ApiResponse);

            expect(badCalls()).toBe(1);
            for (const res of [first, cached]) {
                expect(res.statusCode).toBe(200);
                expect(res.body.failures).toEqual([{ service: "github", repo: "a/bad", reason }]);
            }
            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(logger.debug).toHaveBeenCalledWith(
                "Using cached failure for %s release of %s: %s",
                "github",
                "a/bad",
                reason
            );

            vi.advanceTimersByTime(1);
            httpProxy.mockResolvedValue(json(githubRelease("2.0", "2026-02-01T00:00:00Z")));
            const retried = createMockRes<ReleasesBody>();
            await releasesProxyHandler(req, retried as ApiResponse);

            expect(badCalls()).toBe(2);
            expect(retried.body.failed).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("shares one upstream request between concurrent lookups of the same repository", async () => {
        getServiceWidget.mockResolvedValue({ type: "releases", repositories: [gh("a/b")] });
        let respond: (value: unknown) => void = () => {};
        httpProxy.mockReturnValue(
            new Promise((resolve) => {
                respond = resolve;
            })
        );

        const first = createMockRes<ReleasesBody>();
        const second = createMockRes<ReleasesBody>();
        const pending = Promise.all([
            releasesProxyHandler(req, first as ApiResponse),
            releasesProxyHandler(req, second as ApiResponse),
        ]);
        await vi.waitFor(() => expect(httpProxy).toHaveBeenCalled());
        respond(json(githubRelease("1.0", "2026-01-01T00:00:00Z")));
        await pending;

        expect(httpProxy).toHaveBeenCalledTimes(1);
        expect(first.body.releases[0]!.version).toBe("v1.0");
        expect(second.body.releases[0]!.version).toBe("v1.0");

        await releasesProxyHandler(req, createMockRes() as ApiResponse);
        expect(httpProxy).toHaveBeenCalledTimes(1);
    });

    it("fetches github prereleases when the widget enables them", async () => {
        getServiceWidget.mockResolvedValue({
            type: "releases",
            includePrereleases: true,
            repositories: [gh("a/b"), { service: "gitlab", repo: "g/p" }],
        });
        httpProxy.mockImplementation(async (url) =>
            hostOf(url) === "api.github.com"
                ? json([githubRelease("2.0-rc1", "2026-01-02T00:00:00Z")])
                : json({ tag_name: "1.0", released_at: "2026-01-01T00:00:00Z", _links: { self: "x" } })
        );

        const res = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, res as ApiResponse);

        expect(httpProxy.mock.calls.map(([url]) => url)).toEqual([
            "https://api.github.com/repos/a/b/releases?per_page=10",
            "https://gitlab.com/api/v4/projects/g%2Fp/releases/permalink/latest",
        ]);
        expect(res.body.releases.map((release) => release.version)).toEqual(["v2.0-rc1", "v1.0"]);
    });

    it("keeps stable and prerelease results in separate cache entries", async () => {
        getServiceWidget
            .mockResolvedValueOnce({ type: "releases", repositories: [gh("a/b")] })
            .mockResolvedValueOnce({ type: "releases", repositories: [gh("a/b")], includePrereleases: "true" });
        httpProxy
            .mockResolvedValueOnce(json(githubRelease("1.0", "2026-01-01T00:00:00Z")))
            .mockResolvedValueOnce(json([githubRelease("2.0-rc1", "2026-01-02T00:00:00Z")]));

        const stable = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, stable as ApiResponse);
        const pre = createMockRes<ReleasesBody>();
        await releasesProxyHandler(req, pre as ApiResponse);

        expect(httpProxy).toHaveBeenCalledTimes(2);
        expect(stable.body.releases[0]!.version).toBe("v1.0");
        expect(pre.body.releases[0]!.version).toBe("v2.0-rc1");
    });
});
