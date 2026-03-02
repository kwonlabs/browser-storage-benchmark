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
import { msgpackBenchmark } from './units/compression/msgpack';

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
import { storeJsBenchmark } from './units/storage/store2';
import { localForageBenchmark } from './units/storage/local-forage';
import { pouchDBBenchmark } from './units/storage/pouch-db';

import type { BenchmarkUnit } from './types';

export const allBenchmarks: BenchmarkUnit[] = [
    // Volatile / Low-level
    cookieBenchmark,         // 1994
    sessionStorageBenchmark, // 2009
    localStorageBenchmark,   // 2009

    // Native Persistent
    indexedDBBenchmark,      // 2011
    cacheApiBenchmark,       // 2014
    opfsAsyncBenchmark,      // 2021
    opfsSyncBenchmark,       // 2021
    sqliteAsyncBenchmark,    // 2023
    sqliteSyncBenchmark,     // 2023

    // Storage Libraries (Wrappers)
    pouchDBBenchmark,        // 2012
    storeJsBenchmark,        // 2013
    localForageBenchmark,    // 2014
    dexieBenchmark,          // 2014

    // Compression Benchmarks
    zipBenchmark,        // 1989
    deflateBenchmark,    // RFC 1950 (1996)
    deflateRawBenchmark, // RFC 1951 (1996)
    gzipBenchmark,       // RFC 1952 (1996)
    bzip2Benchmark,      // 1996
    lzmaBenchmark,       // 1998
    snappyBenchmark,     // 2011
    lz4Benchmark,        // 2011
    brotliBenchmark,     // 2013
    zstdBenchmark,       // 2016
    msgpackBenchmark     // 2008 (Structured)
];

export function getBenchmarkById(id: string) {
    return allBenchmarks.find(b => b.id === id);
}

export function getBenchmarksByCategory(category: string) {
    return allBenchmarks.filter(b => b.category === category);
}
