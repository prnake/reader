import { ApplicationError, StatusCode } from 'civkit/civ-rpc';

@StatusCode(45102)
export class SecurityCompromiseError extends ApplicationError {
    constructor(message: string | { message: string; path?: string }) {
        super(typeof message === 'string' ? message : message.message);
        this.name = 'SecurityCompromiseError';
    }
}

@StatusCode(50302)
export class ServiceCrashedError extends ApplicationError {
    constructor(message: string | { message: string }) {
        super(typeof message === 'string' ? message : message.message);
        this.name = 'ServiceCrashedError';
    }
}

@StatusCode(50303)
export class ServiceNodeResourceDrainError extends ApplicationError {
    constructor(message: string) {
        super(message);
        this.name = 'ServiceNodeResourceDrainError';
    }
}

@StatusCode(50304)
export class ServiceBadAttemptError extends ApplicationError {
    constructor(message: string) {
        super(message);
        this.name = 'ServiceBadAttemptError';
    }
}
