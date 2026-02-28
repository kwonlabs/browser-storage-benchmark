import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const sqliteAsyncBenchmark: BenchmarkUnit = {
    id: 'sqlite-async',
    name: 'SQLite (Async)',
    description: 'The legendary relational database running via WebAssembly with OPFS (Async) support.',
    icon: '💎',
    category: 'high-wrapper',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const k = `bench_k_sqlite_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';
        let db: any;

        return {
            setup: async () => {
                // @ts-ignore
                const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
                const sqlite3 = await sqlite3InitModule();
                if (!('opfs' in sqlite3)) throw new Error('OPFS not supported');
                db = new sqlite3.oo1.OpfsDb('/bench_async.sqlite3', 'c');
                db.exec("CREATE TABLE IF NOT EXISTS data (id TEXT PRIMARY KEY, val TEXT)");
            },
            insert: () => db.exec({ sql: "INSERT OR REPLACE INTO data (id, val) VALUES (?, ?)", bind: [k, str] }),
            read: () => db.exec({ sql: "SELECT val FROM data WHERE id = ?", bind: [k], returnValue: "resultRows" }),
            update: () => db.exec({ sql: "UPDATE data SET val = ? WHERE id = ?", bind: [modStr, k] }),
            delete: () => db.exec({ sql: "DELETE FROM data WHERE id = ?", bind: [k] }),
            teardown: async () => {
                if (db) db.close();
            }
        };
    }
};
