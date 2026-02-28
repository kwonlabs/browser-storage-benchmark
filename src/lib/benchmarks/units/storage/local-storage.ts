import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const localStorageBenchmark: BenchmarkUnit = {
    id: 'localstorage',
    name: 'LocalStorage',
    description: 'Standard persistent synchronous key-value storage. Simple but blocks the main thread and has limited capacity (typically 5MB).',
    icon: '💾',
    category: 'low',
    runType: 'main.sync',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const key = `bench_k_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';

        return {
            insert: () => localStorage.setItem(key, str),
            read: () => localStorage.getItem(key),
            update: () => localStorage.setItem(key, modStr),
            delete: () => localStorage.removeItem(key)
        };
    }
};
