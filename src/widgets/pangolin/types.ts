export type PangolinTarget = {
    healthStatus?: string;
};

export type PangolinSite = {
    online?: boolean;
    megabytesIn?: number;
    megabytesOut?: number;
};

export type PangolinResource = {
    targets?: PangolinTarget[];
};

export type PangolinSitesData = {
    data?: { sites?: PangolinSite[] };
};

export type PangolinResourcesData = {
    data?: { resources?: PangolinResource[] };
};
