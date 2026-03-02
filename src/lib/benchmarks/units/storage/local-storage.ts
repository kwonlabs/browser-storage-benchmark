import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const localStorageBenchmark: BenchmarkUnit = {
    id: 'localstorage',
    name: 'LocalStorage',
    description: 'Standard persistent synchronous key-value storage. Simple but blocks the main thread and has limited capacity (typically 5MB).',
    icon: '💾',
    category: 'low',
    url: 'https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute',
    releaseYear: 2009,
    developer: 'W3C',
    runType: 'main.sync',
    maxSize: 4 * 1024 * 1024,
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const key = `bench_k_ls_${sizeName}`;
        return {
            insert: () => localStorage.setItem(key, payloads.original),
            read: () => localStorage.getItem(key),
            update: () => localStorage.setItem(key, payloads.modified),
            delete: () => localStorage.removeItem(key)
        };
    }
};
