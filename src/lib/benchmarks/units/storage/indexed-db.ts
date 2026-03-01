import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const indexedDBBenchmark: BenchmarkUnit = {
    id: 'indexeddb',
    name: 'IndexedDB',
    description: 'The standard for client-side structured data. Supports transactions, indexes, and large binary blobs.',
    icon: '🗂️',
    category: 'high-native',
    url: 'https://w3c.github.io/IndexedDB/',
    runType: 'worker.async',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const dbName = 'bench-idb';
        const storeName = 'data';
        const key = `bench_k_${sizeName}`;
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
                return runReq(tx.objectStore(storeName).put(payloads.original, key));
            },
            read: () => {
                const tx = db.transaction(storeName, 'readonly');
                return runReq(tx.objectStore(storeName).get(key));
            },
            update: () => {
                const tx = db.transaction(storeName, 'readwrite');
                return runReq(tx.objectStore(storeName).put(payloads.modified, key));
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
