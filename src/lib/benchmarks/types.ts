export interface TaskDef {
    category: string;
    sizeName: string;
    sizeValue: number;
}

export type PayloadType = 'text' | 'json' | 'random' | 'binary' | 'image' | 'pdf';

export interface BenchmarkResult {
    insert: number;
    read: number;
    update: number;
    delete: number;
    // Reliability/Integrity
    errors: {
        insert?: number;
        read?: number;
        update?: number;
        delete?: number;
    };
    iterations: number;
}

export interface CompressionResult {
    compressTime: number;
    decompressTime: number;
    ratio: number;
    originalSize?: number;
    compSize?: number;
    // Reliability/Integrity
    valid: boolean;
    errors: number;
}

export interface StorageData {
    [sizeName: string]: {
        [payloadType: string]: {
            [storageName: string]: BenchmarkResult;
        };
    };
}

export interface CompressionData {
    [sizeName: string]: {
        [payloadType: string]: {
            [algorithm: string]: CompressionResult;
        };
    };
}

export interface BenchmarkData {
    low: StorageData;
    high: StorageData;
    compression: CompressionData;
}

export type RunType = 'main.sync' | 'main.async' | 'worker.async';

export interface StorageStepDefinitions {
    setup?: () => void | Promise<void>;
    insert: () => any | Promise<any>;
    read: () => any | Promise<any>;
    update: () => any | Promise<any>;
    delete: () => any | Promise<any>;
    teardown?: () => void | Promise<void>;
}

export interface CompressionStepDefinitions {
    setup?: () => void | Promise<void>;
    compress: () => Uint8Array | Promise<Uint8Array | any>;
    decompress: (data: any) => any | Promise<any>;
    teardown?: () => void | Promise<void>;
}

export interface BenchmarkUnit {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'low' | 'high-native' | 'high-wrapper' | 'compression';
    url?: string;
    releaseYear?: number;
    developer?: string;
    runType: RunType;
    run: (sizeName: string, sizeValue: number, payloads: { original: string; modified: string }) => StorageStepDefinitions | CompressionStepDefinitions | any;
}

export interface EnvironmentMetadata {
    userAgent: string;
    hardwareConcurrency: number;
    deviceMemory?: number;
    platform: string;
}
