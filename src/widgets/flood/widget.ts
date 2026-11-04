import floodProxyHandler from "@/widgets/flood/proxy";

const widget = {
    proxyHandler: floodProxyHandler,

    mappings: {
        torrents: {
            endpoint: "torrents",
        },
    },
};

export default widget;
