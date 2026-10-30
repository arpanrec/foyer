import { describe, expect, it } from "vitest";

import { normalizeVersion, parseRepository, parseServicesConfig, services } from "@/widgets/releases/utils";

const defaults = {
    github: { endpoint: "https://api.github.com", token: undefined },
    gitlab: { endpoint: "https://gitlab.com/api/v4", token: undefined },
    forgejo: { endpoint: "https://codeberg.org/api/v1", token: undefined },
};

describe("widgets/releases/utils", () => {
    it.each([
        [
            { service: "github", repo: "glanceapp/glance" },
            { service: "github", repo: "glanceapp/glance" },
        ],
        [
            { service: "gitlab", repo: "group/sub/project" },
            { service: "gitlab", repo: "group/sub/project" },
        ],
        [
            { service: "forgejo", repo: "redict/redict" },
            { service: "forgejo", repo: "redict/redict" },
        ],
        [
            { service: "github", repo: " glanceapp/glance " },
            { service: "github", repo: "glanceapp/glance" },
        ],
    ])("parses %j", (entry, expected) => {
        expect(parseRepository(entry)).toEqual({ ...expected, includePrereleases: false });
    });

    it("applies the prerelease flag to github repositories only", () => {
        const repo = "glanceapp/glance";
        expect(parseRepository({ service: "github", repo }, true).includePrereleases).toBe(true);
        expect(parseRepository({ service: "github", repo }, "true").includePrereleases).toBe(true);
        expect(parseRepository({ service: "github", repo }, "yes").includePrereleases).toBe(false);
        expect(parseRepository({ service: "gitlab", repo }, true).includePrereleases).toBe(false);
        expect(parseRepository({ service: "forgejo", repo }, true).includePrereleases).toBe(false);
    });

    it.each<[unknown, string]>([
        [null, "exactly the keys service and repo"],
        ["glanceapp/glance", "exactly the keys service and repo"],
        [["a/b"], "exactly the keys service and repo"],
        [{ repo: "a/b" }, "exactly the keys service and repo"],
        [{ service: "github" }, "exactly the keys service and repo"],
        [{ service: "github", repo: "a/b", token: "x" }, "exactly the keys service and repo"],
        [{ service: "bitbucket", repo: "a/b" }, "service must be one of github, gitlab, forgejo"],
        [{ service: "codeberg", repo: "a/b" }, "service must be one of github, gitlab, forgejo"],
        [{ service: "github", repo: 42 }, "repo must be a string"],
        ...["", "glance", "a/b/c", "../etc", "a/..", "a/b?x=1", "a/b#x", "a%2fb/c", "https://github.com/a/b"].map(
            (repo): [unknown, string] => [{ service: "github", repo }, "owner/repo"]
        ),
        [{ service: "gitlab", repo: "a" }, "owner/repo"],
        [{ service: "forgejo", repo: "a/b/c" }, "owner/repo"],
    ])("rejects %j", (entry, message) => {
        expect(() => parseRepository(entry)).toThrow(message);
    });

    it("fills in public defaults for services without config", () => {
        expect(parseServicesConfig(undefined)).toEqual(defaults);
        expect(parseServicesConfig(null)).toEqual(defaults);
        expect(parseServicesConfig({})).toEqual(defaults);
    });

    it("applies per-service endpoints and tokens", () => {
        expect(
            parseServicesConfig({
                github: { token: "gh" },
                gitlab: { endpoint: "https://gitlab.example.com/api/v4/", token: "gl" },
                forgejo: { endpoint: "http://git.lan:3000/api/v1" },
            })
        ).toEqual({
            github: { endpoint: "https://api.github.com", token: "gh" },
            gitlab: { endpoint: "https://gitlab.example.com/api/v4", token: "gl" },
            forgejo: { endpoint: "http://git.lan:3000/api/v1", token: undefined },
        });
    });

    it.each([
        ["a list", [], "servicesConfig must be a map"],
        ["a string", "github", "servicesConfig must be a map"],
        ["an unknown service", { codeberg: {} }, "Unknown service in servicesConfig: codeberg"],
        ["an unknown key", { github: { url: "x" } }, "servicesConfig.github only accepts endpoint and token"],
        ["a non-map service", { github: "token" }, "servicesConfig.github only accepts endpoint and token"],
        ["a non-string token", { gitlab: { token: 1 } }, "servicesConfig.gitlab.token must be a string"],
        ["a bad endpoint", { forgejo: { endpoint: "codeberg.org" } }, "servicesConfig.forgejo.endpoint must be"],
        ["a non-http endpoint", { forgejo: { endpoint: "ftp://x" } }, "servicesConfig.forgejo.endpoint must be"],
    ])("rejects servicesConfig with %s", (_, servicesConfig, message) => {
        expect(() => parseServicesConfig(servicesConfig)).toThrow(message);
    });

    it.each([
        ["1.2.3", "v1.2.3"],
        ["V1.2.3", "v1.2.3"],
        [" v2.0 ", "v2.0"],
        ["release-1", "vrelease-1"],
        ["", ""],
        [undefined, ""],
    ])("normalizes version %j to %j", (value, expected) => {
        expect(normalizeVersion(value)).toBe(expected);
    });

    it("builds github requests and parses releases", () => {
        const { endpoint } = defaults.github;
        const latest = { ...parseRepository({ service: "github", repo: "glanceapp/glance" }), endpoint };
        const pre = { ...parseRepository({ service: "github", repo: "glanceapp/glance" }, true), endpoint };

        expect(services.github.url(latest)).toBe("https://api.github.com/repos/glanceapp/glance/releases/latest");
        expect(services.github.url(pre)).toBe("https://api.github.com/repos/glanceapp/glance/releases?per_page=10");
        expect(services.github.url({ ...latest, endpoint: "https://ghe.example.com/api/v3" })).toBe(
            "https://ghe.example.com/api/v3/repos/glanceapp/glance/releases/latest"
        );
        expect(services.github.headers("abc")).toEqual({
            Accept: "application/vnd.github+json",
            Authorization: "Bearer abc",
        });
        expect(services.github.headers()).not.toHaveProperty("Authorization");

        const release = {
            tag_name: "0.8.0",
            html_url: "https://github.com/glanceapp/glance/releases/tag/0.8.0",
            published_at: "2026-09-01T10:00:00Z",
            reactions: { "-1": 4 },
        };
        expect(services.github.toRelease(release, latest)).toEqual({
            name: "glanceapp/glance",
            version: "v0.8.0",
            url: "https://github.com/glanceapp/glance/releases/tag/0.8.0",
            date: "2026-09-01T10:00:00.000Z",
            downvotes: 4,
        });
        expect(services.github.toRelease([{ ...release, tag_name: "draft", draft: true }, release], pre).version).toBe(
            "v0.8.0"
        );
        expect(() => services.github.toRelease([], pre)).toThrow("No releases found");
    });

    it("builds gitlab requests and parses releases", () => {
        const request = {
            ...parseRepository({ service: "gitlab", repo: "group/sub/project" }),
            endpoint: defaults.gitlab.endpoint,
        };
        expect(services.gitlab.url(request)).toBe(
            "https://gitlab.com/api/v4/projects/group%2Fsub%2Fproject/releases/permalink/latest"
        );
        expect(services.gitlab.headers("tok")).toEqual({ "PRIVATE-TOKEN": "tok" });
        expect(services.gitlab.headers()).toEqual({});
        expect(
            services.gitlab.toRelease(
                { tag_name: "v1.0", released_at: "2026-09-02T00:00:00Z", _links: { self: "https://gitlab.com/r" } },
                request
            )
        ).toEqual({
            name: "group/sub/project",
            version: "v1.0",
            url: "https://gitlab.com/r",
            date: "2026-09-02T00:00:00.000Z",
        });
        expect(() => services.gitlab.toRelease({}, request)).toThrow();
    });

    it("builds forgejo requests and parses releases", () => {
        const request = {
            ...parseRepository({ service: "forgejo", repo: "redict/redict" }),
            endpoint: defaults.forgejo.endpoint,
        };
        expect(services.forgejo.url(request)).toBe("https://codeberg.org/api/v1/repos/redict/redict/releases/latest");
        expect(services.forgejo.headers("tok")).toEqual({ Authorization: "token tok" });
        expect(services.forgejo.headers()).toEqual({});
        expect(
            services.forgejo.toRelease(
                { tag_name: "7.3.0", published_at: "nope", html_url: "https://codeberg.org/r" },
                request
            )
        ).toEqual({ name: "redict/redict", version: "v7.3.0", url: "https://codeberg.org/r", date: null });
    });
});
