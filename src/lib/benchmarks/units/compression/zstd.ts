// @ts-ignore
import { init, compress, decompress } from '@bokuweb/zstd-wasm';
import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';

export const zstdInteralInitPromise = init();

export const zstdBenchmark: BenchmarkUnit = {
    id: 'zstd',
    name: 'zstd',
    description: 'Meta\'s real-time compression engine, integrated via WebAssembly (zstd-wasm). Offers unparalleled speed and flexibility.',
    icon: '🦖',
    category: 'compression',
    url: 'https://github.com/bokuweb/zstd-wasm',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            setup: async () => {
                await zstdInteralInitPromise;
            },
            compress: () => compress(payload),
            decompress: (data: Uint8Array) => decompress(data)
        };
    }
};
