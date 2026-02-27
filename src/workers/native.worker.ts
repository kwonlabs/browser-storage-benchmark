// Native Storage Worker
import { generatePayloadString, measureOperation } from '../lib/benchmark';

self.onmessage = async (e) => {
    const { type, sizeName, sizeValue } = e.data;

    if (type === 'start_native') {
        const results: Record<string, any> = {};
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'modified';
        const key = `bench_k_${sizeName}`;

        // Cache API
        try {
            const cache = await caches.open('bench-cache');
            const url = `/bench-data-${sizeName}`;

            results['Cache API'] = {
                insert: await measureOperation(sizeValue, async () => { const s = performance.now(); await cache.put(url, new Response(str)); return performance.now() - s; }),
                read: await measureOperation(sizeValue, async () => { const s = performance.now(); const resp = await cache.match(url); if (resp) await resp.text(); return performance.now() - s; }),
                update: await measureOperation(sizeValue, async () => { const s = performance.now(); await cache.put(url, new Response(modStr)); return performance.now() - s; }),
                delete: await measureOperation(sizeValue, async () => { const s = performance.now(); await cache.delete(url); return performance.now() - s; })
            };
        } catch (err: any) {
            results['Cache API'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }

        // IndexedDB (Direct)
        try {
            const dbName = 'bench-idb';
            const storeName = 'data';

            const db: IDBDatabase = await new Promise((resolve, reject) => {
                const req = indexedDB.open(dbName, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(storeName);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            const runIdb = (mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest) => {
                return new Promise<number>((resolve) => {
                    const s = performance.now();
                    const tx = db.transaction(storeName, mode);
                    const req = op(tx.objectStore(storeName));
                    req.onsuccess = () => resolve(performance.now() - s);
                    req.onerror = () => resolve(-1);
                });
            };

            results['IndexedDB'] = {
                insert: await measureOperation(sizeValue, () => runIdb('readwrite', s => s.put(str, key))),
                read: await measureOperation(sizeValue, () => runIdb('readonly', s => s.get(key))),
                update: await measureOperation(sizeValue, () => runIdb('readwrite', s => s.put(modStr, key))),
                delete: await measureOperation(sizeValue, () => runIdb('readwrite', s => s.delete(key)))
            };
            db.close();
        } catch (err) {
            results['IndexedDB'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }

        // OPFS
        try {
            const root = await navigator.storage.getDirectory();
            const fileName = `bench-file-${sizeName}`;
            const fileHandle = await root.getFileHandle(fileName, { create: true });

            results['OPFS'] = {
                insert: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    const writable = await fileHandle.createWritable();
                    await writable.write(str);
                    await writable.close();
                    return performance.now() - s;
                }),
                read: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    const file = await fileHandle.getFile();
                    await file.text();
                    return performance.now() - s;
                }),
                update: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    const writableUpd = await fileHandle.createWritable();
                    await writableUpd.write(modStr);
                    await writableUpd.close();
                    return performance.now() - s;
                }),
                delete: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    await root.removeEntry(fileName).catch(() => { });
                    return performance.now() - s;
                })
            };
        } catch (err) {
            results['OPFS'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }

        self.postMessage({ type: 'done_native', sizeName, payload: results });
    }
};
