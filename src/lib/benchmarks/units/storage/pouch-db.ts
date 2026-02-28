// @ts-ignore
import PouchDB from 'pouchdb-browser';
import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const pouchDbBenchmark: BenchmarkUnit = {
    id: 'pouchdb',
    name: 'PouchDB',
    description: 'A CouchDB-compatible database that runs in the browser. Supports sync with remote CouchDB and complex queries.',
    icon: '🎛️',
    category: 'high-wrapper',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const dbName = `bench_pouch_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';
        let db: any;

        return {
            setup: async () => {
                db = new (PouchDB as any)(dbName);
            },
            insert: () => db.put({ _id: 'k', val: str }),
            read: () => db.get('k'),
            update: async () => {
                const doc = await db.get('k');
                return db.put({ ...doc, val: modStr });
            },
            delete: async () => {
                const doc = await db.get('k');
                return db.remove(doc);
            },
            teardown: async () => {
                await db.destroy();
            }
        };
    }
};
