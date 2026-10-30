// An element of the SOAP reply after xml-js turns it into JSON
export type FritzboxXmlElement = {
    name?: string;
    text?: string;
    elements?: FritzboxXmlElement[];
};

// What the proxy sends to the component. The router reports numbers as text, and a field that was
// not requested or has no value is 0 or null.
export type FritzboxStatus = {
    connectionStatus: string;
    uptime: string | number;
    maxDown: string | number;
    maxUp: string | number;
    down: string | number;
    up: string | number;
    received: string | number;
    sent: string | number;
    externalIPAddress: string | null;
    externalIPv6Address: string | null;
    externalIPv6Prefix: string | null;
};
