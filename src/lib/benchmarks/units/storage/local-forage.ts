import localforage from 'localforage';
import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const localForageBenchmark: BenchmarkUnit = {
    id: 'localforage',
    name: 'localForage',
    description: 'An asynchronous storage library that improves the web app offline experience by using a simple localStorage-like API.',
    icon: '📦',
    category: 'high-wrapper',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const key = `bench_k_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';
        let store: LocalForage;

        return {
            setup: async () => {
                store = localforage.createInstance({ name: `bench_lf_${sizeName}` });
            },
            insert: () => store.setItem(key, str),
            read: () => store.getItem(key),
            update: () => store.setItem(key, modStr),
            delete: () => store.removeItem(key),
            teardown: async () => {
                await store.clear();
            }
        };
    }
};
