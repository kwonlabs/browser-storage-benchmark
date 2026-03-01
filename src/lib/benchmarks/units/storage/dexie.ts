import Dexie, { type Table } from 'dexie';
import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const dexieBenchmark: BenchmarkUnit = {
    id: 'dexie',
    name: 'Dexie.js',
    description: 'A minimalist wrapper for IndexedDB that provides a neat database API with better performance and easier usage.',
    icon: '🚀',
    category: 'high-wrapper',
    url: 'https://dexie.org/',
    runType: 'main.async',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        let db: Dexie;
        let table: Table<{ id: string; val: string }, string>;

        return {
            setup: async () => {
                const name = `bench_dexie_${sizeName}_${Math.random().toString(36).slice(2, 7)}`;
                if (db) {
                    await db.close();
                    await Dexie.delete(db.name);
                }
                db = new Dexie(name);
                db.version(1).stores({
                    bench: 'id'
                });
                table = db.table('bench');
                await db.open();
                await table.clear();
            },
            insert: async () => {
                await table.put({ id: 'k', val: payloads.original });
            },
            read: async () => {
                const res = await table.get('k');
                if (!res) return null;
                return res.val;
            },
            update: async () => {
                await table.update('k', { val: payloads.modified });
            },
            delete: async () => {
                await table.delete('k');
            },
            teardown: async () => {
                if (db) {
                    await db.close();
                    await Dexie.delete(db.name); // Full cleanup
                    db = null as any;
                }
            }
        };
    }
};
