export type OmadaOptions = {
    site?: string;
};

// The counts the proxy answers with; which ones are present depends on the controller version
export type OmadaSummary = {
    connectedAp?: number;
    activeUser?: number;
    alerts?: number;
    connectedGateways?: number;
    connectedSwitches?: number;
};

export type OmadaSession = {
    token: string;
    cookieHeader: string | null;
};

// Every controller call answers with an error code, 0 meaning success
export type OmadaReply = {
    errorCode: number;
    msg?: string;
};

export type OmadaControllerInfo = {
    result: { omadacId: string; controllerVer: string };
};

export type OmadaLoginReply = OmadaReply & {
    result: { token: string };
};

export type OmadaSite = {
    name: string;
    siteName?: string;
    id?: string;
    key?: string;
};

// `siteList` is how v3 controllers list sites, `data` is how v4 and later do
export type OmadaSitesReply = OmadaReply & {
    result: { siteList: OmadaSite[]; data: OmadaSite[] };
};

export type OmadaGlobalStatReply = OmadaReply & {
    result: { connectedAp: number; activeUser: number; alerts: number };
};

export type OmadaOverviewReply = OmadaReply & {
    result: {
        totalClientNum: number;
        connectedApNum: number;
        connectedGatewayNum: number;
        connectedSwitchNum: number;
    };
};

export type OmadaAlertReply = OmadaReply & {
    result: { alertNum: number };
};
