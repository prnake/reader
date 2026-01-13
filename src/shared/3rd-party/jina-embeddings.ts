export interface JinaEmbeddingsUserBrief {
    user_id: string;
    full_name: string;
    email: string;
    wallet: {
        total_balance: number;
    };
    metadata?: {
        speed_level?: string;
        [key: string]: any;
    };
    customRateLimits?: Record<string, any[]>;
}

export interface JinaUsageReport {
    model_name: string;
    api_endpoint: string;
    consumer: {
        id: string;
        user_id: string;
    };
    usage: {
        total_tokens: number;
    };
    labels: {
        model_name: string;
    };
}

export class JinaEmbeddingsDashboardHTTP {
    private baseUrl = 'https://embeddings-dashboard-api.jina.ai';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_apiKey: string) {
        // apiKey is passed but individual methods use bearer tokens
    }

    async validateToken(token: string): Promise<{ data: JinaEmbeddingsUserBrief }> {
        const response = await fetch(`${this.baseUrl}/api/v1/api_key/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error: any = new Error(`Token validation failed: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        return { data };
    }

    async authorization(token: string): Promise<{ data: JinaEmbeddingsUserBrief }> {
        return this.validateToken(token);
    }

    async reportUsage(token: string, usage: JinaUsageReport): Promise<any> {
        const response = await fetch(`${this.baseUrl}/api/v1/usage`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(usage),
        });

        if (!response.ok) {
            throw new Error(`Usage report failed: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }
}
