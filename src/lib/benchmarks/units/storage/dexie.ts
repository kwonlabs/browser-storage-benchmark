import Dexie, { type Table } from 'dexie';
import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const dexieBenchmark: BenchmarkUnit = {
    id: 'dexie',
    name: 'Dexie.js',
    description: 'A minimalist wrapper for IndexedDB that provides a neat database-like API with promises and observable queries.',
    icon: '🚀',
    category: 'high-wrapper',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const dbName = `bench_dexie_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';
        let db: Dexie;
        let table: Table;

        return {
            setup: async () => {
                db = new Dexie(dbName);
                db.version(1).stores({ data: 'id' });
                table = db.table('data');
            },
            insert: () => table.put({ id: 'k', val: str }),
            read: () => table.get('k'),
            update: () => table.put({ id: 'k', val: modStr }),
            delete: () => table.delete('k'),
            teardown: async () => {
                await db.delete();
            }
        };
    }
};
