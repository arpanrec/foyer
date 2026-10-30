import qbittorrentProxyHandler from "@/widgets/qbittorrent/proxy";

const widget = {
    proxyHandler: qbittorrentProxyHandler,

    mappings: {
        torrents: {
            endpoint: "torrents/info",
        },
    },
};

export default widget;
