// The counters response keyed by feed id, and the totals the widget map reduces it to
export type MinifluxRawCounters = {
    reads: Record<string, number>;
    unreads: Record<string, number>;
};

export type MinifluxCounters = {
    read: number;
    unread: number;
};
