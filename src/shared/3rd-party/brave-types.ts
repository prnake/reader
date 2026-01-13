export interface WebSearchOptionalHeaderOptions {
    'X-Subscription-Token'?: string;
    'Accept-Language'?: string;
    'X-Loc-City'?: string;
    'X-Loc-Country'?: string;
    'X-Loc-Timezone'?: string;
    'X-Loc-Lat'?: string;
    'X-Loc-Long'?: string;
    'X-Loc-State'?: string;
    'X-Loc-State-Name'?: string;
    'User-Agent'?: string;
    [key: string]: string | undefined;
}

export interface BraveSearchOptions {
    count?: number;
    offset?: number;
    country?: string;
    search_lang?: string;
    safesearch?: 'off' | 'moderate' | 'strict';
}
