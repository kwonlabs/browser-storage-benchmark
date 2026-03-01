import type { BenchmarkUnit, CompressionStepDefinitions } from '../../types';
import { generatePayloadBuffer } from '../../benchmark';
// @ts-ignore
import { compress, decompress } from 'lz4-wasm';

export const lz4Benchmark: BenchmarkUnit = {
    id: 'lz4',
    name: 'LZ4',
    description: 'Extremely fast compression algorithm via WebAssembly. Focus on real-time performance.',
    icon: '🏎️',
    category: 'compression',
    url: 'https://lz4.github.io/lz4/',
    runType: 'worker.async',
    run: (_sizeName: string, sizeValue: number, _payloads: { original: string; modified: string }): CompressionStepDefinitions => {
        const payload = generatePayloadBuffer(sizeValue);

        return {
            compress: async () => {
                return compress(payload);
            },
            decompress: async (data: Uint8Array) => {
                return decompress(data);
            }
        };
    }
};
