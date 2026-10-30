// urbackup-server-api ships no type declarations. Only the members Foyer calls are declared.
declare module "urbackup-server-api" {
    export class UrbackupServer {
        constructor(options: { url: string; username?: string; password?: string });
        getStatus(options?: { clientName?: string; includeRemoved?: boolean }): Promise<unknown[]>;
        getUsage(): Promise<unknown>;
    }
}
