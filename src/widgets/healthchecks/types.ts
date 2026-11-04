// The browser gets only whether a check uuid is configured; the uuid itself stays on the server
export type HealthchecksOptions = {
    hasUuid?: boolean;
};

export type HealthchecksCheck = {
    status: string;
};

export type HealthchecksResponse = {
    status?: string;
    last_ping?: string | null;
    checks?: HealthchecksCheck[];
};
