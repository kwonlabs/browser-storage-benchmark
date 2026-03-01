import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const sessionStorageBenchmark: BenchmarkUnit = {
    id: 'sessionstorage',
    name: 'SessionStorage',
    description: 'Temporary key-value storage valid for the duration of the page session. Limited capacity (typically 5MB).',
    icon: '⏳',
    category: 'low',
    url: 'https://html.spec.whatwg.org/multipage/webstorage.html#the-sessionstorage-attribute',
    runType: 'main.sync',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const key = `bench_k_ss_${sizeName}`;
        return {
            insert: () => sessionStorage.setItem(key, payloads.original),
            read: () => sessionStorage.getItem(key),
            update: () => sessionStorage.setItem(key, payloads.modified),
            delete: () => sessionStorage.removeItem(key)
        };
    }
};
