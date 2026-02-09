import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';

@singleton()
export class SecretExposer extends AsyncService {
    BRAVE_SEARCH_API_KEY: string = process.env.BRAVE_SEARCH_API_KEY || '';
    SERPER_SEARCH_API_KEY: string = process.env.SERPER_SEARCH_API_KEY || '';
    JINA_EMBEDDINGS_DASHBOARD_API_KEY: string = process.env.JINA_EMBEDDINGS_DASHBOARD_API_KEY || '';
    CLOUDFLARE_API_TOKEN: string = process.env.CLOUDFLARE_API_TOKEN || '';
    CLOUD_FLARE_API_KEY: string = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUD_FLARE_API_KEY || '';
    JINA_SERP_API_KEY: string = process.env.JINA_SERP_API_KEY || '';
    BYPASS_LEVEL: string = process.env.BYPASS_LEVEL || '';
    OXYLAB_REALTIME: string = process.env.OXYLAB_REALTIME || '';

    constructor() {
        super();
    }

    override async init() {
        this.emit('ready');
    }
}

// Default export for envConfig pattern
const envConfig = {
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY || '',
    SERPER_SEARCH_API_KEY: process.env.SERPER_SEARCH_API_KEY || '',
    JINA_EMBEDDINGS_DASHBOARD_API_KEY: process.env.JINA_EMBEDDINGS_DASHBOARD_API_KEY || '',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
    CLOUD_FLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUD_FLARE_API_KEY || '',
    JINA_SERP_API_KEY: process.env.JINA_SERP_API_KEY || '',
    BYPASS_LEVEL: process.env.BYPASS_LEVEL || '',
    OXYLAB_REALTIME: process.env.OXYLAB_REALTIME || '',
};

export default envConfig;
