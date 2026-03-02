import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const cacheApiBenchmark: BenchmarkUnit = {
    id: 'cacheapi',
    name: 'CacheStorage',
    description: 'A system for storing and retrieving network requests and their responses. Part of the Service Worker specification, suitable for large data.',
    icon: '📦',
    category: 'high-native',
    url: 'https://w3c.github.io/ServiceWorker/#cache-objects',
    releaseYear: 2014,
    developer: 'W3C',
    runType: 'main.async',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const url = `/bench-data-${sizeName}`;
        let cache: Cache;

        return {
            setup: async () => {
                cache = await caches.open('bench-cache');
            },
            insert: () => cache.put(url, new Response(payloads.original)),
            read: () => cache.match(url).then(r => r?.text()),
            update: () => cache.put(url, new Response(payloads.modified)),
            delete: () => cache.delete(url),
            teardown: async () => {
                await caches.delete('bench-cache');
            }
        };
    }
};
