import type { TaskDef } from './types';

export const SIZES: Record<string, number> = {
    '128b': 128,
    '1kb': 1024,
    '10kb': 10240,
    '100kb': 102400,
    '1mb': 1024 * 1024,
    '10mb': 10 * 1024 * 1024,
    '100mb': 100 * 1024 * 1024,
    '1gb': 1024 * 1024 * 1024
};

export const STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB limit for local/session storage

export const DEFAULT_TASKS: TaskDef[] = [
    { category: 'low', sizeName: '128b', sizeValue: 128 },
    { category: 'low', sizeName: '1kb', sizeValue: 1024 },
    { category: 'low', sizeName: '10kb', sizeValue: 10240 },
    { category: 'low', sizeName: '100kb', sizeValue: 102400 },
    { category: 'low', sizeName: '1mb', sizeValue: 1024 * 1024 },
    { category: 'low', sizeName: '10mb', sizeValue: 10 * 1024 * 1024 },
    // Native Persistent Storage
    { category: 'high-native', sizeName: '1kb', sizeValue: 1024 },
    { category: 'high-native', sizeName: '10kb', sizeValue: 10240 },
    { category: 'high-native', sizeName: '100kb', sizeValue: 102400 },
    { category: 'high-native', sizeName: '1mb', sizeValue: 1024 * 1024 },
    { category: 'high-native', sizeName: '10mb', sizeValue: 10 * 1024 * 1024 },
    // Library Persistent Storage (PouchDB uses this)
    { category: 'high-wrapper', sizeName: '1kb', sizeValue: 1024 },
    { category: 'high-wrapper', sizeName: '10kb', sizeValue: 10240 },
    { category: 'high-wrapper', sizeName: '100kb', sizeValue: 102400 },
    { category: 'high-wrapper', sizeName: '1mb', sizeValue: 1024 * 1024 },
    { category: 'high-wrapper', sizeName: '10mb', sizeValue: 10 * 1024 * 1024 },
    // Compression Engines
    { category: 'compression', sizeName: '1kb', sizeValue: 1024 },
    { category: 'compression', sizeName: '10kb', sizeValue: 10240 },
    { category: 'compression', sizeName: '100kb', sizeValue: 102400 },
    { category: 'compression', sizeName: '1mb', sizeValue: 1024 * 1024 },
    { category: 'compression', sizeName: '10mb', sizeValue: 10 * 1024 * 1024 }
];
