import net from "node:net";

// Ranges that are not on the public internet: this host, private networks, link-local (cloud metadata), carrier-grade
// NAT, documentation and benchmark ranges, multicast and reserved space
const NON_PUBLIC = new net.BlockList();
for (const [network, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 3],
] as const) {
    NON_PUBLIC.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
    ["::", 128],
    ["::1", 128],
    ["64:ff9b::", 96],
    ["100::", 64],
    ["2001:db8::", 32],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
] as const) {
    NON_PUBLIC.addSubnet(network, prefix, "ipv6");
}

// ::ffff:a.b.c.d, as dotted or as two hex groups, is an IPv4 address inside an IPv6 one
const MAPPED_V4 = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i;

// Whether the address is a literal IP on the public internet. Text that is not an IP address is not public.
export function isPublicAddress(address: string): boolean {
    const mapped = MAPPED_V4.exec(address);
    if (mapped) {
        if (mapped[1]) return isPublicAddress(mapped[1]);
        const high = parseInt(mapped[2]!, 16);
        const low = parseInt(mapped[3]!, 16);
        return isPublicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    const family = net.isIP(address);
    if (family === 0) return false;
    return !NON_PUBLIC.check(address, family === 4 ? "ipv4" : "ipv6");
}
