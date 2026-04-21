/**
 * Detect bot / human-verification / access-wall pages.
 *
 * Many sites (especially Cloudflare-fronted ones) return an HTTP 200 body that
 * is really a challenge page — "Just a moment...", "Attention Required!",
 * Turnstile, captchas, Akamai "Pardon Our Interruption", etc. From a byte
 * perspective the request "succeeded", but the payload contains no article
 * content and should not be trusted as a real fetch.
 *
 * Patterns below are deliberately narrow — high-precision markers that rarely
 * occur in legitimate page bodies at the top of the document. Call sites:
 *   - `crawler.ts` snapshot-cache gate: skip caching short pages that look
 *     like a wall.
 *   - `crawler.ts` curl sideload path: force a proxy retry when the direct
 *     fetch landed on a wall, regardless of HTTP status.
 */

export type ChallengeKind =
    | 'cloudflare'
    | 'turnstile'
    | 'captcha'
    | 'akamai'
    | 'incapsula'
    | 'perimeterx'
    | 'datadome'
    | 'generic';

export interface ChallengeHit {
    kind: ChallengeKind;
    /** The literal pattern that matched, for logging. */
    matched: string;
    source: 'title' | 'body' | 'header';
}

export interface ChallengeInput {
    html?: string | null;
    title?: string | null;
    /** Response headers — single-value or multi-value; keys are compared case-insensitively. */
    headers?: Record<string, string | string[] | undefined> | null;
}

// Only scan the top of the body. Challenge pages are tiny; scanning an entire
// large legitimate article wastes time and raises false-positive risk (e.g. a
// blog post that casually mentions "captcha").
const BODY_SCAN_LIMIT = 4096;

interface Pattern {
    kind: ChallengeKind;
    needle: string;
}

const TITLE_PATTERNS: Pattern[] = [
    { kind: 'cloudflare', needle: 'just a moment' },
    { kind: 'cloudflare', needle: 'attention required' },
    { kind: 'cloudflare', needle: 'please wait... | cloudflare' },
    { kind: 'akamai', needle: 'access denied' },
    { kind: 'akamai', needle: 'pardon our interruption' },
    { kind: 'generic', needle: 'security check' },
    { kind: 'generic', needle: 'please verify' },
    { kind: 'generic', needle: 'one moment, please' },
    { kind: 'generic', needle: 'bot verification' },
    { kind: 'generic', needle: '人机验证' },
    { kind: 'generic', needle: '安全验证' },
];

const BODY_PATTERNS: Pattern[] = [
    // Cloudflare — the ?ray id, __cf_bm cookie bootstrap and challenge-platform
    // script are all served inline on waiting-room pages.
    { kind: 'cloudflare', needle: 'cloudflare ray id' },
    { kind: 'cloudflare', needle: 'cf-ray:' },
    { kind: 'cloudflare', needle: 'challenge-platform' },
    { kind: 'cloudflare', needle: '__cf_bm' },
    { kind: 'cloudflare', needle: 'checking your browser before accessing' },
    { kind: 'cloudflare', needle: 'checking if the site connection is secure' },
    { kind: 'cloudflare', needle: 'enable javascript and cookies to continue' },
    { kind: 'cloudflare', needle: 'please enable javascript to continue' },
    { kind: 'cloudflare', needle: 'performance & security by cloudflare' },
    { kind: 'cloudflare', needle: 'ddos protection by cloudflare' },
    { kind: 'turnstile', needle: 'cf-turnstile' },
    // Akamai / Incapsula / PerimeterX / DataDome
    { kind: 'akamai', needle: 'access to this page has been denied' },
    { kind: 'akamai', needle: 'please stand by, while we are checking' },
    { kind: 'incapsula', needle: 'request unsuccessful. incapsula incident' },
    { kind: 'incapsula', needle: 'pardon our interruption' },
    { kind: 'perimeterx', needle: 'px-captcha' },
    { kind: 'datadome', needle: 'datadome' },
    // Captchas
    { kind: 'captcha', needle: 'recaptcha challenge' },
    { kind: 'captcha', needle: 'g-recaptcha' },
    { kind: 'captcha', needle: 'h-captcha' },
    { kind: 'captcha', needle: 'hcaptcha' },
    { kind: 'captcha', needle: 'please complete the security check' },
    { kind: 'captcha', needle: 'please complete the captcha' },
    { kind: 'captcha', needle: "i'm not a robot" },
    { kind: 'captcha', needle: 'captcha' },
    // Verification prompts
    { kind: 'generic', needle: 'verify you are human' },
    { kind: 'generic', needle: 'verifying you are human' },
    { kind: 'generic', needle: 'press & hold to confirm you are' },
    { kind: 'generic', needle: 'press and hold to confirm you are' },
    // Chinese
    { kind: 'generic', needle: '请完成安全验证' },
    { kind: 'generic', needle: '请完成验证' },
    { kind: 'generic', needle: '人机验证' },
    { kind: 'generic', needle: '滑动完成验证' },
    { kind: 'generic', needle: '滑块验证' },
    // Rate limiting (surfaced as an access wall)
    { kind: 'generic', needle: 'rate limit exceeded' },
    { kind: 'generic', needle: 'too many requests' },
];

function getHeader(
    headers: ChallengeInput['headers'],
    name: string,
): string | undefined {
    if (!headers) return undefined;
    const target = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() !== target) continue;
        if (Array.isArray(v)) return v[0];
        return v;
    }
    return undefined;
}

export function detectChallengePage(input: ChallengeInput): ChallengeHit | null {
    // 1. Response headers. Cloudflare stamps `cf-mitigated: challenge` on
    //    challenge responses and this is the single strongest signal — use
    //    it alone, no false positives in practice.
    const cfMitigated = getHeader(input.headers, 'cf-mitigated');
    if (cfMitigated && cfMitigated.toLowerCase().includes('challenge')) {
        return { kind: 'cloudflare', matched: `cf-mitigated:${cfMitigated}`, source: 'header' };
    }

    // 2. Title — the most reliable signal after cf-mitigated, because
    //    challenge pages use a tiny set of standard titles.
    const title = (input.title || '').toLowerCase();
    if (title) {
        for (const p of TITLE_PATTERNS) {
            if (title.includes(p.needle)) {
                return { kind: p.kind, matched: p.needle, source: 'title' };
            }
        }
    }

    // 3. Body — scan only the head of the document.
    const html = input.html || '';
    if (html) {
        const head = html.slice(0, BODY_SCAN_LIMIT).toLowerCase();
        for (const p of BODY_PATTERNS) {
            if (head.includes(p.needle)) {
                return { kind: p.kind, matched: p.needle, source: 'body' };
            }
        }
    }

    return null;
}
