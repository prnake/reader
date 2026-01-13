import { Prop } from 'civkit';
import { FirestoreRecord } from '../lib/firestore';
import { RateLimitDesc } from '../services/rate-limit';

export class JinaEmbeddingsTokenAccount extends FirestoreRecord {
    static override collectionName = 'jina-embeddings-token-accounts';

    @Prop()
    user_id!: string;

    @Prop()
    full_name!: string;

    @Prop()
    email?: string;

    @Prop()
    wallet!: {
        total_balance: number;
    };

    @Prop()
    metadata?: {
        speed_level?: string;
        [key: string]: any;
    };

    @Prop()
    customRateLimits?: Record<string, RateLimitDesc[]>;

    @Prop()
    lastSyncedAt?: Date;

    override degradeForFireStore(): any {
        const result = super.degradeForFireStore();
        // Ensure nested objects are properly serialized
        return result;
    }
}
