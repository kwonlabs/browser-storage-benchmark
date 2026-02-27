// Library / Wrapper Worker
import localforage from 'localforage';
import Dexie from 'dexie';
// @ts-ignore
import PouchDB from 'pouchdb-browser';
import { generatePayloadString, measureOperation } from '../lib/benchmark';

self.onmessage = async (e) => {
    const { type, sizeName, sizeValue } = e.data;

    if (type === 'start_wrapper') {
        const results: Record<string, any> = {};
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';
        const k = `bench_k_${sizeName}`;

        // localForage
        try {
            localforage.config({ name: 'bench-lf' });
            results['localForage'] = {
                insert: await measureOperation(sizeValue, async () => { const s = performance.now(); await localforage.setItem(k, str); return performance.now() - s; }),
                read: await measureOperation(sizeValue, async () => { const s = performance.now(); await localforage.getItem(k); return performance.now() - s; }),
                update: await measureOperation(sizeValue, async () => { const s = performance.now(); await localforage.setItem(k, modStr); return performance.now() - s; }),
                delete: await measureOperation(sizeValue, async () => { const s = performance.now(); await localforage.removeItem(k); return performance.now() - s; })
            };
        } catch (err) { results['localForage'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

        // Dexie
        try {
            const db = new Dexie('bench-dexie');
            db.version(1).stores({ data: 'id' });
            results['Dexie'] = {
                insert: await measureOperation(sizeValue, async () => { const s = performance.now(); await db.table('data').put({ id: k, val: str }); return performance.now() - s; }),
                read: await measureOperation(sizeValue, async () => { const s = performance.now(); await db.table('data').get(k); return performance.now() - s; }),
                update: await measureOperation(sizeValue, async () => { const s = performance.now(); await db.table('data').put({ id: k, val: modStr }); return performance.now() - s; }),
                delete: await measureOperation(sizeValue, async () => { const s = performance.now(); await db.table('data').delete(k); return performance.now() - s; })
            };
            db.close();
        } catch (err) { results['Dexie'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

        // PouchDB
        try {
            const pdb = new PouchDB('bench-pouch');
            results['PouchDB'] = {
                insert: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    try { const existing = await pdb.get(k); await pdb.put({ _id: k, _rev: existing._rev, val: str }); }
                    catch (err) { await pdb.put({ _id: k, val: str }); }
                    return performance.now() - s;
                }),
                read: await measureOperation(sizeValue, async () => { const s = performance.now(); await pdb.get(k); return performance.now() - s; }),
                update: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    const doc: any = await pdb.get(k);
                    await pdb.put({ ...doc, val: modStr });
                    return performance.now() - s;
                }),
                delete: await measureOperation(sizeValue, async () => {
                    const s = performance.now();
                    const doc2: any = await pdb.get(k);
                    await pdb.remove(doc2);
                    return performance.now() - s;
                })
            };
        } catch (err) { results['PouchDB'] = { insert: -1, read: -1, update: -1, delete: -1 }; }

        // SQLite (WASM + OPFS)
        try {
            // @ts-ignore
            const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
            const sqlite3 = await sqlite3InitModule();

            if ('opfs' in sqlite3) {
                const db = new sqlite3.oo1.OpfsDb('/bench.sqlite3', 'c');
                try {
                    db.exec("CREATE TABLE IF NOT EXISTS data (id TEXT PRIMARY KEY, val TEXT)");

                    results['SQLite'] = {
                        insert: await measureOperation(sizeValue, () => {
                            const s = performance.now();
                            db.exec({ sql: "INSERT OR REPLACE INTO data (id, val) VALUES (?, ?)", bind: [k, str] });
                            return performance.now() - s;
                        }),
                        read: await measureOperation(sizeValue, () => {
                            const s = performance.now();
                            db.exec({ sql: "SELECT val FROM data WHERE id = ?", bind: [k], returnValue: "resultRows" });
                            return performance.now() - s;
                        }),
                        update: await measureOperation(sizeValue, () => {
                            const s = performance.now();
                            db.exec({ sql: "UPDATE data SET val = ? WHERE id = ?", bind: [modStr, k] });
                            return performance.now() - s;
                        }),
                        delete: await measureOperation(sizeValue, () => {
                            const s = performance.now();
                            db.exec({ sql: "DELETE FROM data WHERE id = ?", bind: [k] });
                            return performance.now() - s;
                        })
                    };
                } finally {
                    db.close();
                }
            } else {
                results['SQLite'] = { insert: -1, read: -1, update: -1, delete: -1 };
            }
        } catch (err) {
            results['SQLite'] = { insert: -1, read: -1, update: -1, delete: -1 };
        }

        self.postMessage({ type: 'done_wrapper', sizeName, payload: results });
    }
};
