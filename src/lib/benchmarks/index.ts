import { zipBenchmark } from './units/compression/zip';
import { gzipBenchmark } from './units/compression/gzip';
import { zstdBenchmark } from './units/compression/zstd';
import { deflateBenchmark } from './units/compression/deflate';
import { brotliBenchmark } from './units/compression/brotli';

import { cookieBenchmark } from './units/storage/cookie';
import { sessionStorageBenchmark } from './units/storage/session-storage';
import { localStorageBenchmark } from './units/storage/local-storage';

import { cacheApiBenchmark } from './units/storage/cache-api';
import { indexedDBBenchmark } from './units/storage/indexed-db';
import { opfsAsyncBenchmark } from './units/storage/opfs-async';
import { opfsSyncBenchmark } from './units/storage/opfs-sync';

import { sqliteAsyncBenchmark } from './units/storage/sqlite-async';
import { sqliteSyncBenchmark } from './units/storage/sqlite-sync';
import { dexieBenchmark } from './units/storage/dexie';
import { storeJsBenchmark } from './units/storage/store-js';
import { localForageBenchmark } from './units/storage/local-forage';
import { pouchDbBenchmark } from './units/storage/pouch-db';

import type { BenchmarkUnit } from './types';

export const allBenchmarks: BenchmarkUnit[] = [
    cookieBenchmark,
    sessionStorageBenchmark,
    localStorageBenchmark,
    cacheApiBenchmark,
    indexedDBBenchmark,
    opfsAsyncBenchmark,
    opfsSyncBenchmark,
    sqliteAsyncBenchmark,
    sqliteSyncBenchmark,
    localForageBenchmark,
    dexieBenchmark,
    pouchDbBenchmark,
    storeJsBenchmark,
    zipBenchmark,
    gzipBenchmark,
    deflateBenchmark,
    brotliBenchmark,
    zstdBenchmark
];

export function getBenchmarkById(id: string) {
    return allBenchmarks.find(b => b.id === id);
}

export function getBenchmarksByCategory(category: string) {
    return allBenchmarks.filter(b => b.category === category);
}
