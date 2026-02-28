import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';
import store from 'store2';

export const storeJsBenchmark: BenchmarkUnit = {
    id: 'store.js',
    name: 'store.js',
    description: 'Cross-browser storage wrapper. Falls back to various mechanisms but typically relies on localStorage.',
    icon: '📦',
    category: 'high-wrapper',
    runType: 'main.sync',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const key = `bench_storejs_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';

        return {
            insert: () => store.set(key, str),
            read: () => store.get(key),
            update: () => store.set(key, modStr),
            delete: () => store.remove(key)
        };
    }
};
