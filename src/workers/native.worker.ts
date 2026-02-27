// Native Storage Worker

self.onmessage = async (e) => {
    const { type, sizeName, payloadStr } = e.data;

    if (type === 'start_native') {
        const results: Record<string, any> = {};

        // Cache API
        try {
            const cache = await caches.open('bench-cache');
            const url = '/bench-data';

            const insertStart = performance.now();
            await cache.put(url, new Response(payloadStr));
            const insertTime = performance.now() - insertStart;

            const readStart = performance.now();
            const resp = await cache.match(url);
            if (resp) await resp.text();
            const readTime = performance.now() - readStart;

            const updateStart = performance.now();
            await cache.put(url, new Response(payloadStr + 'modified'));
            const updateTime = performance.now() - updateStart;

            const deleteStart = performance.now();
            await cache.delete(url);
            const deleteTime = performance.now() - deleteStart;

            results['Cache API'] = { insert: insertTime, read: readTime, update: updateTime, delete: deleteTime };
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

            const i = await runIdb('readwrite', s => s.put(payloadStr, 'k'));
            const r = await runIdb('readonly', s => s.get('k'));
            const u = await runIdb('readwrite', s => s.put(payloadStr + 'mod', 'k'));
            const d = await runIdb('readwrite', s => s.delete('k'));
            results['IndexedDB'] = { insert: i, read: r, update: u, delete: d };
            db.close();
        } catch (err) {
            results['IndexedDB'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }

        // OPFS
        try {
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle('bench-file', { create: true });

            const insertStart = performance.now();
            const writable = await fileHandle.createWritable();
            await writable.write(payloadStr);
            await writable.close();
            const insertTime = performance.now() - insertStart;

            const readStart = performance.now();
            const file = await fileHandle.getFile();
            await file.text();
            const readTime = performance.now() - readStart;

            const updateStart = performance.now();
            const writableUpd = await fileHandle.createWritable();
            await writableUpd.write(payloadStr + 'mod');
            await writableUpd.close();
            const updateTime = performance.now() - updateStart;

            const deleteStart = performance.now();
            await root.removeEntry('bench-file').catch(() => { });
            const deleteTime = performance.now() - deleteStart;

            results['OPFS'] = { insert: insertTime, read: readTime, update: updateTime, delete: deleteTime };
        } catch (err) {
            results['OPFS'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }

        self.postMessage({ type: 'done_native', sizeName, payload: results });
    }
};
