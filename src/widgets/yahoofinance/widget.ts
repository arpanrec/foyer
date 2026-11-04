import yahooFinanceProxyHandler from "@/widgets/yahoofinance/proxy";

// The proxy reads the markets from the service's widget config and calls Yahoo Finance itself
const widget = {
    api: "https://query1.finance.yahoo.com/{endpoint}",
    proxyHandler: yahooFinanceProxyHandler,
};

export default widget;
