import store from 'store2';
import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const storeJsBenchmark: BenchmarkUnit = {
    id: 'store.js',
    name: 'store.js',
    description: 'Cross-browser storage for all browsers (used to be store.js, now using store2 for better maintenance).',
    icon: '🏪',
    category: 'high-wrapper',
    runType: 'main.sync',
    run: (_sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const key = 'bench_k_s2';
        return {
            insert: () => {
                store.set(key, payloads.original);
            },
            read: () => {
                return store.get(key);
            },
            update: () => {
                store.set(key, payloads.modified);
            },
            delete: () => {
                store.remove(key);
            }
        };
    }
};
