import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const cookieBenchmark: BenchmarkUnit = {
    id: 'cookie',
    name: 'Cookie',
    description: 'Traditional browser cookies. Very limited size (4KB) and can impact network performance as they are sent with every request.',
    icon: '🍪',
    category: 'low',
    url: 'https://httpwg.org/specs/rfc6265.html',
    runType: 'main.sync',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const key = `bench_k_c_${sizeName}_${Math.random().toString(36).slice(2, 7)}`;
        const COOKIE_LIMIT = 4000; // Safe limit slightly below 4096

        return {
            insert: () => {
                if (payloads.original.length > COOKIE_LIMIT) {
                    console.warn(`[Cookie] Size limit exceeded (${payloads.original.length} bytes). Cookies are limited to ~4KB.`);
                    return -1;
                }
                document.cookie = `${key}=${encodeURIComponent(payloads.original)}; path=/; samesite=Lax;`;
            },
            read: () => {
                if (payloads.original.length > COOKIE_LIMIT) return null;
                const parts = document.cookie.split(`${key}=`);
                if (parts.length >= 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
                return null;
            },
            update: () => {
                if (payloads.modified.length > COOKIE_LIMIT) return -1;
                document.cookie = `${key}=${encodeURIComponent(payloads.modified)}; path=/; samesite=Lax;`;
            },
            delete: () => {
                document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
            }
        };
    }
};
