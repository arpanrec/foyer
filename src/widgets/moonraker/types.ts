export type MoonrakerPrintStats = {
    result: {
        status: {
            print_stats: {
                state: string;
                info?: { current_layer?: number | string; total_layer?: number | string } | null;
            };
        };
    };
};

export type MoonrakerDisplayStatus = {
    result: { status: { display_status: { progress: number } } };
};

export type MoonrakerWebhooks = {
    result: { status: { webhooks: { state: string } } };
};
