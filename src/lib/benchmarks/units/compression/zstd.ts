// @ts-ignore
import { init, compress, decompress } from '@bokuweb/zstd-wasm';
import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';

// Pre-initialize WASM at module level for maximum speed
export const zstdInteralInitPromise = init();

export const zstdBenchmark: BenchmarkUnit = {
    id: 'zstd',
    name: 'zstd',
    description: "Meta's real-time compression engine, integrated via WebAssembly (zstd-wasm). Offers unparalleled speed and flexibility.",
    icon: '🦖',
    category: 'compression',
    specialization: 'generic',
    url: 'https://facebook.github.io/zstd/',
    releaseYear: 2016,
    developer: 'Facebook (Meta)',
    runType: 'worker.async',
    run: (_sizeName: string, _sizeValue: number, _payloads: { original: any; modified: any }): CompressionStepDefinitions => {
        // Use the payload provided by the worker to ensure consistency across different data types (JSON, Image, etc.)
        const payload = _payloads.original as Uint8Array;

        return {
            setup: async () => {
                await zstdInteralInitPromise;
            },
            compress: () => compress(payload),
            decompress: (data: Uint8Array) => decompress(data)
        };
    }
};
