// urbackup-server-api ships no type declarations. Only the members Foyer calls are declared.
declare module "urbackup-server-api" {
    export class UrbackupServer {
        constructor(options: { url: string; username?: string | undefined; password?: string | undefined });
        getStatus(options?: {
            clientName?: string | undefined;
            includeRemoved?: boolean | undefined;
        }): Promise<unknown[]>;
        getUsage(): Promise<unknown>;
    }
}
