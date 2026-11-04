import unifiDriveProxyHandler from "@/widgets/unifi_drive/proxy";

const widget = {
    api: "{url}{prefix}/api/{endpoint}",
    proxyHandler: unifiDriveProxyHandler,

    mappings: {
        storage: {
            endpoint: "v2/storage",
        },
    },
};

export default widget;
