import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const opfsSyncBenchmark: BenchmarkUnit = {
    id: 'opfs-sync',
    name: 'OPFS (Sync)',
    description: 'Origin Private File System (Sync API). Designed for use within Web Workers for maximum performance on file operations.',
    icon: '⚡',
    category: 'high-native',
    url: 'https://fs.spec.whatwg.org/#origin-private-file-system',
    releaseYear: 2022,
    developer: 'WHATWG',
    runType: 'worker.async',
    isSupported: () => !!navigator.storage?.getDirectory,
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const fileName = `bench_opfs_sync_${sizeName}_${Math.random().toString(36).slice(2, 7)}.txt`;
        let accessHandle: any;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let root: FileSystemDirectoryHandle;
        let fileHandle: FileSystemFileHandle;

        return {
            setup: async () => {
                if (!root) {
                    root = await navigator.storage.getDirectory();
                    fileHandle = await root.getFileHandle(fileName, { create: true });
                    accessHandle = await (fileHandle as any).createSyncAccessHandle();
                }
            },
            insert: () => {
                const buf = encoder.encode(payloads.original);
                accessHandle.truncate(0);
                accessHandle.write(buf, { at: 0 });
                accessHandle.flush();
            },
            read: async () => {
                const size = accessHandle.getSize();
                const buffer = new Uint8Array(size);
                accessHandle.read(buffer, { at: 0 });
                return decoder.decode(buffer);
            },
            update: () => {
                const buf = encoder.encode(payloads.modified);
                accessHandle.truncate(0);
                accessHandle.write(buf, { at: 0 });
                accessHandle.flush();
            },
            delete: () => {
                accessHandle.truncate(0);
                accessHandle.flush();
            },
            teardown: () => {
                if (accessHandle) {
                    accessHandle.close();
                }
            }
        };
    }
};
