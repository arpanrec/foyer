import kavitaProxyHandler from "@/widgets/kavita/proxy";

const widget = {
    api: "{url}/api/{endpoint}",
    proxyHandler: kavitaProxyHandler,
    mappings: {
        info: {
            endpoint: "/",
        },
    },
};

export default widget;
