import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const cacheApiBenchmark: BenchmarkUnit = {
    id: 'cacheapi',
    name: 'Cache API',
    description: 'A system for storing and retrieving network requests and their responses. Part of the Service Worker specification, suitable for large data.',
    icon: '📦',
    category: 'high-native',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const url = `/bench-data-${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'modified';
        let cache: Cache;

        return {
            setup: async () => {
                cache = await caches.open('bench-cache');
            },
            insert: () => cache.put(url, new Response(str)),
            read: () => cache.match(url).then(r => r?.text()),
            update: () => cache.put(url, new Response(modStr)),
            delete: () => cache.delete(url)
        };
    }
};
