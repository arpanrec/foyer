export type ProxmoxVMOptions = {
    node?: string;
    vmid?: string | number;
};

export type ProxmoxVMStats = {
    cpu: number;
    mem: number;
};
