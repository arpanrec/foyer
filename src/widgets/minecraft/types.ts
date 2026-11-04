export type MinecraftStatus = {
    online: boolean;
    version?: string;
    players?: { online: number; max: number };
};
