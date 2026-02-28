import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadString } from '../../benchmark';

export const opfsAsyncBenchmark: BenchmarkUnit = {
    id: 'opfs-async',
    name: 'OPFS (Async)',
    description: 'Origin Private File System (Async API). Provides higher performance for storage operations compared to traditional storage APIs.',
    icon: '📂',
    category: 'high-native',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const fileName = `bench-file-async-${sizeName}`;
        const str = generatePayloadString(sizeValue);
        const modStr = str + 'modified';
        let root: FileSystemDirectoryHandle;
        let fileHandle: FileSystemFileHandle;

        return {
            setup: async () => {
                root = await navigator.storage.getDirectory();
                fileHandle = await root.getFileHandle(fileName, { create: true });
            },
            insert: async () => {
                const writable = await fileHandle.createWritable();
                await writable.write(str as any);
                await writable.close();
            },
            read: async () => {
                const file = await fileHandle.getFile();
                await file.text();
            },
            update: async () => {
                const writable = await fileHandle.createWritable();
                await writable.write(modStr as any);
                await writable.close();
            },
            delete: () => root.removeEntry(fileName).catch(() => { })
        };
    }
};
