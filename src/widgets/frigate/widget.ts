import frigateProxyHandler from "@/widgets/frigate/proxy";

const widget = {
    api: "{url}/api/{endpoint}",
    proxyHandler: frigateProxyHandler,

    mappings: {
        stats: { endpoint: "stats" },
        events: { endpoint: "events" },
    },
};

export default widget;
