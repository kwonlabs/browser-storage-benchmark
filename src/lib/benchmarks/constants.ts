import type { SizeMetadata } from './types';

export const SIZE_METADATA: SizeMetadata[] = [
    { id: '128b', value: 128, label: '128B', storageDefault: true, compressionDefault: false },
    { id: '1kb', value: 1024, label: '1KB', storageDefault: true, compressionDefault: true },
    { id: '10kb', value: 10240, label: '10KB', storageDefault: true, compressionDefault: true },
    { id: '100kb', value: 102400, label: '100KB', storageDefault: true, compressionDefault: true },
    { id: '1mb', value: 1024 * 1024, label: '1MB', storageDefault: true, compressionDefault: true },
    { id: '10mb', value: 10 * 1024 * 1024, label: '10MB', storageDefault: false, compressionDefault: false, warning: true },
    { id: '100mb', value: 100 * 1024 * 1024, label: '100MB', storageDefault: false, compressionDefault: false, warning: true },
    { id: '1gb', value: 1024 * 1024 * 1024, label: '1GB', storageDefault: false, compressionDefault: false, warning: true }
];

// Helper to keep logic compact
export const SIZES: Record<string, number> = SIZE_METADATA.reduce((acc, meta) => {
    acc[meta.id] = meta.value;
    return acc;
}, {} as Record<string, number>);

