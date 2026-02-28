export interface BenchmarkMetadata {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'low' | 'high-native' | 'high-wrapper' | 'compression';
}

export const benchmarkMetadata: BenchmarkMetadata[] = [
    {
        id: 'cookie',
        name: 'Cookie',
        description: 'Traditional browser cookies. Very limited size (4KB) and can impact network performance as they are sent with every request.',
        icon: '🍪',
        category: 'low'
    },
    {
        id: 'sessionstorage',
        name: 'SessionStorage',
        description: 'Temporary key-value storage valid for the duration of the page session. Limited capacity (typically 5MB).',
        icon: '⏳',
        category: 'low'
    },
    {
        id: 'localstorage',
        name: 'LocalStorage',
        description: 'Standard persistent synchronous key-value storage. Simple but blocks the main thread and has limited capacity (typically 5MB).',
        icon: '💾',
        category: 'low'
    },
    {
        id: 'cacheapi',
        name: 'Cache API',
        description: 'A system for storing and retrieving network requests and their responses. Part of the Service Worker specification, suitable for large data.',
        icon: '📦',
        category: 'high-native'
    },
    {
        id: 'indexeddb',
        name: 'IndexedDB',
        description: 'The standard for client-side structured data. Supports transactions, indexes, and large binary blobs.',
        icon: '🗂️',
        category: 'high-native'
    },
    {
        id: 'opfs-async',
        name: 'OPFS (Async)',
        description: 'Origin Private File System (Async API). Provides higher performance for storage operations compared to traditional storage APIs.',
        icon: '📂',
        category: 'high-native'
    },
    {
        id: 'opfs-sync',
        name: 'OPFS (Sync)',
        description: 'Origin Private File System (Sync API). Designed for use within Web Workers for maximum performance on file operations.',
        icon: '⚡',
        category: 'high-native'
    },
    {
        id: 'sqlite-async',
        name: 'SQLite (Async)',
        description: 'The legendary relational database running via WebAssembly with OPFS (Async) support.',
        icon: '💎',
        category: 'high-wrapper'
    },
    {
        id: 'sqlite-sync',
        name: 'SQLite (Sync)',
        description: 'SQLite running via WebAssembly with OPFS (Sync Access Handle) support for maximum performance.',
        icon: '🚀',
        category: 'high-wrapper'
    },
    {
        id: 'localforage',
        name: 'localForage',
        description: 'An asynchronous storage library that improves the web app offline experience by using a simple localStorage-like API.',
        icon: '📦',
        category: 'high-wrapper'
    },
    {
        id: 'dexie',
        name: 'Dexie.js',
        description: 'A minimalist wrapper for IndexedDB that provides a neat database-like API with promises and observable queries.',
        icon: '🚀',
        category: 'high-wrapper'
    },
    {
        id: 'pouchdb',
        name: 'PouchDB',
        description: 'A CouchDB-compatible database that runs in the browser. Supports sync with remote CouchDB and complex queries.',
        icon: '🎛️',
        category: 'high-wrapper'
    },
    {
        id: 'store.js',
        name: 'store.js',
        description: 'Cross-browser storage wrapper. Falls back to various mechanisms but typically relies on localStorage.',
        icon: '📦',
        category: 'high-wrapper'
    },
    {
        id: 'zip',
        name: 'ZIP',
        description: 'A widely used format implemented via the fflate library, balancing compression ratio and speed. Ideal for multi-file packaging.',
        icon: '📦',
        category: 'compression'
    },
    {
        id: 'gzip',
        name: 'Gzip',
        description: 'Utilizes the browser\'s native CompressionStream API (DEFLATE). Provides zero-overhead text compression without external dependencies.',
        icon: '🗜️',
        category: 'compression'
    },
    {
        id: 'deflate',
        name: 'Deflate',
        description: 'Raw DEFLATE streaming compression built natively into modern browsers. Efficient stream processing.',
        icon: '💨',
        category: 'compression'
    },
    {
        id: 'brotli',
        name: 'Brotli',
        description: 'Advanced compression format (WASM based), highly optimized for web content.',
        icon: '🍞',
        category: 'compression'
    },
    {
        id: 'zstd',
        name: 'zstd',
        description: 'Meta\'s real-time compression engine, integrated via WebAssembly (zstd-wasm). Offers unparalleled speed and flexibility.',
        icon: '🦖',
        category: 'compression'
    }
];
