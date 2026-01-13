import { AutoCastable, Prop } from 'civkit';

export const WORLD_COUNTRIES: Record<string, string> = {
    'us': 'United States',
    'uk': 'United Kingdom',
    'ca': 'Canada',
    'au': 'Australia',
    'de': 'Germany',
    'fr': 'France',
    'jp': 'Japan',
    'cn': 'China',
    'kr': 'South Korea',
    'in': 'India',
    'br': 'Brazil',
    'mx': 'Mexico',
    'es': 'Spain',
    'it': 'Italy',
    'ru': 'Russia',
};

export const WORLD_LANGUAGES_MAP: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
};

// Array format for validation compatibility
export const WORLD_LANGUAGES = Object.entries(WORLD_LANGUAGES_MAP).map(([code, name]) => ({ code, name }));

export class SerperSearchQueryParams extends AutoCastable {
    @Prop({ required: true })
    q!: string;

    @Prop()
    gl?: string;

    @Prop()
    hl?: string;

    @Prop()
    num?: number;

    @Prop()
    page?: number;

    @Prop()
    tbs?: string;

    @Prop()
    type?: 'search' | 'images' | 'news' | 'places' | 'videos';
}

export interface SerperOrganicResult {
    title: string;
    link: string;
    snippet: string;
    position: number;
    date?: string;
    sitelinks?: Array<{ title: string; link: string }>;
}

export interface SerperImageResult {
    title: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    thumbnailUrl: string;
    source: string;
    domain: string;
    link: string;
    position: number;
}

export interface SerperNewsResult {
    title: string;
    link: string;
    snippet: string;
    date: string;
    source: string;
    imageUrl?: string;
    position: number;
}

export interface SerperWebSearchResponse {
    searchParameters: {
        q: string;
        gl?: string;
        hl?: string;
        num?: number;
        type: string;
    };
    organic: SerperOrganicResult[];
    answerBox?: any;
    knowledgeGraph?: any;
    relatedSearches?: Array<{ query: string }>;
}

export interface SerperImageSearchResponse {
    searchParameters: any;
    images: SerperImageResult[];
}

export interface SerperNewsSearchResponse {
    searchParameters: any;
    news: SerperNewsResult[];
}

abstract class SerperHTTPBase {
    protected apiKey: string;
    protected baseUrl = 'https://google.serper.dev';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    protected async makeRequest(endpoint: string, params: SerperSearchQueryParams): Promise<any> {
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: 'POST',
            headers: {
                'X-API-KEY': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const error: any = new Error(`Serper search failed: ${response.status} ${response.statusText}`);
            error.status = response.status;
            throw error;
        }

        return response.json();
    }
}

export class SerperGoogleHTTP extends SerperHTTPBase {
    async webSearch(params: SerperSearchQueryParams): Promise<{ parsed: SerperWebSearchResponse }> {
        const data = await this.makeRequest('search', { ...params, type: 'search' });
        return { parsed: data };
    }

    async imageSearch(params: SerperSearchQueryParams): Promise<{ parsed: SerperImageSearchResponse }> {
        const data = await this.makeRequest('images', { ...params, type: 'images' });
        return { parsed: data };
    }

    async newsSearch(params: SerperSearchQueryParams): Promise<{ parsed: SerperNewsSearchResponse }> {
        const data = await this.makeRequest('news', { ...params, type: 'news' });
        return { parsed: data };
    }
}

export class SerperBingHTTP extends SerperHTTPBase {
    protected override baseUrl = 'https://bing.serper.dev';

    async webSearch(params: SerperSearchQueryParams): Promise<{ parsed: SerperWebSearchResponse }> {
        const data = await this.makeRequest('search', { ...params, type: 'search' });
        return { parsed: data };
    }

    async imageSearch(params: SerperSearchQueryParams): Promise<{ parsed: SerperImageSearchResponse }> {
        const data = await this.makeRequest('images', { ...params, type: 'images' });
        return { parsed: data };
    }

    async newsSearch(params: SerperSearchQueryParams): Promise<{ parsed: SerperNewsSearchResponse }> {
        const data = await this.makeRequest('news', { ...params, type: 'news' });
        return { parsed: data };
    }
}
