export type FileFlowsOptions = {
    version?: number;
};

// Version 1 status
export type FileFlowsStatus = {
    queue: number;
    processing: number;
    processed: number;
    time?: string;
};

// Version 2 status
export type FileFlowsStatusV2 = {
    Unprocessed: number;
    Processing: number;
    Processed: number;
    Failed: number;
};

// Which of the two applies depends on the widget's `version`
export type FileFlowsData = Partial<FileFlowsStatus & FileFlowsStatusV2>;
