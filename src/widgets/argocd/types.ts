export type ArgocdApplication = {
    status?: {
        sync?: { status: string };
        health?: { status: string };
    };
};

export type ArgocdApplications = {
    items?: ArgocdApplication[];
};
