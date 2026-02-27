export interface TaskDef {
    category: string;
    sizeName: string;
    sizeValue: number;
}

export interface BenchmarkResult {
    insert: number;
    read: number;
    update: number;
    delete: number;
}

export interface CompressionResult {
    compressTime: number;
    decompressTime: number;
    ratio: number;
}

export interface StorageData {
    [sizeName: string]: {
        [storageName: string]: BenchmarkResult;
    };
}

export interface CompressionData {
    [sizeName: string]: {
        [algorithm: string]: CompressionResult;
    };
}

export interface BenchmarkData {
    low: StorageData;
    high: StorageData;
    compression: CompressionData;
}

export interface EnvironmentMetadata {
    userAgent: string;
    hardwareConcurrency: number;
    deviceMemory?: number;
    platform: string;
}
