// Core services
export { FirebaseStorageBucketControl } from './services/firebase-storage-bucket';
export { Logger } from './logger';
export { TempFileManager } from './services/temp-file';
export { AsyncContext } from './services/async-context';
export { SecretExposer } from './services/secrets';

// Errors
export { SecurityCompromiseError, ServiceCrashedError, ServiceNodeResourceDrainError, ServiceBadAttemptError } from './errors';

// Decorators
export { CloudHTTPv2 } from './decorators';
export { Ctx } from './types';
export { RPCReflect } from './rpc-reflect';
export { OutputServerEventStream } from './output-stream';

// Cloud function decorators
export function CloudTaskV2(options: any) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        return descriptor;
    };
}

export function CloudScheduleV2(schedule: string, options: any) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        return descriptor;
    };
}

export function Param(nameOrOptions?: string | { default?: any; required?: boolean }, options?: { default?: any; required?: boolean; type?: any; validate?: (v: any) => boolean }): ParameterDecorator {
    return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        // Parameter decorator implementation
    };
}

// Re-export InsufficientBalanceError for backward compatibility
export class InsufficientBalanceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InsufficientBalanceError';
    }
}

// Utilities
export const loadModulesDynamically = (path: string) => {
    console.log(`Loading modules from ${path}`);
};

export const registry = {
    exportAll: () => ({}),
    exportGrouped: () => ({}),
    allHandsOnDeck: async () => {},
};
