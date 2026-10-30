import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http";

import { Cookie, CookieJar } from "tough-cookie";

type CookieRequestParams = {
    headers?: OutgoingHttpHeaders | readonly string[];
    cookieHeader?: string;
};

const cookieJar = new CookieJar();

export function setCookieHeader(url: string | URL, params: CookieRequestParams, { overwrite = false } = {}) {
    // add cookie header, if we have one in the jar
    const existingCookie = cookieJar.getCookieStringSync(url.toString());
    if (existingCookie) {
        if (!params.headers || Array.isArray(params.headers)) {
            params.headers = {};
        }
        const headers = params.headers as OutgoingHttpHeaders;
        const cookieHeader = params.cookieHeader ?? "Cookie";
        if (overwrite || !headers[cookieHeader]) {
            headers[cookieHeader] = existingCookie;
        }
    }
}

export function addCookieToJar(
    url: string | URL,
    headers: IncomingHttpHeaders | Headers | Record<string, string | string[] | undefined> | null | undefined
) {
    if (!headers) return;
    let cookieHeader: string | string[] | null | undefined;
    if (headers instanceof Headers) {
        cookieHeader = headers.get("set-cookie");
    } else {
        cookieHeader = headers["set-cookie"];
    }

    if (!cookieHeader || cookieHeader.length === 0) return;

    // Cookie.parse returns undefined for a header that is not a cookie
    const rawCookies: string[] = cookieHeader instanceof Array ? cookieHeader : [cookieHeader];
    const cookies = rawCookies.flatMap((raw) => {
        const cookie = Cookie.parse(raw);
        if (!cookie) return [];
        cookie.setMaxAge(60 * 60);
        return [cookie];
    });

    for (let i = 0; i < cookies.length; i += 1) {
        cookieJar.setCookieSync(cookies[i], url.toString(), { ignoreError: true });
    }
}
