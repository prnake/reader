import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';

@singleton()
export class ImageInterrogationManager extends AsyncService {
    constructor() {
        super();
    }

    override async init() {
        this.emit('ready');
    }

    async interrogate(imageUrl: string, options?: any): Promise<string> {
        // Mock implementation - returns empty alt text
        return '';
    }

    async generateAltText(imageBuffer: Buffer, options?: any): Promise<string> {
        // Mock implementation
        return '';
    }
}
