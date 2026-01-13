import { AsyncService, AutoCastable, Prop } from 'civkit';
import { singleton } from 'tsyringe';
import { ApplicationError, StatusCode } from 'civkit/civ-rpc';

@StatusCode(42901)
export class RateLimitTriggeredError extends ApplicationError { }

export class RateLimitDesc extends AutoCastable {
    @Prop()
    occurrence!: number;

    @Prop()
    periodSeconds!: number;

    isEffective(): boolean {
        return this.occurrence > 0 && this.periodSeconds > 0;
    }

    static override from(input: any): RateLimitDesc {
        const instance = super.from(input) as RateLimitDesc;
        return instance;
    }
}

interface RecordOptions {
    uid?: string;
    tags?: string[];
    status?: string;
    chargeAmount?: number;
}

class RecordBuilder {
    constructor(_options: RecordOptions) {}

    async save(): Promise<void> {
        // Mock implementation - does nothing
    }
}

@singleton()
export class RateLimitControl extends AsyncService {
    constructor() {
        super();
    }

    override async init() {
        this.emit('ready');
    }

    async simpleRPCUidBasedLimit(
        rpcReflect: any,
        uid: string,
        tags: string[],
        ...rateLimits: RateLimitDesc[]
    ) {
        // Mock implementation - allows all requests
        return {
            chargeAmount: 0,
        };
    }

    async simpleRpcIPBasedLimit(
        rpcReflect: any,
        ip: string,
        tags: string[],
        ...rateLimits: [Date, number][]
    ) {
        // Mock implementation - allows all requests
        return {
            chargeAmount: 0,
        };
    }

    record(options: RecordOptions): RecordBuilder {
        return new RecordBuilder(options);
    }

    async increment(desc: RateLimitDesc): Promise<boolean> {
        return true;
    }

    async decrement(desc: RateLimitDesc): Promise<void> {
        // Mock implementation
    }
}
