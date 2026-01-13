import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';
import pino from 'pino';

const pinoLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
});

@singleton()
export class Logger extends AsyncService {
    private logger = pinoLogger;

    constructor() {
        super();
    }

    override async init() {
        this.emit('ready');
    }

    child(bindings: Record<string, any>) {
        return this.logger.child(bindings);
    }

    info(msg: string, ...args: any[]) {
        this.logger.info(msg, ...args);
    }

    warn(msg: string, ...args: any[]) {
        this.logger.warn(msg, ...args);
    }

    error(msg: string, ...args: any[]) {
        this.logger.error(msg, ...args);
    }

    debug(msg: string, ...args: any[]) {
        this.logger.debug(msg, ...args);
    }
}

export default new Logger();
