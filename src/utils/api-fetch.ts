// The one function the browser uses to call the Foyer API. The SWR fetcher and every direct call go through it, so
// requests are made, and their answers decoded, in one place. It resolves to the decoded JSON body and does not throw on
// an HTTP error status: an error answer is JSON like any other and the caller reads it from the result. A body that is
// not JSON rejects.

export default async function apiFetch<T = unknown>(resource: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const res = await fetch(resource, init);
    return (await res.json()) as T;
}
