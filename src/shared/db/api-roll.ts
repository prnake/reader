export enum API_CALL_STATUS {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
    RATE_LIMITED = 'rate_limited',
}

export interface APIRoll {
    _id: string;
    uid?: string;
    ip?: string;
    endpoint: string;
    status: API_CALL_STATUS;
    chargeAmount: number;
    createdAt: Date;
    completedAt?: Date;
    error?: string;
}
