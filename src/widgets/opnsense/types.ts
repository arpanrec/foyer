export type OpnsenseOptions = {
    wan?: string;
};

export type OpnsenseActivity = {
    headers: string[];
};

export type OpnsenseInterface = {
    "bytes transmitted": number;
    "bytes received": number;
};

export type OpnsenseInterfaces = {
    interfaces: Record<string, OpnsenseInterface | undefined>;
};
