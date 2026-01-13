import { injectable } from 'tsyringe';

@injectable()
export class Logger {
    constructor(private name: string = 'app') {}

    info(message: string | object, ...args: any[]) {
        if (typeof message === 'object') {
            console.log(`[${this.name}] INFO:`, message, ...args);
        } else {
            console.log(`[${this.name}] INFO:`, message, ...args);
        }
    }

    warn(message: string | object, ...args: any[]) {
        if (typeof message === 'object') {
            console.warn(`[${this.name}] WARN:`, message, ...args);
        } else {
            console.warn(`[${this.name}] WARN:`, message, ...args);
        }
    }

    error(message: string | object, ...args: any[]) {
        if (typeof message === 'object') {
            console.error(`[${this.name}] ERROR:`, message, ...args);
        } else {
            console.error(`[${this.name}] ERROR:`, message, ...args);
        }
    }

    debug(message: string | object, ...args: any[]) {
        if (process.env.DEBUG || process.env.LOG_LEVEL === 'debug') {
            if (typeof message === 'object') {
                console.log(`[${this.name}] DEBUG:`, message, ...args);
            } else {
                console.log(`[${this.name}] DEBUG:`, message, ...args);
            }
        }
    }

    child(options: { service: string }) {
        return new Logger(`${this.name}:${options.service}`);
    }
}