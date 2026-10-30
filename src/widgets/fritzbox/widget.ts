import fritzboxProxyHandler from "@/widgets/fritzbox/proxy";

const widget = {
    proxyHandler: fritzboxProxyHandler,
    allowedEndpoints: /status/,
};

export default widget;
