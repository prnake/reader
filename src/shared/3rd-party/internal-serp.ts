export interface JinaSerpSearchParams {
    q: string;
    gl?: string;
    hl?: string;
    num?: number;
}

export interface JinaSerpResult {
    title: string;
    link: string;
    url: string;
    snippet: string;
    position: number;
}

export interface JinaSerpResponse {
    results: JinaSerpResult[];
    organic?: JinaSerpResult[];
}

export class JinaSerpApiHTTP {
    private apiKey: string;
    private baseUrl = 'https://s.jina.ai';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async search(params: JinaSerpSearchParams): Promise<{ parsed: JinaSerpResponse }> {
        const searchParams = new URLSearchParams();
        searchParams.set('q', params.q);
        if (params.gl) searchParams.set('gl', params.gl);
        if (params.hl) searchParams.set('hl', params.hl);
        if (params.num) searchParams.set('num', String(params.num));

        const response = await fetch(`${this.baseUrl}?${searchParams.toString()}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Jina SERP search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return { parsed: data };
    }

    async webSearch(params: JinaSerpSearchParams): Promise<{ parsed: JinaSerpResponse }> {
        return this.search(params);
    }
}
