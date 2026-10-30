import qnapProxyHandler from "@/widgets/qnap/proxy";

const widget = {
    api: "{url}",
    proxyHandler: qnapProxyHandler,
    allowedEndpoints: /status/,
};

export default widget;
