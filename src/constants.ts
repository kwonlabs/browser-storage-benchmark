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
