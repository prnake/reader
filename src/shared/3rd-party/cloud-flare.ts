export interface CloudFlareRenderResult {
    success: boolean;
    result?: {
        html: string;
    };
    errors?: Array<{ message: string }>;
}

export class CloudFlareHTTP {
    private apiToken: string;
    private accountId: string;

    constructor(apiToken: string, accountId?: string) {
        this.apiToken = apiToken;
        this.accountId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    }

    async renderPage(url: string): Promise<{ parsed: CloudFlareRenderResult }> {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/browser-rendering/render`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            }
        );

        if (!response.ok) {
            throw new Error(`CloudFlare render failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return { parsed: data as CloudFlareRenderResult };
    }

    async fetchBrowserRenderedHTML(options: string | { url: string }): Promise<{ parsed: CloudFlareRenderResult }> {
        const url = typeof options === 'string' ? options : options.url;
        return this.renderPage(url);
    }
}
