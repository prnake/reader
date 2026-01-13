import { AutoCastable, Prop } from 'civkit';

// Try to import firebase-admin types, but make them optional
let firestoreModule: any = null;
try {
    firestoreModule = require('firebase-admin/firestore');
} catch (e) {
    // Firebase not available
}

function getDB(): any {
    if (!firestoreModule) {
        return null;
    }
    try {
        return firestoreModule.getFirestore();
    } catch (e) {
        return null;
    }
}

function getFieldValue(): any {
    if (!firestoreModule) {
        return {
            increment: (n: number) => ({ _increment: n }),
            arrayUnion: (...elements: any[]) => ({ _arrayUnion: elements }),
            arrayRemove: (...elements: any[]) => ({ _arrayRemove: elements }),
            delete: () => ({ _delete: true }),
            serverTimestamp: () => new Date(),
        };
    }
    return firestoreModule.FieldValue;
}

function getTimestamp(): any {
    if (!firestoreModule) {
        return {
            fromDate: (date: Date) => date,
        };
    }
    return firestoreModule.Timestamp;
}

export class FirestoreRecord extends AutoCastable {
    static collectionName: string = '';

    @Prop()
    _id!: string;

    static get COLLECTION(): any {
        const database = getDB();
        if (!database) {
            // Return mock collection for local development
            const mockCollection: any = {
                doc: (id: string) => ({
                    set: async (_data: any, _options?: any) => {},
                    update: async (_data: any) => {},
                    get: async () => ({ exists: false, data: () => null }),
                }),
                where: (..._args: any[]) => mockCollection._chainable(),
                _chainable: () => ({
                    where: (..._args: any[]) => mockCollection._chainable(),
                    orderBy: (..._args: any[]) => mockCollection._chainable(),
                    limit: (_n: number) => mockCollection._chainable(),
                    offset: (_n: number) => mockCollection._chainable(),
                    get: async () => ({ docs: [], empty: true }),
                    count: () => ({
                        get: async () => ({ data: () => ({ count: 0 }) }),
                    }),
                }),
            };
            return mockCollection;
        }
        return database.collection(this.collectionName);
    }

    static get DB(): any {
        return getDB();
    }

    static get OPS() {
        const fv = getFieldValue();
        return {
            increment: (n: number) => fv.increment(n),
            arrayUnion: (...elements: any[]) => fv.arrayUnion(...elements),
            arrayRemove: (...elements: any[]) => fv.arrayRemove(...elements),
            delete: () => fv.delete(),
            serverTimestamp: () => fv.serverTimestamp(),
        };
    }

    static async fromFirestore(id: string): Promise<any | undefined> {
        try {
            const doc = await this.COLLECTION.doc(id).get();
            if (!doc.exists) {
                return undefined;
            }
            return this.from({ ...doc.data(), _id: doc.id });
        } catch (e) {
            return undefined;
        }
    }

    static async fromFirestoreQuery(query: any): Promise<any[]> {
        try {
            const snapshot = await query.get();
            if (snapshot.empty) {
                return [];
            }
            return snapshot.docs.map((doc: any) => this.from({ ...doc.data(), _id: doc.id }));
        } catch (e) {
            return [];
        }
    }

    static async save(data: any, id?: string, options?: any): Promise<void> {
        const docId = id || data._id;
        if (docId) {
            await this.COLLECTION.doc(docId).set(data, options || {});
        }
    }

    degradeForFireStore(): any {
        const result: any = { ...this };
        const Timestamp = getTimestamp();
        // Convert Date objects to Firestore Timestamps
        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Date) {
                result[key] = Timestamp.fromDate(value);
            }
        }
        return result;
    }
}