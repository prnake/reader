export interface CommonSerpWebResult {
    link: string;
    title: string;
    description: string;
}

export interface CommonSerpNewsResult {
    link: string;
    title: string;
    description: string;
    source: string;
    date: string;
    image?: string;
}

export interface CommonSerpImageResult {
    link: string;
    title: string;
    image_alt: string;
    source: string;
    image: string;
}

export interface CommonSerpWebResponse {
    organic: CommonSerpWebResult[];
}

export interface CommonSerpNewsResponse {
    news: CommonSerpNewsResult[];
}

export interface CommonSerpImageResponse {
    images: CommonSerpImageResult[];
}

export class CommonSerpClient {
    async queryJSON(url: string): Promise<CommonSerpWebResponse | CommonSerpNewsResponse | CommonSerpImageResponse> {
        // Mock implementation - should be replaced with actual implementation
        return { organic: [] };
    }
}

export const commonSerpClients: CommonSerpClient[] = [];
