import { AsyncService } from 'civkit/async-service';
import { singleton } from 'tsyringe';

import { Curl, CurlCode, CurlFeature, HeaderInfo } from 'node-libcurl';
import { parseString as parseSetCookieString } from 'set-cookie-parser';

import { ScrappingOptions } from './puppeteer';
import { GlobalLogger } from './logger';
import { AssertionFailureError, FancyFile } from 'civkit';
import { ServiceBadAttemptError, ServiceBadApproachError } from './errors';
import { TempFileManager } from '../services/temp-file';
import { createBrotliDecompress, createInflate, createGunzip } from 'zlib';
import { ZSTDDecompress } from 'simple-zstd';
import _ from 'lodash';
import { Readable } from 'stream';
import { AsyncLocalContext } from './async-context';
import { BlackHoleDetector } from './blackhole-detector';

export interface CURLScrappingOptions<T = any> extends ScrappingOptions<T> {
    method?: string;
    body?: string | Buffer;
}

@singleton()
export class CurlControl extends AsyncService {

    logger = this.globalLogger.child({ service: this.constructor.name });

    chromeVersion: string = `132`;
    safariVersion: string = `537.36`;
    platform: string = `Linux`;
    ua: string = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${this.safariVersion} (KHTML, like Gecko) Chrome/${this.chromeVersion}.0.0.0 Safari/${this.safariVersion}`;

    lifeCycleTrack = new WeakMap();

    // 并发重试次数，从环境变量读取，默认3次
    private get concurrentRetries(): number {
        const envValue = process.env.CURL_IMPERSONATE_CONCURRENT_RETRIES;
        if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return 3; // 默认3次
    }

    constructor(
        protected globalLogger: GlobalLogger,
        protected tempFileManager: TempFileManager,
        protected asyncLocalContext: AsyncLocalContext,
        protected blackHoleDetector: BlackHoleDetector,
    ) {
        super(...arguments);
    }

    override async init() {
        await this.dependencyReady();

        if (process.platform === 'darwin') {
            this.platform = `macOS`;
        } else if (process.platform === 'win32') {
            this.platform = `Windows`;
        }

        this.emit('ready');
    }

    impersonateChrome(ua: string) {
        this.chromeVersion = ua.match(/Chrome\/(\d+)/)![1];
        this.safariVersion = ua.match(/AppleWebKit\/([\d\.]+)/)![1];
        this.ua = ua;
    }

    curlImpersonateHeader(curl: Curl, headers?: object) {
        let uaPlatform = this.platform;
        if (this.ua.includes('Windows')) {
            uaPlatform = 'Windows';
        } else if (this.ua.includes('Android')) {
            uaPlatform = 'Android';
        } else if (this.ua.includes('iPhone') || this.ua.includes('iPad') || this.ua.includes('iPod')) {
            uaPlatform = 'iOS';
        } else if (this.ua.includes('CrOS')) {
            uaPlatform = 'Chrome OS';
        } else if (this.ua.includes('Macintosh')) {
            uaPlatform = 'macOS';
        }

        const mixinHeaders: Record<string, string> = {
            'Sec-Ch-Ua': `"Google Chrome";v="${this.chromeVersion}", "Not-A.Brand";v="8", "Chromium";v="${this.chromeVersion}"`,
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': `"${uaPlatform}"`,
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': this.ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.9',
        };
        const headersCopy: Record<string, string | undefined> = { ...headers };
        for (const k of Object.keys(mixinHeaders)) {
            const lowerK = k.toLowerCase();
            if (headersCopy[lowerK]) {
                mixinHeaders[k] = headersCopy[lowerK];
                delete headersCopy[lowerK];
            }
        }
        Object.assign(mixinHeaders, headersCopy);

        curl.setOpt(Curl.option.HTTPHEADER, Object.entries(mixinHeaders).flatMap(([k, v]) => {
            if (Array.isArray(v) && v.length) {
                return v.map((v2) => `${k}: ${v2}`);
            }
            return [`${k}: ${v}`];
        }));

        return curl;
    }

    /**
     * 执行单次 curl 请求（内部方法）
     */
    private _urlToStreamSingle(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions): Promise<{
        statusCode: number,
        statusText?: string,
        data?: Readable,
        headers: HeaderInfo[],
    }> {
        return new Promise<{
            statusCode: number,
            statusText?: string,
            data?: Readable,
            headers: HeaderInfo[],
        }>((resolve, reject) => {
            let contentType = '';
            const curl = new Curl();
            curl.enable(CurlFeature.StreamResponse);
            curl.setOpt('URL', urlToCrawl.toString());
            curl.setOpt(Curl.option.FOLLOWLOCATION, false);
            curl.setOpt(Curl.option.SSL_VERIFYPEER, false);
            curl.setOpt(Curl.option.TIMEOUT_MS, crawlOpts?.timeoutMs || 30_000);
            curl.setOpt(Curl.option.CONNECTTIMEOUT_MS, 3_000);
            curl.setOpt(Curl.option.LOW_SPEED_LIMIT, 32768);
            curl.setOpt(Curl.option.LOW_SPEED_TIME, 5_000);
            if (crawlOpts?.method) {
                curl.setOpt(Curl.option.CUSTOMREQUEST, crawlOpts.method.toUpperCase());
            }
            if (crawlOpts?.body) {
                curl.setOpt(Curl.option.POSTFIELDS, crawlOpts.body.toString());
            }

            const headersToSet = { ...crawlOpts?.extraHeaders };
            if (crawlOpts?.cookies?.length) {
                const cookieKv: Record<string, string> = {};
                for (const cookie of crawlOpts.cookies) {
                    cookieKv[cookie.name] = cookie.value;
                }
                for (const cookie of crawlOpts.cookies) {
                    if (cookie.maxAge && cookie.maxAge < 0) {
                        delete cookieKv[cookie.name];
                        continue;
                    }
                    if (cookie.expires && cookie.expires < new Date()) {
                        delete cookieKv[cookie.name];
                        continue;
                    }
                    if (cookie.secure && urlToCrawl.protocol !== 'https:') {
                        delete cookieKv[cookie.name];
                        continue;
                    }
                    if (cookie.domain && !urlToCrawl.hostname.endsWith(cookie.domain)) {
                        delete cookieKv[cookie.name];
                        continue;
                    }
                    if (cookie.path && !urlToCrawl.pathname.startsWith(cookie.path)) {
                        delete cookieKv[cookie.name];
                        continue;
                    }
                }
                const cookieChunks = Object.entries(cookieKv).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
                headersToSet.cookie ??= cookieChunks.join('; ');
            }
            if (crawlOpts?.referer) {
                headersToSet.referer ??= crawlOpts.referer;
            }
            if (crawlOpts?.overrideUserAgent) {
                headersToSet['user-agent'] ??= crawlOpts.overrideUserAgent;
            }

            this.curlImpersonateHeader(curl, headersToSet);

            if (crawlOpts?.proxyUrl) {
                const proxyUrlCopy = new URL(crawlOpts.proxyUrl);
                curl.setOpt(Curl.option.PROXY, proxyUrlCopy.href);
            }

            let curlStream: Readable | undefined;
            curl.on('error', (err, errCode) => {
                curl.close();
                this.logger.warn(`Curl ${urlToCrawl.origin}: ${err}`, { err, urlToCrawl });
                const err2 = this.digestCurlCode(errCode, err.message) ||
                    new AssertionFailureError(`Failed to access ${urlToCrawl.origin}: ${err.message}`);
                err2.cause ??= err;
                if (curlStream) {
                    // For some reason, manually emitting error event is required for curlStream.
                    curlStream.emit('error', err2);
                    curlStream.destroy(err2);
                }
                reject(err2);
            });
            curl.setOpt(Curl.option.MAXFILESIZE, 4 * 1024 * 1024 * 1024); // 4GB
            let status = -1;
            let statusText: string | undefined;
            let contentEncoding = '';
            curl.once('end', () => {
                if (curlStream) {
                    curlStream.once('end', () => curl.close());
                    return;
                }
                curl.close();
            });
            curl.on('stream', (stream, statusCode, headers) => {
                this.logger.debug(`CURL: [${statusCode}] ${urlToCrawl.origin}`, { statusCode });
                status = statusCode;
                curlStream = stream;
                for (const headerSet of (headers as HeaderInfo[])) {
                    for (const [k, v] of Object.entries(headerSet)) {
                        if (k.trim().endsWith(':')) {
                            Reflect.set(headerSet, k.slice(0, k.indexOf(':')), v || '');
                            Reflect.deleteProperty(headerSet, k);
                            continue;
                        }
                        if (v === undefined) {
                            Reflect.set(headerSet, k, '');
                            continue;
                        }
                        if (k.toLowerCase() === 'content-type' && typeof v === 'string') {
                            contentType = v.toLowerCase();
                        }
                    }
                }
                const lastResHeaders = headers[headers.length - 1];
                statusText = (lastResHeaders as HeaderInfo).result?.reason;
                for (const [k, v] of Object.entries(lastResHeaders)) {
                    const kl = k.toLowerCase();
                    if (kl === 'content-type') {
                        contentType = (v || '').toLowerCase();
                    }
                    if (kl === 'content-encoding') {
                        contentEncoding = (v || '').toLowerCase();
                    }
                    if (contentType && contentEncoding) {
                        break;
                    }
                }

                if ([301, 302, 303, 307, 308].includes(statusCode)) {
                    if (stream) {
                        stream.resume();
                    }
                    resolve({
                        statusCode: status,
                        statusText,
                        data: undefined,
                        headers: headers as HeaderInfo[],
                    });
                    return;
                }

                if (!stream) {
                    resolve({
                        statusCode: status,
                        statusText,
                        data: undefined,
                        headers: headers as HeaderInfo[],
                    });
                    return;
                }

                switch (contentEncoding) {
                    case 'gzip': {
                        const decompressed = createGunzip();
                        stream.pipe(decompressed);
                        stream.once('error', (err) => {
                            decompressed.destroy(err);
                        });
                        stream = decompressed;
                        break;
                    }
                    case 'deflate': {
                        const decompressed = createInflate();
                        stream.pipe(decompressed);
                        stream.once('error', (err) => {
                            decompressed.destroy(err);
                        });
                        stream = decompressed;
                        break;
                    }
                    case 'br': {
                        const decompressed = createBrotliDecompress();
                        stream.pipe(decompressed);
                        stream.once('error', (err) => {
                            decompressed.destroy(err);
                        });
                        stream = decompressed;
                        break;
                    }
                    case 'zstd': {
                        const decompressed = ZSTDDecompress();
                        stream.pipe(decompressed);
                        stream.once('error', (err) => {
                            decompressed.destroy(err);
                        });
                        stream = decompressed;
                        break;
                    }
                    default: {
                        break;
                    }
                }

                resolve({
                    statusCode: status,
                    statusText,
                    data: stream,
                    headers: headers as HeaderInfo[],
                });
            });

            curl.perform();
        });
    }

    /**
     * 计算状态码的优先级分数，用于选择最佳结果
     * 200 > 2xx > 3xx > 4xx > 5xx > 其他
     */
    private getStatusCodeScore(statusCode: number): number {
        if (statusCode === 200) return 1000;
        if (statusCode >= 200 && statusCode < 300) return 900 + statusCode;
        if (statusCode >= 300 && statusCode < 400) return 800 + statusCode;
        if (statusCode >= 400 && statusCode < 500) return 700 + statusCode;
        if (statusCode >= 500 && statusCode < 600) return 600 + statusCode;
        return statusCode;
    }

    /**
     * 读取流的所有数据并返回 Buffer
     */
    private async readStreamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks as any);
    }

    /**
     * 并发执行多次 curl 请求，等待所有请求完成，选择最大的结果
     * 选择策略：
     * 1. 优先选择状态码最好的（200 > 2xx > 其他）
     * 2. 如果状态码相同，选择 HTML 内容最长的
     * 并发次数由环境变量 CURL_IMPERSONATE_CONCURRENT_RETRIES 控制，默认3次
     */
    async urlToStream(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions): Promise<{
        statusCode: number,
        statusText?: string,
        data?: Readable,
        headers: HeaderInfo[],
    }> {
        const retries = this.concurrentRetries;
        
        // 如果并发次数为1，直接执行单次请求
        if (retries === 1) {
            return this._urlToStreamSingle(urlToCrawl, crawlOpts);
        }

        // 创建多个并发请求
        const promises = Array.from({ length: retries }, () => 
            this._urlToStreamSingle(urlToCrawl, crawlOpts)
        );

        // 使用 Promise.allSettled 等待所有请求完成
        const results = await Promise.allSettled(promises);
        
        // 收集所有成功的结果
        const successfulResults: Array<{
            value: {
                statusCode: number,
                statusText?: string,
                data?: Readable,
                headers: HeaderInfo[],
            },
            index: number,
            score: number
        }> = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled') {
                const score = this.getStatusCodeScore(result.value.statusCode);
                successfulResults.push({
                    value: result.value,
                    index: i,
                    score
                });
            }
        }

        // 如果至少有一个成功的结果
        if (successfulResults.length > 0) {
            // 按分数降序排序
            successfulResults.sort((a, b) => b.score - a.score);
            
            // 找出最高分数的所有结果（状态码相同的结果）
            const highestScore = successfulResults[0].score;
            const sameScoreResults = successfulResults.filter(r => r.score === highestScore);
            
            type ResultWithData = typeof successfulResults[0] & {
                dataLength?: number;
                dataBuffer?: Buffer;
            };
            
            let bestResult: ResultWithData;
            
            // 如果只有一个最高分的结果，直接返回
            if (sameScoreResults.length === 1) {
                bestResult = sameScoreResults[0];
            } else {
                // 如果有多个相同状态码的结果，读取数据并比较长度
                this.logger.debug(`CURL multiple results with same status code, comparing data length`, {
                    statusCode: sameScoreResults[0].value.statusCode,
                    count: sameScoreResults.length
                });
                
                // 读取所有相同状态码结果的数据
                const resultsWithData: ResultWithData[] = await Promise.all(
                    sameScoreResults.map(async (result) => {
                        let dataLength = 0;
                        let dataBuffer: Buffer | undefined;
                        
                        if (result.value.data) {
                            try {
                                dataBuffer = await this.readStreamToBuffer(result.value.data);
                                dataLength = dataBuffer.length;
                            } catch (err) {
                                this.logger.warn(`Failed to read stream data for comparison`, { err, index: result.index });
                            }
                        }
                        
                        return {
                            ...result,
                            dataLength,
                            dataBuffer
                        };
                    })
                );
                
                // 按数据长度降序排序，选择最长的
                resultsWithData.sort((a, b) => (b.dataLength || 0) - (a.dataLength || 0));
                bestResult = resultsWithData[0];
                
                this.logger.debug(`CURL selected result with longest data`, {
                    selectedIndex: bestResult.index,
                    dataLength: bestResult.dataLength,
                    allLengths: resultsWithData.map(r => ({ index: r.index, length: r.dataLength }))
                });
                
                // 如果读取了数据，需要从 Buffer 重新创建 Readable stream
                if (bestResult.dataBuffer) {
                    const dataBuffer = bestResult.dataBuffer; // 保存到局部变量
                    const newStream = new Readable({
                        read() {
                            this.push(dataBuffer);
                            this.push(null); // 结束流
                        }
                    });
                    bestResult.value.data = newStream;
                }
            }
            
            this.logger.debug(`CURL concurrent retry completed for ${urlToCrawl.origin}`, {
                totalRetries: retries,
                successfulCount: successfulResults.length,
                selectedIndex: bestResult.index,
                selectedStatusCode: bestResult.value.statusCode,
                allStatusCodes: successfulResults.map(r => ({ index: r.index, statusCode: r.value.statusCode }))
            });
            
            return bestResult.value;
        }

        // 如果所有请求都失败了，返回最后一个错误
        const lastRejection = results[results.length - 1];
        if (lastRejection.status === 'rejected') {
            this.logger.warn(`CURL all ${retries} concurrent retries failed for ${urlToCrawl.origin}`, {
                errors: results.map((r, i) => ({
                    index: i,
                    error: r.status === 'rejected' ? r.reason : null
                }))
            });
            throw lastRejection.reason;
        }

        // 理论上不应该到达这里
        throw new AssertionFailureError(`Unexpected state in concurrent curl retries for ${urlToCrawl.origin}`);
    }

    async urlToFile(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions) {
        let leftRedirection = 6;
        let cookieRedirects = 0;
        let opts = { ...crawlOpts };
        let nextHopUrl = urlToCrawl;
        const fakeHeaderInfos: HeaderInfo[] = [];
        do {
            const s = await this.urlToStream(nextHopUrl, opts);
            const r = { ...s } as {
                statusCode: number,
                statusText?: string,
                data?: FancyFile,
                headers: HeaderInfo[],
            };
            if (r.data) {
                const fpath = this.tempFileManager.alloc();
                const fancyFile = FancyFile.auto(r.data, fpath);
                this.tempFileManager.bindPathTo(fancyFile, fpath);
                r.data = fancyFile;
            }

            if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
                fakeHeaderInfos.push(...r.headers);
                const headers = r.headers[r.headers.length - 1];
                const location: string | undefined = headers.Location || headers.location;

                const setCookieHeader = headers['Set-Cookie'] || headers['set-cookie'];
                if (setCookieHeader) {
                    const cookieAssignments = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
                    const parsed = cookieAssignments.filter(Boolean).map((x) => parseSetCookieString(x, { decodeValues: true }));
                    if (parsed.length) {
                        opts.cookies = [...(opts.cookies || []), ...parsed];
                    }
                    if (!location) {
                        cookieRedirects += 1;
                    }
                }

                if (!location && !setCookieHeader) {
                    // Follow curl behavior
                    return {
                        statusCode: r.statusCode,
                        data: r.data,
                        headers: fakeHeaderInfos.concat(r.headers),
                    };
                }
                if (!location && cookieRedirects > 1) {
                    throw new ServiceBadApproachError(`Failed to access ${urlToCrawl}: Browser required to solve complex cookie preconditions.`);
                }

                nextHopUrl = new URL(location || '', nextHopUrl);
                leftRedirection -= 1;
                continue;
            }

            return {
                statusCode: r.statusCode,
                statusText: r.statusText,
                data: r.data,
                headers: fakeHeaderInfos.concat(r.headers),
            };
        } while (leftRedirection > 0);

        throw new ServiceBadAttemptError(`Failed to access ${urlToCrawl}: Too many redirections.`);
    }

    async sideLoad(targetUrl: URL, crawlOpts?: CURLScrappingOptions) {
        const curlResult = await this.urlToFile(targetUrl, crawlOpts);
        this.blackHoleDetector.itWorked();
        let finalURL = targetUrl;
        const sideLoadOpts: CURLScrappingOptions<FancyFile>['sideLoad'] = {
            impersonate: {},
            proxyOrigin: {},
        };
        for (const headers of curlResult.headers) {
            sideLoadOpts.impersonate[finalURL.href] = {
                status: headers.result?.code || -1,
                headers: _.omit(headers, 'result'),
                contentType: headers['Content-Type'] || headers['content-type'],
            };
            if (crawlOpts?.proxyUrl) {
                sideLoadOpts.proxyOrigin[finalURL.origin] = crawlOpts.proxyUrl;
            }
            if (headers.result?.code && [301, 302, 307, 308].includes(headers.result.code)) {
                const location = headers.Location || headers.location;
                if (location) {
                    finalURL = new URL(location, finalURL);
                }
            }
        }
        const lastHeaders = curlResult.headers[curlResult.headers.length - 1];
        const contentType = (lastHeaders['Content-Type'] || lastHeaders['content-type'])?.toLowerCase() || (await curlResult.data?.mimeType) || 'application/octet-stream';
        const contentDisposition = lastHeaders['Content-Disposition'] || lastHeaders['content-disposition'];
        const fileName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1] || finalURL.pathname.split('/').pop();

        if (sideLoadOpts.impersonate[finalURL.href] && (await curlResult.data?.size)) {
            sideLoadOpts.impersonate[finalURL.href].body = curlResult.data;
        }

        // This should keep the file from being garbage collected and deleted until this asyncContext/request is done.
        this.lifeCycleTrack.set(this.asyncLocalContext.ctx, curlResult.data);

        return {
            finalURL,
            sideLoadOpts,
            chain: curlResult.headers,
            status: curlResult.statusCode,
            statusText: curlResult.statusText,
            headers: lastHeaders,
            contentType,
            contentDisposition,
            fileName,
            file: curlResult.data
        };
    }

    async urlToBlob(urlToCrawl: URL, crawlOpts?: CURLScrappingOptions) {
        let leftRedirection = 6;
        let cookieRedirects = 0;
        let opts = { ...crawlOpts };
        let nextHopUrl = urlToCrawl;
        const fakeHeaderInfos: HeaderInfo[] = [];
        do {
            const s = await this.urlToStream(nextHopUrl, opts);
            const r = { ...s } as {
                statusCode: number,
                statusText?: string,
                data?: Blob,
                headers: HeaderInfo[],
            };


            const headers = r.headers[r.headers.length - 1];
            if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
                fakeHeaderInfos.push(...r.headers);
                const location: string | undefined = headers.Location || headers.location;

                const setCookieHeader = headers['Set-Cookie'] || headers['set-cookie'];
                if (setCookieHeader) {
                    const cookieAssignments = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
                    const parsed = cookieAssignments.filter(Boolean).map((x) => parseSetCookieString(x, { decodeValues: true }));
                    if (parsed.length) {
                        opts.cookies = [...(opts.cookies || []), ...parsed];
                    }
                    if (!location) {
                        cookieRedirects += 1;
                    }
                }

                if (!location && !setCookieHeader) {
                    // Follow curl behavior
                    if (s.data) {
                        const chunks: Buffer[] = [];
                        s.data.on('data', (chunk) => {
                            chunks.push(chunk);
                        });
                        await new Promise((resolve, reject) => {
                            s.data!.once('end', resolve);
                            s.data!.once('error', reject);
                        });
                        r.data = new Blob(chunks, { type: headers['Content-Type'] || headers['content-type'] });
                    }
                    return {
                        statusCode: r.statusCode,
                        data: r.data,
                        headers: fakeHeaderInfos.concat(r.headers),
                    };
                }
                if (!location && cookieRedirects > 1) {
                    throw new ServiceBadApproachError(`Failed to access ${urlToCrawl}: Browser required to solve complex cookie preconditions.`);
                }

                nextHopUrl = new URL(location || '', nextHopUrl);
                leftRedirection -= 1;
                continue;
            }

            if (s.data) {
                const chunks: Buffer[] = [];
                s.data.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                await new Promise((resolve, reject) => {
                    s.data!.once('end', resolve);
                    s.data!.once('error', reject);
                });
                r.data = new Blob(chunks, { type: headers['Content-Type'] || headers['content-type'] });
            }

            return {
                statusCode: r.statusCode,
                statusText: r.statusText,
                data: r.data,
                headers: fakeHeaderInfos.concat(r.headers),
            };
        } while (leftRedirection > 0);

        throw new ServiceBadAttemptError(`Failed to access ${urlToCrawl}: Too many redirections.`);
    }

    async sideLoadBlob(targetUrl: URL, crawlOpts?: CURLScrappingOptions) {
        const curlResult = await this.urlToBlob(targetUrl, crawlOpts);
        this.blackHoleDetector.itWorked();
        let finalURL = targetUrl;
        const sideLoadOpts: CURLScrappingOptions<Blob>['sideLoad'] = {
            impersonate: {},
            proxyOrigin: {},
        };
        for (const headers of curlResult.headers) {
            sideLoadOpts.impersonate[finalURL.href] = {
                status: headers.result?.code || -1,
                headers: _.omit(headers, 'result'),
                contentType: headers['Content-Type'] || headers['content-type'],
            };
            if (crawlOpts?.proxyUrl) {
                sideLoadOpts.proxyOrigin[finalURL.origin] = crawlOpts.proxyUrl;
            }
            if (headers.result?.code && [301, 302, 307, 308].includes(headers.result.code)) {
                const location = headers.Location || headers.location;
                if (location) {
                    finalURL = new URL(location, finalURL);
                }
            }
        }
        const lastHeaders = curlResult.headers[curlResult.headers.length - 1];
        const contentType = (lastHeaders['Content-Type'] || lastHeaders['content-type'])?.toLowerCase() || (curlResult.data?.type) || 'application/octet-stream';
        const contentDisposition = lastHeaders['Content-Disposition'] || lastHeaders['content-disposition'];
        const fileName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1] || finalURL.pathname.split('/').pop();

        if (sideLoadOpts.impersonate[finalURL.href] && (curlResult.data?.size)) {
            sideLoadOpts.impersonate[finalURL.href].body = curlResult.data;
        }

        // This should keep the file from being garbage collected and deleted until this asyncContext/request is done.
        this.lifeCycleTrack.set(this.asyncLocalContext.ctx, curlResult.data);

        return {
            finalURL,
            sideLoadOpts,
            chain: curlResult.headers,
            status: curlResult.statusCode,
            statusText: curlResult.statusText,
            headers: lastHeaders,
            contentType,
            contentDisposition,
            fileName,
            file: curlResult.data
        };
    }

    digestCurlCode(code: CurlCode, msg: string) {
        switch (code) {
            // 400 User errors
            case CurlCode.CURLE_COULDNT_RESOLVE_HOST: {
                return new AssertionFailureError(msg);
            }

            // Maybe retry but dont retry with curl again
            case CurlCode.CURLE_OPERATION_TIMEDOUT:
            case CurlCode.CURLE_UNSUPPORTED_PROTOCOL:
            case CurlCode.CURLE_PEER_FAILED_VERIFICATION: {
                return new ServiceBadApproachError(msg);
            }

            // Retryable errors
            case CurlCode.CURLE_REMOTE_ACCESS_DENIED:
            case CurlCode.CURLE_SEND_ERROR:
            case CurlCode.CURLE_RECV_ERROR:
            case CurlCode.CURLE_GOT_NOTHING:
            case CurlCode.CURLE_SSL_CONNECT_ERROR:
            case CurlCode.CURLE_QUIC_CONNECT_ERROR:
            case CurlCode.CURLE_COULDNT_RESOLVE_PROXY:
            case CurlCode.CURLE_COULDNT_CONNECT:
            case CurlCode.CURLE_PARTIAL_FILE: {
                return new ServiceBadAttemptError(msg);
            }

            default: {
                return undefined;
            }
        }
    }
}
