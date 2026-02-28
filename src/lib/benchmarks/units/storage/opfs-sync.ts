import type { BenchmarkUnit, StorageStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';

export const opfsSyncBenchmark: BenchmarkUnit = {
    id: 'opfs-sync',
    name: 'OPFS (Sync)',
    description: 'Origin Private File System (Sync API). Designed for use within Web Workers for maximum performance on file operations.',
    icon: '⚡',
    category: 'high-native',
    runType: 'worker.async',
    run: (sizeName: string, sizeValue: number): StorageStepDefinitions => {
        const fileName = `bench-file-sync-${sizeName}`;
        const strBuf = generatePayloadBuffer(sizeValue);
        const modStrBuf = generatePayloadBuffer(sizeValue);
        let root: FileSystemDirectoryHandle;
        let fileHandle: FileSystemFileHandle;

        return {
            setup: async () => {
                root = await navigator.storage.getDirectory();
                fileHandle = await root.getFileHandle(fileName, { create: true });
            },
            insert: async () => {
                const accessHandle = await (fileHandle as any).createSyncAccessHandle();
                accessHandle.write(strBuf);
                accessHandle.flush();
                accessHandle.close();
            },
            read: async () => {
                const accessHandle = await (fileHandle as any).createSyncAccessHandle();
                const size = accessHandle.getSize();
                const buffer = new DataView(new ArrayBuffer(size));
                accessHandle.read(buffer, { at: 0 });
                accessHandle.close();
            },
            update: async () => {
                const accessHandle = await (fileHandle as any).createSyncAccessHandle();
                accessHandle.truncate(0);
                accessHandle.write(modStrBuf);
                accessHandle.flush();
                accessHandle.close();
            },
            delete: () => root.removeEntry(fileName).catch(() => { })
        };
    }
};
