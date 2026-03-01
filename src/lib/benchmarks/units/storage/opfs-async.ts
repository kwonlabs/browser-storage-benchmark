import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';

export const opfsAsyncBenchmark: BenchmarkUnit = {
    id: 'opfs-async',
    name: 'OPFS (Async)',
    description: 'Origin Private File System (Async API). Provides higher performance for storage operations compared to traditional storage APIs.',
    icon: '📂',
    category: 'high-native',
    url: 'https://fs.spec.whatwg.org/#origin-private-file-system',
    runType: 'worker.async',
    run: (sizeName: string, _sizeValue: number, payloads: { original: string; modified: string }): StorageStepDefinitions => {
        const fileName = `bench_opfs_async_${sizeName}_${Math.random().toString(36).slice(2, 7)}.txt`;
        let root: FileSystemDirectoryHandle;

        return {
            setup: async () => {
                root = await navigator.storage.getDirectory();
            },
            insert: async () => {
                const file = await root.getFileHandle(fileName, { create: true });
                const writable = await file.createWritable();
                await writable.write(payloads.original);
                await writable.close();
            },
            read: async () => {
                try {
                    const fileHandle = await root.getFileHandle(fileName);
                    const file = await fileHandle.getFile();
                    return await file.text();
                } catch (e) {
                    return null;
                }
            },
            update: async () => {
                const file = await root.getFileHandle(fileName);
                const writable = await file.createWritable();
                await writable.write(payloads.modified);
                await writable.close();
            },
            delete: () => root.removeEntry(fileName).catch(() => { }),
            teardown: async () => {
                try {
                    await root.removeEntry(fileName, { recursive: true });
                } catch (e) { }
            }
        };
    }
};
