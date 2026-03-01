export interface BenchmarkMetadata {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'low' | 'high-native' | 'high-wrapper' | 'compression';
    url?: string;
    releaseYear?: number;
    developer?: string;
}

export const benchmarkMetadata: BenchmarkMetadata[] = [
    {
        id: 'cookie',
        name: 'Cookie',
        description: 'Traditional browser cookies. Very limited size (4KB) and can impact network performance as they are sent with every request.',
        icon: '🍪',
        category: 'low',
        url: 'https://httpwg.org/specs/rfc6265.html'
    },
    {
        id: 'sessionstorage',
        name: 'SessionStorage',
        description: 'Temporary key-value storage valid for the duration of the page session. Limited capacity (typically 5MB).',
        icon: '⏳',
        category: 'low',
        url: 'https://html.spec.whatwg.org/multipage/webstorage.html#the-sessionstorage-attribute'
    },
    {
        id: 'localstorage',
        name: 'LocalStorage',
        description: 'Standard persistent synchronous key-value storage. Simple but blocks the main thread and has limited capacity (typically 5MB).',
        icon: '💾',
        category: 'low',
        url: 'https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute'
    },
    {
        id: 'cacheapi',
        name: 'Cache API',
        description: 'A system for storing and retrieving network requests and their responses. Part of the Service Worker specification, suitable for large data.',
        icon: '📦',
        category: 'high-native',
        url: 'https://w3c.github.io/ServiceWorker/#cache-objects'
    },
    {
        id: 'indexeddb',
        name: 'IndexedDB',
        description: 'Low-level API for client-side storage of significant amounts of structured data. Provides high performance but complex API.',
        icon: '🗂️',
        category: 'high-native',
        url: 'https://w3c.github.io/IndexedDB/'
    },
    {
        id: 'opfs-async',
        name: 'OPFS (Async)',
        description: 'Origin Private File System (Async API). Provides higher performance for storage operations compared to traditional storage APIs.',
        icon: '📂',
        category: 'high-native',
        url: 'https://fs.spec.whatwg.org/#origin-private-file-system'
    },
    {
        id: 'opfs-sync',
        name: 'OPFS (Sync)',
        description: 'Origin Private File System (Sync API). Designed for use within Web Workers for maximum performance on file operations.',
        icon: '⚡',
        category: 'high-native',
        url: 'https://fs.spec.whatwg.org/#origin-private-file-system'
    },
    {
        id: 'sqlite-async',
        name: 'SQLite (Async)',
        description: 'The legendary relational database running via WebAssembly with OPFS (Async) support.',
        icon: '💎',
        category: 'high-wrapper',
        url: 'https://sqlite.org/wasm'
    },
    {
        id: 'sqlite-sync',
        name: 'SQLite (Sync)',
        description: 'SQLite running via WebAssembly with OPFS (Sync Access Handle) support for maximum performance.',
        icon: '🚀',
        category: 'high-wrapper',
        url: 'https://sqlite.org/wasm'
    },
    {
        id: 'localforage',
        name: 'localForage',
        description: 'An asynchronous storage library that improves the web app offline experience by using a simple localStorage-like API.',
        icon: '📦',
        category: 'high-wrapper',
        url: 'https://localforage.github.io/localForage/'
    },
    {
        id: 'dexie',
        name: 'Dexie.js',
        description: 'A minimalist wrapper for IndexedDB that provides a neat database-like API with promises and observable queries.',
        icon: '🚀',
        category: 'high-wrapper',
        url: 'https://dexie.org/'
    },
    {
        id: 'pouchdb',
        name: 'PouchDB',
        description: 'A CouchDB-compatible database that runs in the browser. Supports sync with remote CouchDB and complex queries.',
        icon: '🎛️',
        category: 'high-wrapper',
        url: 'https://pouchdb.com/'
    },
    {
        id: 'store.js',
        name: 'store.js',
        description: 'Cross-browser storage wrapper. Falls back to various mechanisms but typically relies on localStorage.',
        icon: '📦',
        category: 'high-wrapper',
        url: 'https://github.com/nbubna/store'
    },
    {
        id: 'deflate',
        name: 'ZLIB (Deflate)',
        description: 'Standard DEFLATE streaming compression with zlib headers. Built natively into modern browsers and tested via the CompressionStream API.',
        icon: '💨',
        category: 'compression',
        url: 'https://wicg.github.io/compression/',
        releaseYear: 1996,
        developer: 'Jean-loup Gailly, Mark Adler'
    },
    {
        id: 'deflate-raw',
        name: 'DEFLATE (Raw)',
        description: 'Raw DEFLATE streaming compression without headers/footers. Built natively into modern browsers and tested via the CompressionStream API.',
        icon: '💨',
        category: 'compression',
        url: 'https://wicg.github.io/compression/',
        releaseYear: 1996,
        developer: 'Phil Katz'
    },
    {
        id: 'gzip',
        name: 'GZIP',
        description: 'Standard GZIP compression format. Built natively into modern browsers and tested via the CompressionStream API.',
        icon: '🗜️',
        category: 'compression',
        url: 'https://wicg.github.io/compression/',
        releaseYear: 1996,
        developer: 'Jean-loup Gailly, Mark Adler'
    },
    {
        id: 'zip',
        name: 'ZIP',
        description: 'Classic container format using Deflate for multi-file packaging. Tested in the browser using the pure-JS fflate library.',
        icon: '📦',
        category: 'compression',
        url: 'https://github.com/101arrowz/fflate',
        releaseYear: 1989,
        developer: 'Phil Katz / PKWARE'
    },
    {
        id: 'bzip2',
        name: 'Bzip2',
        description: 'High-quality data compressor excellent for text-heavy data. Tested in the browser via WebAssembly (bzip2-wasm).',
        icon: '🗜️',
        category: 'compression',
        url: 'https://sourceware.org/bzip2/',
        releaseYear: 1996,
        developer: 'Julian Seward'
    },
    {
        id: 'lzma',
        name: 'LZMA',
        description: 'Maximum compression ratio algorithm. Slow but extremely space-efficient. Tested via a JavaScript implementation (lzma).',
        icon: '📦',
        category: 'compression',
        url: 'https://tukaani.org/xz/',
        releaseYear: 1998,
        developer: 'Igor Pavlov'
    },
    {
        id: 'snappy',
        name: 'Snappy',
        description: 'High-speed compression balanced for speed and reasonable ratio. Tested in the browser via WebAssembly (snappy-wasm).',
        icon: '⚡',
        category: 'compression',
        url: 'https://google.github.io/snappy/',
        releaseYear: 2011,
        developer: 'Google'
    },
    {
        id: 'lz4',
        name: 'LZ4',
        description: 'Extremely fast compression with near-zero CPU overhead. Tested in the browser via WebAssembly (lz4-wasm).',
        icon: '🏎️',
        category: 'compression',
        url: 'https://lz4.github.io/lz4/',
        releaseYear: 2011,
        developer: 'Yann Collet'
    },
    {
        id: 'brotli',
        name: 'Brotli',
        description: 'Modern standard highly optimized for web content. Tested in the browser via WebAssembly (brotli-wasm).',
        icon: '🍞',
        category: 'compression',
        url: 'https://github.com/httptoolkit/brotli-wasm',
        releaseYear: 2013,
        developer: 'Google'
    },
    {
        id: 'zstd',
        name: 'Zstandard',
        description: 'Real-time compression engine with unparalleled scalability. Tested in the browser via WebAssembly (zstd-wasm).',
        icon: '🦖',
        category: 'compression',
        url: 'https://github.com/bokuweb/zstd-wasm',
        releaseYear: 2016,
        developer: 'Facebook (Meta)'
    }
];
