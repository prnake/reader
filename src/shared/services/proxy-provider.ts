import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';

const SUPPORTED_COUNTRIES = [
    'auto', 'any', 'us', 'uk', 'gb', 'de', 'fr', 'jp', 'cn',
    'ca', 'es', 'it', 'se', 'gr', 'pt', 'nl', 'be', 'ru', 'ua', 'pl',
    'il', 'tr', 'au', 'my', 'th', 'kr', 'ph', 'sg', 'hk', 'tw', 'in',
    'pk', 'ir', 'id', 'az', 'kz', 'ae', 'mx', 'br', 'ar', 'cl', 'pe',
    'ec', 'co', 'za', 'eg', 'sa', 'dk', 'eu'
];

@singleton()
export class ProxyProviderService extends AsyncService {
    private get proxyTemplate(): string {
        return process.env.AUTO_PROXY || '';
    }

    private get isConfigured(): boolean {
        return !!this.proxyTemplate;
    }

    constructor() {
        super();
    }

    override async init() {
        if (!this.isConfigured) {
            console.warn('AUTO_PROXY environment variable not set. Proxy allocation will not work.');
        }
        this.emit('ready');
    }

    supports(country: string): boolean {
        if (!this.isConfigured) {
            return false;
        }
        return SUPPORTED_COUNTRIES.includes(country.toLowerCase());
    }

    async alloc(country: string = 'auto'): Promise<URL> {
        const template = this.proxyTemplate;
        if (!template) {
            throw new Error('AUTO_PROXY environment variable not set');
        }

        const countryLower = country.toLowerCase();

        // if (countryLower === 'none') {
        //     throw new Error('Proxy allocation disabled for "none"');
        // }

        // For 'auto' or 'any', replace {{COUNTRY}} with us
        const countryCode = (countryLower === 'auto' || countryLower === 'any') ? 'us' : countryLower;

        const url = template.replace('{{COUNTRY}}', countryCode);
        return new URL(url);
    }

    async *iterAlloc(country: string = 'auto'): AsyncGenerator<URL> {
        while (true) {
            yield await this.alloc(country);
        }
    }
}
