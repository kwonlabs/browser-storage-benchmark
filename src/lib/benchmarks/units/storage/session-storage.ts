import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const sessionStorageBenchmark: BenchmarkUnit = {
    id: 'sessionstorage',
    name: 'SessionStorage',
    description: 'Temporary key-value storage valid for the duration of the page session. Limited capacity (typically 5MB).',
    icon: '⏳',
    category: 'low',
    runType: 'main.sync',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const key = `bench_k_${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'm';

        return {
            insert: () => sessionStorage.setItem(key, str),
            read: () => sessionStorage.getItem(key),
            update: () => sessionStorage.setItem(key, modStr),
            delete: () => sessionStorage.removeItem(key)
        };
    }
};
