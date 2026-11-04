export type BackrestPlan = {
    backupsSuccessLast30days?: number | string;
    backupsFailed30days?: number | string;
    bytesAddedLast30days?: number | string;
    recentBackups?: { status?: unknown };
};

export type BackrestSummaryDashboard = {
    planSummaries?: unknown;
};

export type BackrestSummary = {
    numPlans: number;
    numSuccess30Days: number;
    numFailure30Days: number;
    numSuccessLatest: number;
    numFailureLatest: number;
    bytesAdded30Days: number;
};
