import omadaProxyHandler from "@/widgets/omada/proxy";

const widget = {
    proxyHandler: omadaProxyHandler,

    mappings: {
        info: {
            endpoint: "api/info",
        },
    },
};

export default widget;
