export type NextcloudInfo = {
    ocs: {
        data: {
            nextcloud: {
                system: {
                    mem_total: string;
                    mem_free: string;
                    cpuload: number[];
                    freespace: number;
                };
                storage: { num_files: number };
                shares: { num_shares: number };
            };
            activeUsers: { last24hours: number };
        };
    };
};
