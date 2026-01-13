export interface WebSearchQueryParams {
    q: string;
    count?: number;
    offset?: number;
    country?: string;
    search_lang?: string;
    ui_lang?: string;
    safesearch?: 'off' | 'moderate' | 'strict';
    freshness?: string;
}

export interface WebSearchOptionalHeaderOptions {
    'X-Subscription-Token'?: string;
    headers?: Record<string, string>;
    [key: string]: string | Record<string, string> | undefined;
}

export interface BraveWebSearchResult {
    title: string;
    url: string;
    description: string;
    age?: string;
    extra_snippets?: string[];
}

export interface BraveWebSearchResponse {
    web?: {
        results: BraveWebSearchResult[];
    };
    query?: {
        original: string;
    };
}

export class BraveSearchHTTP {
    private apiKey: string;
    private baseUrl = 'https://api.search.brave.com/res/v1';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async webSearch(params: WebSearchQueryParams, options?: WebSearchOptionalHeaderOptions): Promise<{ parsed: BraveWebSearchResponse }> {
        const searchParams = new URLSearchParams();
        searchParams.set('q', params.q);
        if (params.count) searchParams.set('count', String(params.count));
        if (params.offset) searchParams.set('offset', String(params.offset));
        if (params.country) searchParams.set('country', params.country);
        if (params.safesearch) searchParams.set('safesearch', params.safesearch);

        // Extract headers from options - either directly or from headers property
        const extraHeaders: Record<string, string> = {};
        if (options) {
            if (options.headers) {
                Object.assign(extraHeaders, options.headers);
            }
            // Also check for direct header properties
            for (const [key, value] of Object.entries(options)) {
                if (key !== 'headers' && typeof value === 'string') {
                    extraHeaders[key] = value;
                }
            }
        }

        const response = await fetch(`${this.baseUrl}/web/search?${searchParams.toString()}`, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': this.apiKey,
                ...extraHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(`Brave search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return { parsed: data };
    }
}
