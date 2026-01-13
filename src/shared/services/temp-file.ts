import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

@singleton()
export class TempFileManager extends AsyncService {
    private tempDir: string;
    private boundPaths: WeakMap<object, string> = new WeakMap();

    constructor() {
        super();
        this.tempDir = process.env.TEMP_DIR || path.join(os.tmpdir(), 'reader-temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    override async init() {
        this.emit('ready');
    }

    alloc(ext?: string): string {
        const filename = `${randomUUID()}${ext ? `.${ext}` : ''}`;
        return path.join(this.tempDir, filename);
    }

    bindPathTo(obj: object, filePath: string): void {
        this.boundPaths.set(obj, filePath);
    }

    async cleanup(filePath: string): Promise<void> {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }
}
