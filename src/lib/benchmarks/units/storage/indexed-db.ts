import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const indexedDBBenchmark: BenchmarkUnit = {
    id: 'indexeddb',
    name: 'IndexedDB',
    description: 'The standard for client-side structured data. Supports transactions, indexes, and large binary blobs.',
    icon: '🗂️',
    category: 'high-native',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const dbName = 'bench-idb';
        const storeName = 'data';
        const key = `bench_k_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';
        let db: IDBDatabase;

        const runReq = (req: IDBRequest) => new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        return {
            setup: async () => {
                db = await new Promise((resolve, reject) => {
                    const req = indexedDB.open(dbName, 1);
                    req.onupgradeneeded = () => req.result.createObjectStore(storeName);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            },
            insert: () => {
                const tx = db.transaction(storeName, 'readwrite');
                return runReq(tx.objectStore(storeName).put(str, key));
            },
            read: () => {
                const tx = db.transaction(storeName, 'readonly');
                return runReq(tx.objectStore(storeName).get(key));
            },
            update: () => {
                const tx = db.transaction(storeName, 'readwrite');
                return runReq(tx.objectStore(storeName).put(modStr, key));
            },
            delete: () => {
                const tx = db.transaction(storeName, 'readwrite');
                return runReq(tx.objectStore(storeName).delete(key));
            },
            teardown: async () => {
                db.close();
            }
        };
    }
};
