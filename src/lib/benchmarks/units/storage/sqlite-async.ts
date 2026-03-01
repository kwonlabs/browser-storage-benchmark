import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const sqliteAsyncBenchmark: BenchmarkUnit = {
    id: 'sqlite-async',
    name: 'SQLite (Async)',
    description: 'The legendary relational database running via WebAssembly with OPFS (Async) support.',
    icon: '💎',
    category: 'high-wrapper',
    url: 'https://sqlite.org/wasm',
    runType: 'worker.async',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const dbPath = `/bench_async_${sizeName}_${Math.random().toString(36).slice(2, 7)}.sqlite3`;
        let db: any;

        return {
            setup: async () => {
                if (!db) {
                    // @ts-ignore
                    const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
                    const sqlite3 = await sqlite3InitModule();
                    if (!('opfs' in sqlite3)) throw new Error('OPFS not supported');
                    db = new sqlite3.oo1.OpfsDb(dbPath, 'c');
                    db.exec("CREATE TABLE IF NOT EXISTS data (id TEXT PRIMARY KEY, val TEXT)");
                }
                db.exec("DELETE FROM data");
            },
            insert: () => db.exec({ sql: "INSERT OR REPLACE INTO data (id, val) VALUES (?, ?)", bind: ['k', payloads.original] }),
            read: () => {
                const rows = db.exec({ sql: "SELECT val FROM data WHERE id = ?", bind: ['k'], returnValue: "resultRows" });
                return rows?.[0]?.[0] || rows?.[0]?.val;
            },
            update: () => db.exec({ sql: "UPDATE data SET val = ? WHERE id = ?", bind: [payloads.modified, 'k'] }),
            delete: () => db.exec({ sql: "DELETE FROM data WHERE id = ?", bind: ['k'] }),
            teardown: async () => {
                if (db) {
                    db.close();
                    try {
                        const root = await navigator.storage.getDirectory();
                        await root.removeEntry(dbPath.replace(/^\//, ''), { recursive: true });
                    } catch (e) { /* ignore cleanup error */ }
                }
            }
        };
    }
};
