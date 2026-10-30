import { asJson } from "@/utils/proxy/api-helpers";
import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";
import type { NtfyMessage } from "@/widgets/ntfy/types";

const noMessages: NtfyMessage = {
    title: null,
    message: null,
    priority: 3,
    time: null,
    tags: [],
};

const widget = {
    api: "{url}/{endpoint}",
    proxyHandler: credentialedProxyHandler,

    mappings: {
        messages: {
            endpoint: "{topic}/json?poll=1&since=latest",
            allowEmpty: true,
            map: (data: unknown): NtfyMessage => {
                if (Buffer.isBuffer(data) && data.length === 0) {
                    return noMessages;
                }

                return asJson<NtfyMessage>(data);
            },
        },
    },
};

export default widget;
