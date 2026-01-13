import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';

@singleton()
export class LLMManager extends AsyncService {
    constructor() {
        super();
    }

    override async init() {
        this.emit('ready');
    }

    async chat(messages: any[], options?: any): Promise<any> {
        // Mock implementation
        throw new Error('LLM service not configured');
    }

    async complete(prompt: string, options?: any): Promise<string> {
        // Mock implementation
        throw new Error('LLM service not configured');
    }

    async *iterRun(prompt: string, options?: any): AsyncGenerator<string> {
        // Mock implementation - yields nothing
        throw new Error('LLM service not configured');
    }
}
