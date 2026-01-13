import type { Middleware } from 'koa';

export function getAuditionMiddleware(): Middleware {
    return async (ctx, next) => {
        // Mock audition middleware - just passes through
        await next();
    };
}
