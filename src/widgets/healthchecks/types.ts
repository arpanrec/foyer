export type HealthchecksOptions = {
    uuid?: string;
};

export type HealthchecksCheck = {
    status: string;
};

export type HealthchecksResponse = {
    status?: string;
    last_ping?: string | null;
    checks?: HealthchecksCheck[];
};
