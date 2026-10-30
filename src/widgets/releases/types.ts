export type ReleasesOptions = {
    repositories?: unknown;
    servicesConfig?: unknown;
    includePrereleases?: boolean | string;
    limit?: number | string;
    showSourceIcon?: boolean | string;
    collapseAfter?: number | string;
};

export type ReleaseRepository = {
    service: string;
    repo: string;
    includePrereleases: boolean;
};

export type ReleaseServiceConfig = {
    endpoint: string;
    token?: string;
};

// What a service's `toRelease` returns, before the proxy adds `source`
export type ParsedRelease = {
    name: string;
    version: string;
    url?: string;
    date: string | null;
    downvotes?: number;
};

export type Release = ParsedRelease & { source: string };

export type ReleasesData = {
    releases: Release[];
    failed: number;
};

export type GithubRelease = {
    tag_name?: string;
    html_url?: string;
    published_at?: string;
    draft?: boolean;
    reactions?: Record<string, number>;
};

export type GitlabRelease = {
    tag_name?: string;
    released_at?: string;
    _links?: { self?: string };
};

export type ForgejoRelease = {
    tag_name?: string;
    html_url?: string;
    published_at?: string;
};
