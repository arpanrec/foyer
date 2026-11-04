// What the proxy reads from the FreshRSS Google Reader API
export type FreshRssSubscriptions = {
    subscriptions: unknown[];
};

export type FreshRssUnreadCount = {
    max?: number;
};

// What the proxy sends to the component
export type FreshRssSummary = {
    subscriptions?: number;
    unread?: number;
};
