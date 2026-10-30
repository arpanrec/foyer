export type LinkwardenCollection = {
    _count?: { links?: number };
};

// Some versions return a raw array, others wrap it as { response: [...] }
export type LinkwardenCollectionsData = LinkwardenCollection[] | { response?: LinkwardenCollection[] };

export type LinkwardenTagsData =
    | unknown[]
    | {
          response?: unknown[];
          data?: { tags?: unknown[] };
      };
