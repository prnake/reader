import { AsyncService } from 'civkit';
import { singleton } from 'tsyringe';
import * as fs from 'fs';
import * as path from 'path';

@singleton()
export class FirebaseStorageBucketControl extends AsyncService {
    private localStorageDir: string;
    bucket: any;

    constructor() {
        super();
        const basePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'local-storage');
        this.localStorageDir = basePath;
        if (!fs.existsSync(this.localStorageDir)) {
            fs.mkdirSync(this.localStorageDir, { recursive: true });
        }
        this.bucket = {
            file: (filePath: string) => ({
                exists: async () => {
                    const fullPath = path.join(this.localStorageDir, filePath);
                    return [fs.existsSync(fullPath)];
                },
                save: async (data: any, options?: any) => {
                    const fullPath = path.join(this.localStorageDir, filePath);
                    const dir = path.dirname(fullPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    if (data instanceof Buffer || typeof data === 'string') {
                        await fs.promises.writeFile(fullPath, data);
                    } else if (data && typeof data.pipe === 'function') {
                        const writeStream = fs.createWriteStream(fullPath);
                        data.pipe(writeStream);
                        await new Promise((resolve, reject) => {
                            writeStream.on('finish', resolve);
                            writeStream.on('error', reject);
                        });
                    }
                },
            }),
        };
    }

    override async init() {
        this.emit('ready');
    }

    async uploadFile(filePath: string, destination: string): Promise<string> {
        const destPath = path.join(this.localStorageDir, destination);
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.copyFile(filePath, destPath);
        return `file://${destPath}`;
    }

    async downloadFile(filePath: string): Promise<Buffer> {
        const sourcePath = path.join(this.localStorageDir, filePath);
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`File not found: ${sourcePath}`);
        }
        return fs.promises.readFile(sourcePath);
    }

    async deleteFile(filePath: string): Promise<void> {
        const fullPath = path.join(this.localStorageDir, filePath);
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
        }
    }

    async fileExists(filePath: string): Promise<boolean> {
        const fullPath = path.join(this.localStorageDir, filePath);
        return fs.existsSync(fullPath);
    }

    async saveFile(filePath: string, content: Buffer, options?: any): Promise<void> {
        const fullPath = path.join(this.localStorageDir, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.writeFile(fullPath, content);
    }

    async signDownloadUrl(filePath: string, expirationTime: number): Promise<string> {
        const fullPath = path.join(this.localStorageDir, filePath);
        return `file://${fullPath}`;
    }
}
