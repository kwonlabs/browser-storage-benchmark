import { bzip2Benchmark } from './units/compression/bzip2';
import { lzmaBenchmark } from './units/compression/lzma';
import { snappyBenchmark } from './units/compression/snappy';
import { lz4Benchmark } from './units/compression/lz4';
import { brotliBenchmark } from './units/compression/brotli';
import { zstdBenchmark } from './units/compression/zstd';
import { zipBenchmark } from './units/compression/zip';
import { gzipBenchmark } from './units/compression/gzip';
import { deflateBenchmark } from './units/compression/deflate';
import { deflateRawBenchmark } from './units/compression/deflate-raw';

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
import { pouchDBBenchmark } from './units/storage/pouch-db';

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
    pouchDBBenchmark,
    storeJsBenchmark,
    // Compression Benchmarks
    deflateBenchmark,    // RFC 1950 (1996)
    deflateRawBenchmark, // RFC 1951 (1996)
    gzipBenchmark,       // RFC 1952 (1996)
    zipBenchmark,        // 1989
    bzip2Benchmark,      // 1996
    lzmaBenchmark,       // 1998
    snappyBenchmark,     // 2011
    lz4Benchmark,        // 2011
    brotliBenchmark,     // 2013
    zstdBenchmark        // 2016
];

export function getBenchmarkById(id: string) {
    return allBenchmarks.find(b => b.id === id);
}

export function getBenchmarksByCategory(category: string) {
    return allBenchmarks.filter(b => b.category === category);
}
