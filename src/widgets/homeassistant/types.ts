export type HomeassistantQuery = {
    state?: string;
    template?: string;
    label?: string;
    value?: string;
};

export type HomeassistantOptions = {
    custom?: HomeassistantQuery[] | string;
};

export type HomeassistantBlock = {
    label?: string;
    value: string;
};
