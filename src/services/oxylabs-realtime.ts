import { container, singleton } from 'tsyringe';
import { AsyncService } from 'civkit/async-service';
import { SecretExposer } from '../shared/services/secrets';
import { GlobalLogger } from './logger';
import { PageSnapshot } from './puppeteer';

@singleton()
export class OxylabsRealtimeService extends AsyncService {

    logger = this.globalLogger.child({ service: this.constructor.name });
    private credentials: string = '';

    constructor(
        protected globalLogger: GlobalLogger,
        protected secretExposer: SecretExposer,
    ) {
        super(...arguments);
    }

    override async init() {
        await this.dependencyReady();
        this.credentials = this.secretExposer.OXYLAB_REALTIME || '';
        this.emit('ready');
    }

    get isAvailable(): boolean {
        return Boolean(this.credentials);
    }

    extractVideoId(url: URL): string | null {
        const hostname = url.hostname.replace('www.', '');

        if (hostname === 'youtu.be') {
            const id = url.pathname.slice(1).split('/')[0];
            return id || null;
        }

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
            const vParam = url.searchParams.get('v');
            if (vParam) {
                return vParam;
            }

            const pathMatch = url.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
            if (pathMatch) {
                return pathMatch[2];
            }
        }

        return null;
    }

    async fetchYouTubeSnapshot(url: URL, videoId: string): Promise<PageSnapshot> {
        const authHeader = 'Basic ' + Buffer.from(this.credentials).toString('base64');

        const [metadataResult, subtitlesResult] = await Promise.allSettled([
            this.fetchOxylabs(authHeader, {
                source: 'youtube_metadata',
                query: videoId,
                parse: true,
            }),
            this.fetchOxylabs(authHeader, {
                source: 'youtube_subtitles',
                query: videoId,
            }),
        ]);

        const metadataRaw = metadataResult.status === 'fulfilled' ? metadataResult.value : null;
        const subtitlesRaw = subtitlesResult.status === 'fulfilled' ? subtitlesResult.value : null;

        if (!metadataRaw && !subtitlesRaw) {
            throw new Error(`Both Oxylabs YouTube requests failed for video ${videoId}`);
        }

        // Metadata: content.results contains the actual fields
        const metadata = metadataRaw?.results || null;
        const html = this.buildHTML(url, videoId, metadata, subtitlesRaw);

        return {
            href: url.toString(),
            html,
            title: metadata?.title || `YouTube Video ${videoId}`,
            text: '',
        } as PageSnapshot;
    }

    private async fetchOxylabs(authHeader: string, body: Record<string, unknown>): Promise<any> {
        const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Oxylabs API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data.results?.length) {
            throw new Error(`Oxylabs returned no results for ${body.source}`);
        }

        const result = data.results[0];
        return result.content;
    }

    private buildHTML(url: URL, videoId: string, metadata: any, subtitlesContent: any): string {
        const parts: string[] = ['<article>'];

        const title = metadata?.title || `YouTube Video ${videoId}`;
        parts.push(`<h1>${this.escapeHtml(title)}</h1>`);

        // Video information section
        const infoItems: string[] = [];
        if (metadata) {
            if (metadata.uploader) infoItems.push(`<li><strong>Channel:</strong> ${this.escapeHtml(String(metadata.uploader))}</li>`);
            if (metadata.upload_date) infoItems.push(`<li><strong>Published:</strong> ${this.escapeHtml(this.formatDate(metadata.upload_date))}</li>`);
            if (metadata.view_count != null) infoItems.push(`<li><strong>Views:</strong> ${this.escapeHtml(String(metadata.view_count))}</li>`);
            if (metadata.like_count != null) infoItems.push(`<li><strong>Likes:</strong> ${this.escapeHtml(String(metadata.like_count))}</li>`);
            if (metadata.duration != null) infoItems.push(`<li><strong>Duration:</strong> ${this.escapeHtml(this.formatDuration(metadata.duration))}</li>`);
            if (metadata.categories?.length) infoItems.push(`<li><strong>Category:</strong> ${this.escapeHtml(metadata.categories.join(', '))}</li>`);
        }

        if (infoItems.length) {
            parts.push('<h2>Video Information</h2>');
            parts.push(`<ul>${infoItems.join('')}</ul>`);
        }

        // Description section
        if (metadata?.description) {
            parts.push('<h2>Description</h2>');
            const descLines = String(metadata.description).split('\n')
                .map(line => `<p>${this.escapeHtml(line)}</p>`);
            parts.push(descLines.join('\n'));
        }

        // Transcript section
        const transcript = this.extractTranscript(subtitlesContent);
        if (transcript) {
            parts.push('<h2>Transcript</h2>');
            const transcriptLines = transcript.split('\n')
                .map(line => `<p>${this.escapeHtml(line)}</p>`);
            parts.push(transcriptLines.join('\n'));
        }

        parts.push('</article>');

        return `<!DOCTYPE html><html><head><title>${this.escapeHtml(title)}</title></head><body>${parts.join('\n')}</body></html>`;
    }

    private extractTranscript(subtitlesContent: any): string | null {
        if (!subtitlesContent) {
            return null;
        }

        // subtitlesContent is a JSON string: {"auto_generated":{"en":{"events":[...]}}} or {"manual":{"en":{"events":[...]}}}
        let parsed: any;
        if (typeof subtitlesContent === 'string') {
            try {
                parsed = JSON.parse(subtitlesContent);
            } catch {
                return null;
            }
        } else {
            parsed = subtitlesContent;
        }

        // Try manual subtitles first, then auto_generated
        const langGroups = parsed.manual || parsed.auto_generated;
        if (!langGroups) {
            return null;
        }

        // Pick first available language (prefer 'en')
        const langData = langGroups.en || langGroups[Object.keys(langGroups)[0]];
        if (!langData?.events) {
            return null;
        }

        const lines: string[] = [];
        for (const event of langData.events) {
            if (!event.segs) {
                continue;
            }
            const eventText = event.segs
                .map((seg: any) => seg.utf8 === '\n' ? ' ' : (seg.utf8 || ''))
                .join('')
                .replace(/\s{2,}/g, ' ')
                .trim();
            if (eventText) {
                lines.push(eventText);
            }
        }

        return lines.join('\n').trim() || null;
    }

    private formatDate(dateStr: string): string {
        // upload_date is "YYYYMMDD"
        if (/^\d{8}$/.test(dateStr)) {
            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
        return dateStr;
    }

    private formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

const instance = container.resolve(OxylabsRealtimeService);

export default instance;
