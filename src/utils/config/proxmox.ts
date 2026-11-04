import { getConfig } from "@/utils/config/store";

export async function getProxmoxConfig() {
    return getConfig("proxmox");
}
