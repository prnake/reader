import { injectable } from 'tsyringe';

@injectable()
export class AsyncContext {
    private storage: Map<string, any> = new Map();

    set(key: string, value: any): void {
        this.storage.set(key, value);
    }

    get<T = any>(key: string): T | undefined {
        return this.storage.get(key) as T | undefined;
    }

    has(key: string): boolean {
        return this.storage.has(key);
    }

    delete(key: string): boolean {
        return this.storage.delete(key);
    }

    clear(): void {
        this.storage.clear();
    }
}
