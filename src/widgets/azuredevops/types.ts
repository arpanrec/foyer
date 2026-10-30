export type AzureDevopsOptions = {
    userEmail?: string;
    repositoryId?: string;
};

export type AzureDevopsPullRequest = {
    createdBy: { uniqueName: string };
    reviewers: { vote: number }[];
};

export type AzureDevopsPullRequests = {
    errorCode?: number | null;
    message?: string;
    count?: number;
    value?: AzureDevopsPullRequest[];
};

export type AzureDevopsBuild = {
    result?: string | number;
    status: string | number;
};

export type AzureDevopsPipelines = {
    value?: AzureDevopsBuild[];
};
