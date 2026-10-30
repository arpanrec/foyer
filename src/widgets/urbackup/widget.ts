import urbackupProxyHandler from "@/widgets/urbackup/proxy";

const widget = {
    proxyHandler: urbackupProxyHandler,
    allowedEndpoints: /status/,
};

export default widget;
