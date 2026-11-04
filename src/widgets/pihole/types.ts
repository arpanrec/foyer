export type PiholeOptions = {
    version?: number;
};

export type PiholeSummary = {
    ads_blocked_today: string;
    ads_percentage_today: string;
    dns_queries_today: string;
    domains_being_blocked: string;
};

export type PiholeAuthResponse = {
    session?: { sid: string; validity: number };
};

export type PiholeV6Summary = {
    gravity: { domains_being_blocked: number };
    queries: { blocked: number; percent_blocked: number; total: number };
};
